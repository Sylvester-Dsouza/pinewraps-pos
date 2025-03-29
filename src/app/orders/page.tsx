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
import { Order, OrderItem, OrderPayment, POSPaymentMethod, POSPaymentStatus } from '@/types/order';
import { getPaymentMethodDisplay, getPaymentMethodString } from '@/utils/payment-utils';
import RemainingPaymentModal from '@/components/pos/RemainingPaymentModal';
import UpdatePickupDetailsModal from '@/components/pos/UpdatePickupDetailsModal';
import { useUserRole } from '@/hooks/use-user-role';

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
  REFUNDED: { bg: 'bg-orange-100', text: 'text-orange-800', icon: RotateCcw },
  PENDING_PAYMENT: { bg: 'bg-orange-100', text: 'text-orange-800', icon: Clock },
  PARTIALLY_REFUNDED: { bg: 'bg-orange-100', text: 'text-orange-800', icon: RotateCcw }
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
  REFUNDED: 'Refunded',
  PENDING_PAYMENT: 'Pending Payment',
  PARTIALLY_REFUNDED: 'Partially Refunded'
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
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Order | null>(null);
  const [selectedOrderForPickupUpdate, setSelectedOrderForPickupUpdate] = useState<Order | null>(null);
  const [showPartialRefundModal, setShowPartialRefundModal] = useState<string | null>(null);
  const [partialRefundAmount, setPartialRefundAmount] = useState<string>('');
  const { isSuperAdmin } = useUserRole();

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

  // Auto-refresh orders every 30 seconds - REMOVED as per user request
  // useEffect(() => {
  //   if (!isAuthenticated) return;

  //   const refreshInterval = setInterval(() => {
  //     console.log('Auto-refreshing orders...');
  //     fetchOrders();
  //   }, 30000);

  //   return () => clearInterval(refreshInterval);
  // }, [isAuthenticated, selectedStatus]);

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
        // Log the payment data for debugging
        response.data.forEach((order: any) => {
          if (order.payments && order.payments.length > 0) {
            console.log('Order ID:', order.id);
            console.log('Payment Data:', JSON.stringify(order.payments, null, 2));
          }
        });
        
        // Transform the data to match the Order interface
        const transformedOrders = response.data.map((order: any) => {
          // Ensure payment data is correctly transformed
          const transformedPayments = order.payments?.map((payment: any) => {
            // Make sure split payment data is correctly processed
            if (payment.method === 'SPLIT' || payment.isSplitPayment) {
              console.log('Processing split payment:', payment);
              return {
                ...payment,
                cashPortion: payment.cashPortion || payment.metadata?.cashPortion || payment.metadata?.cashAmount || 0,
                cardPortion: payment.cardPortion || payment.metadata?.cardPortion || payment.metadata?.cardAmount || 
                  (parseFloat(payment.amount) - parseFloat(payment.cashPortion || payment.metadata?.cashPortion || payment.metadata?.cashAmount || 0))
              };
            }
            
            // Handle partial payments
            if (payment.status === 'PARTIALLY_PAID' || payment.isPartialPayment) {
              console.log('Processing partial payment:', payment);
              return {
                ...payment,
                status: POSPaymentStatus.PARTIALLY_PAID,
                isPartialPayment: true,
                remainingAmount: payment.remainingAmount || payment.metadata?.remainingAmount || 0,
                futurePaymentMethod: payment.futurePaymentMethod || payment.metadata?.futurePaymentMethod
              };
            }
            
            return payment;
          }) || [];

          return {
            ...order,
            items: order.items.map((item: any) => ({
              ...item,
              name: item.productName || item.name,
              // Normalize variations to a consistent format
              variations: ((item.selectedVariations || item.variations) || []).map((v: any) => {
                if (typeof v === 'object' && v !== null) {
                  return {
                    id: v.id || nanoid(),
                    type: (v.type || v.name || v.variationType || '').toString(),
                    value: (v.value || v.variationValue || '').toString(),
                    price: Number(v.price) || 0,
                    priceAdjustment: Number(v.priceAdjustment) || 0
                  };
                }
                return {
                  id: nanoid(),
                  type: 'Option',
                  value: String(v || ''),
                  price: 0,
                  priceAdjustment: 0
                };
              }),
              totalPrice: Number(item.totalPrice) || 0
            })),
            totalAmount: Number(order.total || order.totalAmount) || 0,
            paidAmount: Number(order.paidAmount) || 0,
            changeAmount: Number(order.changeAmount) || 0,
            // Normalize payment information
            paymentMethod: order.paymentMethod || 'CASH',
            payments: transformedPayments
          };
        });
        
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
          name: item.name,
          basePrice: item.totalPrice / item.quantity, // Calculate unit price
          status: 'ACTIVE',
          images: item.designImages || []
        },
        quantity: item.quantity,
        selectedVariations: ((item.selectedVariations || item.variations) || []).map(v => {
          // Handle both object and string formats
          if (typeof v === 'object' && v !== null) {
            return {
              id: v.id || nanoid(),
              type: (v.type || v.name || v.variationType || '').toString(),
              value: (v.value || v.variationValue || '').toString(),
              priceAdjustment: Number(v.priceAdjustment) || Number(v.price) || 0
            };
          }
          // If it's not an object or is null, create a default format
          return {
            id: nanoid(),
            type: 'Option',
            value: String(v || ''),
            priceAdjustment: 0
          };
        }).filter(v => v.type && v.value), // Filter out any invalid variations
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
      if (!isSuperAdmin) {
        toast.error('Only Super Admins can cancel orders');
        setShowCancelConfirm(null);
        return;
      }

      const response = await apiMethods.pos.updateOrderStatus(orderId, {
        status: 'CANCELLED',
        notes: 'Order cancelled by Super Admin'
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
      setShowCancelConfirm(null);
    }
  };

  const handleRefundOrder = async (orderId: string) => {
    try {
      const response = await apiMethods.pos.updateOrderStatus(orderId, {
        status: 'REFUNDED',
        notes: 'Order refunded by POS user'
      });

      if (response.success) {
        toast.success('Order marked as refunded');
        fetchOrders(); // Refresh orders list
      } else {
        throw new Error(response.message || 'Failed to mark order as refunded');
      }
    } catch (error: any) {
      console.error('Error marking order as refunded:', error);
      toast.error(error.message || 'Failed to mark order as refunded');
    }
  };

  const handlePartialRefund = async (orderId: string) => {
    try {
      // Validate refund amount
      const amount = parseFloat(partialRefundAmount);
      if (isNaN(amount) || amount <= 0) {
        toast.error('Please enter a valid refund amount');
        return;
      }

      const response = await apiMethods.pos.updateOrderStatus(orderId, {
        status: 'PARTIALLY_REFUNDED',
        notes: `Order partially refunded by POS user. Amount: ${amount}`,
        partialRefundAmount: amount
      });

      if (response.success) {
        toast.success('Order marked as partially refunded');
        setShowPartialRefundModal(null);
        setPartialRefundAmount('');
        fetchOrders(); // Refresh orders list
      } else {
        throw new Error(response.message || 'Failed to mark order as partially refunded');
      }
    } catch (error: any) {
      console.error('Error marking order as partially refunded:', error);
      toast.error(error.message || 'Failed to mark order as partially refunded');
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

  const calculateRemainingAmount = (order: Order) => {
    const totalPaid = order.payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
    return Math.max(0, order.totalAmount - totalPaid);
  };

  const hasPartialPayment = (order: Order) => {
    const hasPartialStatus = order.payments?.some(p => p.status === POSPaymentStatus.PARTIALLY_PAID || p.isPartialPayment);
    const totalPaid = order.payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
    return hasPartialStatus || (totalPaid > 0 && totalPaid < order.totalAmount);
  };

  const isFullyPaid = (order: Order) => {
    const totalPaid = order.payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
    return Math.abs(totalPaid - order.totalAmount) < 0.01; // Using a small epsilon for floating point comparison
  };

  const handlePaymentComplete = async () => {
    await fetchOrders();
    setSelectedOrderForPayment(null);
  };

  const handlePickupDetailsUpdated = async () => {
    await fetchOrders();
    setSelectedOrderForPickupUpdate(null);
  };

  const handleCancelAttempt = () => {
    if (!isSuperAdmin) {
      toast.error('Only Super Admins can cancel orders');
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
                  {label} ({orders.filter(order => order.status === value).length})
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
        ) : orders.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No orders found</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {orders.map((order) => (
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
                        
                        {/* Display refund status */}
                        {order.status === 'REFUNDED' && (
                          <p className="font-medium text-red-600 mt-2">Status: Fully Refunded</p>
                        )}
                        {order.status === 'PARTIALLY_REFUNDED' && order.partialRefundAmount && (
                          <p className="font-medium text-orange-600 mt-2">
                            Status: Partially Refunded (AED {order.partialRefundAmount.toFixed(2)})
                          </p>
                        )}
                        
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
                              <h4 className="font-semibold text-gray-700">Pickup Details:</h4>
                              {order.pickupDate && order.pickupTimeSlot && (
                                <p>Date & Time: {format(new Date(order.pickupDate), 'PP')} - {order.pickupTimeSlot}</p>
                              )}
                              {/* Add button to update pickup details */}
                              {!['COMPLETED', 'CANCELLED'].includes(order.status) && (
                                <button
                                  onClick={() => setSelectedOrderForPickupUpdate(order)}
                                  className="mt-2 px-3 py-1 text-xs font-medium text-indigo-600 bg-indigo-100 rounded-md hover:bg-indigo-200 inline-flex items-center"
                                >
                                  <Clock className="h-3 w-3 mr-1" />
                                  Change Pickup Time
                                </button>
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
                            {item.selectedVariations && item.selectedVariations.length > 0 && (
                              <div className="text-gray-600">
                                {item.selectedVariations.map((v, idx) => (
                                  <p key={idx} className="text-sm">
                                    {v.type}: <span className="font-medium">{v.value}</span>
                                  </p>
                                ))}
                              </div>
                            )}
                            {item.notes && (
                              <p className="text-gray-600 mt-1">Notes: {item.notes}</p>
                            )}
                            {item.customImages && item.customImages.length > 0 && (
                              <div className="mt-2">
                                <p className="font-medium text-gray-700">Custom Images:</p>
                                <div className="grid grid-cols-2 gap-2 mt-1">
                                  {item.customImages.map((img, idx) => (
                                    <div key={idx} className="relative">
                                      <img
                                        src={img.url}
                                        alt={`Custom image ${idx + 1}`}
                                        className="w-full h-24 object-cover rounded"
                                      />
                                      {img.comment && (
                                        <p className="text-xs text-gray-600 mt-1">{img.comment}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <p>AED {typeof item.totalPrice === 'number' ? item.totalPrice.toFixed(2) : '0.00'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Display partial refund amount if applicable */}
                    {order.status === 'PARTIALLY_REFUNDED' && order.partialRefundAmount && (
                      <div className="mt-3 pt-2 border-t border-gray-200">
                        <p className="font-medium text-orange-600">
                          Partial Refund Amount: AED {order.partialRefundAmount.toFixed(2)}
                        </p>
                      </div>
                    )}
                    
                    {/* Payment Details Section */}
                    {order.payments && order.payments.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-gray-200">
                        <p className="font-medium text-gray-700">Payment Details:</p>
                        <div className="space-y-1 mt-1">
                          {/* Show payment status at the top if fully paid */}
                          {isFullyPaid(order) && (
                            <div className="text-sm font-medium text-green-600 mb-2">
                              Status: Fully Paid
                            </div>
                          )}
                          
                          {order.payments.map((payment, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="flex-1">
                                <span className="font-medium">
                                  {payment.status === POSPaymentStatus.PARTIALLY_PAID 
                                    ? 'Partial Payment' 
                                    : getPaymentMethodString(payment.method)}
                                </span>
                                
                                {/* For Card payments, always show reference */}
                                {payment.method === POSPaymentMethod.CARD && payment.status !== POSPaymentStatus.PARTIALLY_PAID && (
                                  <span className="text-gray-600 ml-2">
                                    Ref: {payment.reference || 'N/A'}
                                  </span>
                                )}
                                
                                {/* For Split payments, always show cash and card portions */}
                                {(payment.method === POSPaymentMethod.SPLIT || payment.isSplitPayment) && (
                                  <div className="text-gray-600 mt-1 ml-2">
                                    <div>Cash portion: AED {Number(payment.cashPortion).toFixed(2)}</div>
                                    <div>Card portion: AED {Number(payment.cardPortion).toFixed(2)}</div>
                                    {(payment.cardReference || payment.reference) && <div>Card Ref: {payment.cardReference || payment.reference}</div>}
                                  </div>
                                )}
                                
                                {/* For Partial payments, show paid and remaining */}
                                {payment.status === POSPaymentStatus.PARTIALLY_PAID && (
                                  <div className="text-orange-600 mt-1 ml-2">
                                    <div>Paid with {getPaymentMethodString(payment.method)}: AED {payment.amount.toFixed(2)}</div>
                                    <div>Remaining: AED {(payment.remainingAmount || 0).toFixed(2)}</div>
                                    {payment.futurePaymentMethod && (
                                      <div>To be paid with: {getPaymentMethodString(payment.futurePaymentMethod)}</div>
                                    )}
                                    {payment.method === POSPaymentMethod.CARD && payment.reference && (
                                      <div>Card Ref: {payment.reference}</div>
                                    )}
                                  </div>
                                )}
                              </span>
                              <span className="text-right font-medium">
                                AED {payment.amount.toFixed(2)}
                              </span>
                            </div>
                          ))}
                          
                          {/* Show total paid and remaining amount if there's a partial payment */}
                          {hasPartialPayment(order) && (
                            <div className="flex flex-col text-sm mt-2 pt-2 border-t border-gray-200">
                              <div className="flex justify-between">
                                <span className="font-medium">Total Paid:</span>
                                <span>AED {(order.payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between font-medium text-orange-600">
                                <span>Remaining Amount:</span>
                                <span>AED {calculateRemainingAmount(order).toFixed(2)}</span>
                              </div>
                              {/* Show future payment method if available */}
                              {order.payments?.some(p => p.futurePaymentMethod) && (
                                <div className="flex justify-between text-sm text-gray-600 mt-1">
                                  <span>To be paid with:</span>
                                  <span>{getPaymentMethodString(order.payments.find(p => p.futurePaymentMethod)?.futurePaymentMethod || POSPaymentMethod.CASH)}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-3 pt-2 border-t border-gray-200">
                      <p className="font-medium text-gray-700">Total Amount: AED {order.totalAmount?.toFixed(2) || '0.00'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-4">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 flex-1"
                    >
                      View Receipt
                    </button>
                    {!['COMPLETED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(order.status) && (
                      <button
                        onClick={isSuperAdmin ? () => setShowCancelConfirm(order.id) : handleCancelAttempt}
                        className={`px-4 py-2 text-sm font-medium ${isSuperAdmin ? 'text-red-700 bg-red-100 hover:bg-red-200' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'} rounded-md flex-1`}
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
                    {hasPartialPayment(order) && !isFullyPaid(order) && (
                      <button
                        onClick={() => setSelectedOrderForPayment(order)}
                        className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-100 rounded-md hover:bg-indigo-200 flex-1"
                      >
                        Pay Remaining
                      </button>
                    )}
                    {order.status === 'CANCELLED' && (
                      <>
                        <button
                          onClick={() => handleRefundOrder(order.id)}
                          className="text-sm text-orange-600 hover:text-orange-800 flex items-center gap-1 mr-3"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Mark as Refunded
                        </button>
                        <button
                          onClick={() => setShowPartialRefundModal(order.id)}
                          className="text-sm text-orange-600 hover:text-orange-800 flex items-center gap-1"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Mark as Partial Refund
                        </button>
                      </>
                    )}
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

      {/* Payment Modal */}
      {selectedOrderForPayment && (
        <RemainingPaymentModal
          isOpen={!!selectedOrderForPayment}
          onClose={() => setSelectedOrderForPayment(null)}
          orderId={selectedOrderForPayment.id}
          remainingAmount={calculateRemainingAmount(selectedOrderForPayment)}
          onPaymentComplete={handlePaymentComplete}
        />
      )}

      {/* Update Pickup Details Modal */}
      {selectedOrderForPickupUpdate && (
        <UpdatePickupDetailsModal
          isOpen={!!selectedOrderForPickupUpdate}
          onClose={() => setSelectedOrderForPickupUpdate(null)}
          order={selectedOrderForPickupUpdate}
          onSuccess={handlePickupDetailsUpdated}
        />
      )}

      {/* Partial Refund Modal */}
      {showPartialRefundModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Partial Refund</h3>
            <p className="text-gray-600 mb-6">
              Enter the amount you want to refund:
            </p>
            <input
              type="number"
              value={partialRefundAmount}
              onChange={(e) => setPartialRefundAmount(e.target.value)}
              placeholder="Refund Amount"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowPartialRefundModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePartialRefund(showPartialRefundModal)}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700"
              >
                Refund
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
