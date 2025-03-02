'use client';

import React from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/header/header';
import { Search, RefreshCcw, Clock, CheckCircle, XCircle, RotateCcw, Truck, Store, Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { apiMethods } from '@/services/api';
import { toast } from 'react-hot-toast';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import OrderReceipt from '@/components/receipt/OrderReceipt';
import Cookies from 'js-cookie';
import { nanoid } from 'nanoid';
import { invoiceService } from '@/services/invoice.service';

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  totalPrice: number;
  variations: Array<{
    type: string;
    value: string;
  }>;
  notes?: string;
  designImages?: Array<{
    url: string;
  }>;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  createdAt: string;
  status: 'PENDING' | 'DESIGN_QUEUE' | 'DESIGN_PROCESSING' | 'DESIGN_READY' | 'KITCHEN_QUEUE' | 'KITCHEN_PROCESSING' | 'KITCHEN_READY' | 'FINAL_CHECK_QUEUE' | 'FINAL_CHECK_PROCESSING' | 'FINAL_CHECK_COMPLETE' | 'COMPLETED' | 'CANCELLED' | 'PENDING_PAYMENT';
  totalAmount: number;
  paidAmount: number;
  paymentMethod: 'CASH' | 'CARD';
  items: OrderItem[];
  notes?: string;
  deliveryMethod?: 'DELIVERY' | 'PICKUP';
  deliveryDate?: string;
  deliveryTimeSlot?: string;
  deliveryCharge?: number;
  deliveryInstructions?: string;
  streetAddress?: string;
  apartment?: string;
  emirate?: string;
  city?: string;
  pickupDate?: string;
  pickupTimeSlot?: string;
  isGift?: boolean;
  giftRecipientName?: string;
  giftRecipientPhone?: string;
  giftMessage?: string;
  giftCashAmount?: number;
}

const statusColors = {
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
  DESIGN_QUEUE: { bg: 'bg-purple-100', text: 'text-purple-800', icon: RotateCcw },
  DESIGN_PROCESSING: { bg: 'bg-purple-100', text: 'text-purple-800', icon: RefreshCcw },
  DESIGN_READY: { bg: 'bg-purple-100', text: 'text-purple-800', icon: CheckCircle },
  KITCHEN_QUEUE: { bg: 'bg-blue-100', text: 'text-blue-800', icon: RotateCcw },
  KITCHEN_PROCESSING: { bg: 'bg-blue-100', text: 'text-blue-800', icon: RefreshCcw },
  KITCHEN_READY: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
  FINAL_CHECK_QUEUE: { bg: 'bg-amber-100', text: 'text-amber-800', icon: RotateCcw },
  FINAL_CHECK_PROCESSING: { bg: 'bg-amber-100', text: 'text-amber-800', icon: RefreshCcw },
  FINAL_CHECK_COMPLETE: { bg: 'bg-amber-100', text: 'text-amber-800', icon: CheckCircle },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
  PENDING_PAYMENT: { bg: 'bg-orange-100', text: 'text-orange-800', icon: Clock }
} as const;

const statusLabels = {
  PENDING: 'Pending',
  DESIGN_QUEUE: 'Design Queue',
  DESIGN_PROCESSING: 'Design Processing',
  DESIGN_READY: 'Design Ready',
  KITCHEN_QUEUE: 'Kitchen Queue',
  KITCHEN_PROCESSING: 'In Kitchen',
  KITCHEN_READY: 'Kitchen Ready',
  FINAL_CHECK_QUEUE: 'Final Check Queue',
  FINAL_CHECK_PROCESSING: 'Final Check Processing',
  FINAL_CHECK_COMPLETE: 'Final Check Complete',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  PENDING_PAYMENT: 'Pending Payment'
} as const;

const deliveryMethodColors = {
  DELIVERY: { bg: 'bg-orange-100', text: 'text-orange-800', icon: Truck },
  PICKUP: { bg: 'bg-indigo-100', text: 'text-indigo-800', icon: Store }
} as const;

const OrdersPage = () => {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState('all');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [downloadingInvoices, setDownloadingInvoices] = useState<Record<string, boolean>>({});
  const [showCancelConfirm, setShowCancelConfirm] = useState<string | null>(null);

  // Check authentication status
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user ? 'User logged in' : 'No user');
      if (user) {
        try {
          // Get fresh token
          const token = await user.getIdToken(true);
          
          // Store token in cookie
          Cookies.set('firebase-token', token, {
            expires: 7,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
          });
          
          setIsAuthenticated(true);
          fetchOrders();
        } catch (error) {
          console.error('Error getting token:', error);
          toast.error('Authentication error. Please try logging in again.');
          router.push('/login');
        }
      } else {
        setIsAuthenticated(false);
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch orders when status changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders();
    }
  }, [isAuthenticated, selectedStatus]);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching orders...');
      
      // Get fresh token before fetching orders
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user');
      }
      
      const token = await user.getIdToken(true);
      Cookies.set('firebase-token', token, {
        expires: 7,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });
      
      const response = await apiMethods.pos.getOrders();
      
      console.log('Orders API Response:', response);
      
      if (response.success && Array.isArray(response.data)) {
        // Transform the data to match the Order interface
        const transformedOrders = response.data.map((order: any) => ({
          ...order,
          items: order.items.map((item: any) => ({
            ...item,
            variations: Array.isArray(item.variations) ? item.variations : [],
            totalPrice: Number(item.totalPrice) || 0
          })),
          totalAmount: Number(order.total || order.totalAmount) || 0,
          paidAmount: Number(order.paidAmount) || 0
        }));
        
        console.log('Transformed orders:', transformedOrders);
        
        const sortedOrders = [...transformedOrders].sort((a: Order, b: Order) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        
        setOrders(sortedOrders);
      } else {
        throw new Error(response.message || 'Failed to fetch orders');
      }
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      setError(error.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh orders every 30 seconds
  useEffect(() => {
    if (!isAuthenticated) return;

    const refreshInterval = setInterval(() => {
      console.log('Auto-refreshing orders...');
      fetchOrders();
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [isAuthenticated, selectedStatus]);

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const searchMatch = searchTerm === '' || 
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerPhone.toLowerCase().includes(searchTerm.toLowerCase());

    const statusMatch = selectedStatus === 'all' || order.status === selectedStatus;

    // Date filter
    const orderDate = new Date(order.createdAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let dateMatch = true;
    switch (selectedDateRange) {
      case 'today':
        dateMatch = orderDate >= today;
        break;
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        dateMatch = orderDate >= weekAgo;
        break;
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        dateMatch = orderDate >= monthAgo;
        break;
      default:
        dateMatch = true;
    }

    return searchMatch && statusMatch && dateMatch;
  });

  // Get order counts by status
  const orderCounts = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleReorder = async (order: any) => {
    try {
      // Get the original order items
      const items = order.items.map((item: any) => ({
        ...item,
        id: undefined // Remove the original ID to create new items
      }));

      // Set up the initial order state
      // setOrderItems(items);
      // setCustomerDetails({
      //   name: order.customerName || '',
      //   phone: order.customerPhone || '',
      //   email: order.customerEmail || '',
      // });

      // Set gift details if it was a gift order
      if (order.isGift) {
        // setGiftDetails({
        //   isGift: true,
        //   recipientName: order.giftRecipientName || '',
        //   recipientPhone: order.giftRecipientPhone || '',
        //   message: order.giftMessage || '',
        //   note: '',
        //   cashAmount: order.giftCashAmount || 0,
        //   includeCash: order.giftCashAmount > 0
        // });
      }

      // Format cart items to match the POS cart structure
      const cartItems = order.items.map(item => ({
        id: nanoid(), // Generate a new cart item ID
        product: {
          id: item.productId,
          name: item.productName,
          basePrice: item.totalPrice / item.quantity, // Calculate unit price
          status: 'ACTIVE',
          images: item.designImages || []
        },
        quantity: item.quantity,
        selectedVariations: item.variations?.map(v => ({
          id: nanoid(), // Generate ID for variation
          type: v.type,
          value: v.value,
          priceAdjustment: 0 // Since we don't have this info from the order
        })) || [],
        totalPrice: item.totalPrice,
        notes: item.notes || ''
      }));

      // Save to localStorage
      localStorage.setItem('pos-cart', JSON.stringify(cartItems));
      
      toast.success('Items added to cart');
      router.push('/pos');
    } catch (error) {
      console.error('Error handling reorder:', error);
      toast.error('Failed to process reorder');
    }
  };

  const handleRefresh = async () => {
    await fetchOrders();
    toast.success('Orders refreshed');
  };

  const handlePrintReceipt = (order: Order) => {
    console.log('Printing order:', order); // Debug log
    setSelectedOrder(order);
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      const response = await apiMethods.pos.updateOrderStatus(orderId, {
        status: 'CANCELLED',
        notes: 'Order cancelled by POS user'
      });

      if (response.success) {
        toast.success('Order cancelled successfully');
        setShowCancelConfirm(null);
        fetchOrders(); // Refresh orders list
      } else {
        throw new Error(response.message || 'Failed to cancel order');
      }
    } catch (error: any) {
      console.error('Error cancelling order:', error);
      toast.error(error.message || 'Failed to cancel order');
    }
  };

  const handleDownloadInvoice = async (orderId: string) => {
    try {
      setDownloadingInvoices(prev => ({ ...prev, [orderId]: true }));
      await invoiceService.downloadInvoice(orderId);
      toast.success('Invoice downloaded successfully');
    } catch (error: any) {
      console.error('Error downloading invoice:', error);
      toast.error(error.message || 'Failed to download invoice');
    } finally {
      setDownloadingInvoices(prev => ({ ...prev, [orderId]: false }));
    }
  };

  if (!isAuthenticated) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-4 text-gray-600">Checking authentication...</p>
      </div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Orders</h1>
          
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search orders..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full md:w-48 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status ({orders.length})</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label} ({orderCounts[value] || 0})
                </option>
              ))}
            </select>
            
            <select
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value)}
              className="w-full md:w-48 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
            
            <button
              onClick={handleRefresh}
              className="w-full md:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          </div>
        ) : error ? (
          <div className="text-center text-red-600 py-8">{error}</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No orders found</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg shadow-sm p-6 h-full">
                <div className="flex flex-col h-full">
                  <div className="flex justify-between items-start gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">Order #{order.orderNumber}</h3>
                        {statusColors[order.status] && (
                          <div className={`px-3 py-1 rounded-full text-sm ${statusColors[order.status].bg} ${statusColors[order.status].text} flex items-center gap-1`}>
                            {(() => {
                              const Icon = statusColors[order.status].icon;
                              return <Icon className="h-4 w-4" />;
                            })()}
                            {statusLabels[order.status] || order.status}
                          </div>
                        )}
                        {/* Add delivery method badge */}
                        {order.deliveryMethod && deliveryMethodColors[order.deliveryMethod] && (
                          <div className={`px-3 py-1 rounded-full text-sm ${deliveryMethodColors[order.deliveryMethod].bg} ${deliveryMethodColors[order.deliveryMethod].text} flex items-center gap-1`}>
                            {(() => {
                              const Icon = deliveryMethodColors[order.deliveryMethod].icon;
                              return <Icon className="h-4 w-4" />;
                            })()}
                            {order.deliveryMethod}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>Customer: {order.customerName}</p>
                        <p>Phone: {order.customerPhone}</p>
                        {order.customerEmail && <p>Email: {order.customerEmail}</p>}
                        <p>Date: {format(new Date(order.createdAt), 'PPpp')}</p>
                        <p>Total Amount: AED {order.totalAmount?.toFixed(2) || '0.00'}</p>
                        <p>Payment Method: {order.paymentMethod}</p>
                        
                        {/* Delivery/Pickup Details */}
                        {order.deliveryMethod === 'DELIVERY' ? (
                          <>
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <p className="font-medium text-gray-700">Delivery Details:</p>
                              {order.deliveryDate && order.deliveryTimeSlot && (
                                <p>Date & Time: {format(new Date(order.deliveryDate), 'PP')} - {order.deliveryTimeSlot}</p>
                              )}
                              {order.streetAddress && (
                                <p>Address: {[
                                  order.streetAddress,
                                  order.apartment,
                                  order.city,
                                  order.emirate
                                ].filter(Boolean).join(', ')}</p>
                              )}
                              {order.deliveryInstructions && (
                                <p>Instructions: {order.deliveryInstructions}</p>
                              )}
                            </div>
                          </>
                        ) : order.deliveryMethod === 'PICKUP' && (
                          <>
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <p className="font-medium text-gray-700">Pickup Details:</p>
                              {order.pickupDate && order.pickupTimeSlot && (
                                <p>Date & Time: {format(new Date(order.pickupDate), 'PP')} - {order.pickupTimeSlot}</p>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-grow">
                    <h4 className="font-semibold mb-2">Order Items</h4>
                    <div className="space-y-2">
                      {order.items.map((item, index) => (
                        <div key={index} className="flex justify-between items-start text-sm">
                          <div className="flex-1">
                            <p className="font-medium">{item.productName}</p>
                            <p className="text-gray-600">Quantity: {item.quantity}</p>
                            {item.variations?.length > 0 && (
                              <p className="text-gray-600">
                                Options: {item.variations.map(v => `${v.type}: ${v.value}`).join(', ')}
                              </p>
                            )}
                            {item.notes && <p className="text-gray-600">Notes: {item.notes}</p>}
                            {item.designImages && item.designImages.length > 0 && (
                              <div className="mt-2 flex gap-2">
                                {item.designImages.map((image, idx) => (
                                  <img 
                                    key={idx} 
                                    src={image.url} 
                                    alt={`Design ${idx + 1}`} 
                                    className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <p className="font-medium">AED {(item.totalPrice || 0).toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-4">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 flex-1"
                    >
                      View Receipt
                    </button>
                    {!['COMPLETED', 'CANCELLED'].includes(order.status) && (
                      <button
                        onClick={() => setShowCancelConfirm(order.id)}
                        className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 flex-1"
                      >
                        Cancel Order
                      </button>
                    )}
                    <button
                      onClick={() => handleReorder(order)}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
                    >
                      Reorder
                    </button>
                    <button
                        onClick={() => handleDownloadInvoice(order.id)}
                        disabled={downloadingInvoices[order.id]}
                        className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {downloadingInvoices[order.id] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        {downloadingInvoices[order.id] ? 'Downloading...' : 'Download Invoice'}
                      </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Cancel Order</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to cancel this order? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCancelConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                No, Keep Order
              </button>
              <button
                onClick={() => {
                  handleCancelOrder(showCancelConfirm);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Yes, Cancel Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {selectedOrder && (
        <OrderReceipt
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
};

export default OrdersPage;
