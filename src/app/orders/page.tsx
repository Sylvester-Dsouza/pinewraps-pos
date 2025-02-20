'use client';

import React from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/header/header';
import { Search, RefreshCcw, Clock, CheckCircle, XCircle, RotateCcw, Truck, Store } from 'lucide-react';
import { format } from 'date-fns';
import { apiMethods } from '@/services/api';
import { toast } from 'react-hot-toast';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import OrderReceipt from '@/components/receipt/OrderReceipt';
import Cookies from 'js-cookie';
import { nanoid } from 'nanoid';

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
  status: 'PENDING' | 'DESIGN_QUEUE' | 'DESIGN_PROCESSING' | 'DESIGN_READY' | 'KITCHEN_QUEUE' | 'KITCHEN_PROCESSING' | 'KITCHEN_READY' | 'COMPLETED';
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
}

const statusColors = {
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
  DESIGN_QUEUE: { bg: 'bg-purple-100', text: 'text-purple-800', icon: RotateCcw },
  DESIGN_PROCESSING: { bg: 'bg-purple-100', text: 'text-purple-800', icon: RefreshCcw },
  DESIGN_READY: { bg: 'bg-purple-100', text: 'text-purple-800', icon: CheckCircle },
  KITCHEN_QUEUE: { bg: 'bg-blue-100', text: 'text-blue-800', icon: RotateCcw },
  KITCHEN_PROCESSING: { bg: 'bg-blue-100', text: 'text-blue-800', icon: RefreshCcw },
  KITCHEN_READY: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle }
} as const;

const statusLabels = {
  PENDING: 'Pending',
  DESIGN_QUEUE: 'Design Queue',
  DESIGN_PROCESSING: 'Design Processing',
  DESIGN_READY: 'Design Ready',
  KITCHEN_QUEUE: 'Kitchen Queue',
  KITCHEN_PROCESSING: 'In Kitchen',
  KITCHEN_READY: 'Kitchen Ready',
  COMPLETED: 'Completed'
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

  const handleReorder = async (order: Order) => {
    try {
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
      console.error('Error reordering:', error);
      toast.error('Failed to reorder items');
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
              className="w-full md:w-auto px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center gap-2"
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
                        <div className={`px-3 py-1 rounded-full text-sm ${statusColors[order.status].bg} ${statusColors[order.status].text} flex items-center gap-1`}>
                          {(() => {
                            const Icon = statusColors[order.status].icon;
                            return <Icon className="h-4 w-4" />;
                          })()}
                          {statusLabels[order.status]}
                        </div>
                        {/* Add delivery method badge */}
                        {order.deliveryMethod && (
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
                        
                        {/* Update delivery/pickup information styling */}
                        {order.deliveryMethod && (
                          <div className="mt-2 border-t pt-2">
                            <p className={`font-medium flex items-center gap-1 ${deliveryMethodColors[order.deliveryMethod].text}`}>
                              {(() => {
                                const Icon = deliveryMethodColors[order.deliveryMethod].icon;
                                return <Icon className="h-4 w-4" />;
                              })()}
                              {order.deliveryMethod === 'DELIVERY' ? 'Delivery Details' : 'Pickup Details'}
                            </p>
                            {order.deliveryMethod === 'DELIVERY' ? (
                              <>
                                <p>Date: {format(new Date(order.deliveryDate || ''), 'PP')}</p>
                                <p>Time: {order.deliveryTimeSlot}</p>
                                <p>Address: {order.streetAddress}</p>
                                {order.apartment && <p>Apartment: {order.apartment}</p>}
                                <p>City: {order.city}</p>
                                <p>Emirate: {order.emirate}</p>
                                {order.deliveryInstructions && (
                                  <p>Instructions: {order.deliveryInstructions}</p>
                                )}
                                <p className="font-medium">Delivery Charge: AED {(order.deliveryCharge || 0).toFixed(2)}</p>
                              </>
                            ) : (
                              <>
                                <p>Date: {order.pickupDate ? format(new Date(order.pickupDate), 'PP') : 'Not specified'}</p>
                                <p>Time: {order.pickupTimeSlot || 'Not specified'}</p>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Total Amount</p>
                      <p className="text-xl font-semibold">AED {(order.totalAmount || 0).toFixed(2)}</p>
                      <p className="text-sm text-gray-600">Method: {order.paymentMethod}</p>
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
                  
                  <div className="flex gap-2 mt-4 pt-4 border-t">
                    <button
                      onClick={() => handlePrintReceipt(order)}
                      className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2-4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      Print
                    </button>
                    
                    <button
                      onClick={() => handleReorder(order)}
                      className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Reorder
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

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
