'use client';

import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/header/header';
import { Search, RefreshCcw, Clock, CheckCircle, XCircle, RotateCcw, Truck, Store, Download, Loader2, Gift, Calendar, ChevronDown, X } from 'lucide-react';
import { format, isAfter, isBefore, startOfDay, endOfDay, parseISO, isValid, parse } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { apiMethods } from '@/services/api';
import { toast } from 'react-hot-toast';

// Process image URL to use our proxy for Firebase Storage URLs
function processImageUrl(url: string): string {
  if (!url) return '/placeholder.jpg';
  
  // Handle Firebase Storage URLs
  if (url.includes('firebasestorage.googleapis.com')) {
    return `/api/proxy/image?url=${encodeURIComponent(url)}`;
  }
  
  // Handle blob URLs
  if (url.startsWith('blob:')) {
    return '/placeholder.jpg';
  }
  
  return url;
}
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import OrderReceipt from '@/components/receipt/OrderReceipt';
import GiftReceipt from '@/components/receipt/GiftReceipt';
import Cookies from 'js-cookie';
import { nanoid } from 'nanoid';
import { invoiceService } from '@/services/invoice.service';
import { Order, OrderItem, OrderPayment, POSPaymentMethod, POSPaymentStatus } from '@/types/order';
import { getPaymentMethodDisplay, getPaymentMethodString } from '@/utils/payment-utils';
import RemainingPaymentModal from '@/components/pos/RemainingPaymentModal';
import UpdateOrderDetailsModal from '@/components/pos/UpdateOrderDetailsModal';
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
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
  REFUNDED: { bg: 'bg-orange-100', text: 'text-orange-800', icon: RotateCcw },
  PARTIALLY_REFUNDED: { bg: 'bg-orange-100', text: 'text-orange-800', icon: RotateCcw },
  PARALLEL_PROCESSING: { bg: 'bg-indigo-100', text: 'text-indigo-800', icon: RefreshCcw }
} as const;

const orderStatusLabels = {
  PENDING: 'Pending',
  DESIGN_QUEUE: 'Design Queue',
  DESIGN_PROCESSING: 'Design Processing',
  DESIGN_READY: 'Design Ready',
  KITCHEN_QUEUE: 'Kitchen Queue',
  KITCHEN_PROCESSING: 'In Kitchen',
  KITCHEN_READY: 'Kitchen Ready',
  FINAL_CHECK_QUEUE: 'Final Check Queue',
  FINAL_CHECK_PROCESSING: 'Final Check Processing',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  PARTIALLY_REFUNDED: 'Partially Refunded',
  PARALLEL_PROCESSING: 'Parallel Processing'
} as const;

const paymentStatusLabels = {
  FULLY_PAID: 'Fully Paid',
  PARTIALLY_PAID: 'Partially Paid',
  PENDING: 'Pending'
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
  const [selectedOrderStatus, setSelectedOrderStatus] = useState<string>('all');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [showPickupDateFilter, setShowPickupDateFilter] = useState(false);
  const [showDeliveryDateFilter, setShowDeliveryDateFilter] = useState(false);
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const [showPickupCalendar, setShowPickupCalendar] = useState(false);
  const [showDeliveryCalendar, setShowDeliveryCalendar] = useState(false);
  const startCalendarRef = useRef<HTMLDivElement>(null);
  const endCalendarRef = useRef<HTMLDivElement>(null);
  const pickupCalendarRef = useRef<HTMLDivElement>(null);
  const deliveryCalendarRef = useRef<HTMLDivElement>(null);
  const dateFilterRef = useRef<HTMLDivElement>(null);
  const pickupDateFilterRef = useRef<HTMLDivElement>(null);
  const deliveryDateFilterRef = useRef<HTMLDivElement>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderForGiftReceipt, setSelectedOrderForGiftReceipt] = useState<Order | null>(null);
  const [downloadingInvoices, setDownloadingInvoices] = useState<Record<string, boolean>>({});
  const [downloadingGiftInvoices, setDownloadingGiftInvoices] = useState<Record<string, boolean>>({});
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
  }, [isAuthenticated, selectedOrderStatus, selectedPaymentStatus]);
  
  // Add click outside handler to close date filter popups
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dateFilterRef.current && !dateFilterRef.current.contains(event.target as Node)) {
        setShowDateFilter(false);
        setShowStartCalendar(false);
        setShowEndCalendar(false);
      }
      if (pickupDateFilterRef.current && !pickupDateFilterRef.current.contains(event.target as Node)) {
        setShowPickupDateFilter(false);
        setShowPickupCalendar(false);
      }
      if (deliveryDateFilterRef.current && !deliveryDateFilterRef.current.contains(event.target as Node)) {
        setShowDeliveryDateFilter(false);
        setShowDeliveryCalendar(false);
      }
      // Don't automatically fetch orders when closing the popup without clicking Apply
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
      
      // Prepare API parameters
      const params: { 
        status?: string, 
        paymentStatus?: string, 
        startDate?: string, 
        endDate?: string,
        pickupDate?: string,
        deliveryDate?: string
      } = {};
      
      // Add order status filter if not 'all'
      if (selectedOrderStatus !== 'all') {
        params.status = selectedOrderStatus;
      }
      
      // Add payment status filter if not 'all'
      if (selectedPaymentStatus !== 'all') {
        params.paymentStatus = selectedPaymentStatus;
      }
      
      // Add date range parameters if dates are set
      if (startDate) {
        params.startDate = startDate;
        // If end date is not provided, use current date
        params.endDate = endDate || format(new Date(), 'yyyy-MM-dd');
        console.log('Fetching orders with date range:', { startDate, endDate: params.endDate });
      } else {
        // Make sure we're not sending empty strings as parameters
        delete params.startDate;
        delete params.endDate;
      }
      
      // Add pickup date filter if set
      if (pickupDate) {
        params.pickupDate = pickupDate;
        console.log('Fetching orders with pickup date:', pickupDate);
      }
      
      // Add delivery date filter if set
      if (deliveryDate) {
        params.deliveryDate = deliveryDate;
        console.log('Fetching orders with delivery date:', deliveryDate);
      }
      
      console.log('Final API params:', params);
      
      const response = await apiMethods.pos.getOrders(params);
      
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

      console.log('Cancelling order:', orderId);
      const success = await apiMethods.pos.cancelOrder(orderId);

      if (success) {
        toast.success('Order cancelled successfully');
        setShowCancelConfirm(null);
        fetchOrders(); // Refresh orders list
      } else {
        throw new Error('Failed to cancel order');
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

  const handleViewGiftReceipt = (order: Order) => {
    setSelectedOrderForGiftReceipt(order);
  };

  const calculateRemainingAmount = (order: Order) => {
    // For orders with pending payments, we need to handle them differently
    if (hasPendingPayment(order)) {
      // Find pending payments
      const pendingPayments = order.payments?.filter(p => 
        p.status === POSPaymentStatus.PENDING || 
        p.method === POSPaymentMethod.PAY_LATER
      );
      
      // If there are pending payments, use their amount as the remaining amount
      if (pendingPayments && pendingPayments.length > 0) {
        return pendingPayments.reduce((sum, payment) => sum + payment.amount, 0);
      }
      
      // If order has PENDING_PAYMENT status but no pending payments, use the total amount
      if (order.status === 'PENDING_PAYMENT') {
        return order.totalAmount;
      }
    }
    
    // For partial payments, calculate the difference between total and paid
    const totalPaid = order.payments?.reduce((sum, payment) => {
      // Only count payments that are not pending
      if (payment.status !== POSPaymentStatus.PENDING && payment.method !== POSPaymentMethod.PAY_LATER) {
        return sum + payment.amount;
      }
      return sum;
    }, 0) || 0;
    
    return Math.max(0, order.totalAmount - totalPaid);
  };

  const hasPartialPayment = (order: Order) => {
    const hasPartialStatus = order.payments?.some(p => p.status === POSPaymentStatus.PARTIALLY_PAID || p.isPartialPayment);
    const totalPaid = order.payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
    return hasPartialStatus || (totalPaid > 0 && totalPaid < order.totalAmount);
  };
  
  const hasPendingPayment = (order: Order) => {
    // Check if there are any pending payments
    const hasPendingPaymentStatus = order.payments?.some(p => p.status === POSPaymentStatus.PENDING);
    
    // Check if there are any pay later payments that are still pending
    const hasPayLaterPending = order.payments?.some(p => 
      p.method === POSPaymentMethod.PAY_LATER && p.status === POSPaymentStatus.PENDING
    );
    
    // Check if the order status indicates pending payment
    const hasPendingPaymentStatus2 = order.status === 'PENDING_PAYMENT';
    
    // Calculate total paid amount
    const totalPaid = order.payments?.reduce((sum, payment) => {
      // Only count fully paid payments
      if (payment.status === POSPaymentStatus.FULLY_PAID) {
        return sum + payment.amount;
      }
      return sum;
    }, 0) || 0;
    
    // Check if the total paid amount is less than the order total
    const hasRemainingBalance = Math.abs(totalPaid - order.totalAmount) > 0.01;
    
    console.log(`Order ${order.orderNumber} payment check:`, {
      hasPendingPaymentStatus,
      hasPayLaterPending,
      hasPendingPaymentStatus2,
      totalPaid,
      orderTotal: order.totalAmount,
      hasRemainingBalance
    });
    
    // An order has pending payment if it has a pending payment status OR
    // it has a pay later payment that is still pending OR
    // it has a pending payment status in the order status AND
    // it has a remaining balance to be paid
    return (hasPendingPaymentStatus || hasPayLaterPending || hasPendingPaymentStatus2) && hasRemainingBalance;
  };

  const isFullyPaid = (order: Order) => {
    // If any payment has PENDING status, the order is not fully paid regardless of amount
    if (hasPendingPayment(order)) {
      return false;
    }
    
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
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
            
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search orders..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 items-center">
            
            <select
              value={selectedOrderStatus}
              onChange={(e) => setSelectedOrderStatus(e.target.value)}
              className="w-full md:w-48 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Order Status: All</option>
              {Object.entries(orderStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label} ({orders.filter(order => order.status === value).length})
                </option>
              ))}
            </select>
            
            <select
              value={selectedPaymentStatus}
              onChange={(e) => setSelectedPaymentStatus(e.target.value)}
              className="w-full md:w-48 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Payment Status: All</option>
              {Object.entries(paymentStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label} ({orders.filter(order => {
                    // Check if any payment has this status
                    if (value === 'FULLY_PAID') {
                      return isFullyPaid(order);
                    } else if (value === 'PARTIALLY_PAID') {
                      return hasPartialPayment(order);
                    } else if (value === 'PENDING') {
                      return hasPendingPayment(order);
                    }
                    return false;
                  }).length})
                </option>
              ))}
            </select>
            
            {/* Order Date Filter */}
            <div className="relative">
              <button
                onClick={() => setShowDateFilter(!showDateFilter)}
                className="w-full md:w-48 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 flex items-center justify-between"
              >
                <span>{startDate ? `${format(parse(startDate, 'yyyy-MM-dd', new Date()), 'PP')}${endDate ? ` - ${format(parse(endDate, 'yyyy-MM-dd', new Date()), 'PP')}` : ''}` : 'Order Date'}</span>
                <Calendar className="h-4 w-4 text-gray-400 ml-2" />
              </button>
              
              {/* Custom date range picker */}
              {showDateFilter && (
                <div 
                  ref={dateFilterRef}
                  className="absolute z-10 mt-2 p-4 bg-white rounded-lg shadow-lg border border-gray-200 w-80"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-700">Date Range</h3>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => {
                          // Clear date filter
                          setStartDate('');
                          setEndDate('');
                          setShowDateFilter(false);
                          
                          // Fetch orders without date filter
                          fetchOrders();
                          
                          // Log for debugging
                          console.log('Cleared date filter');
                        }}
                        className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        Clear
                      </button>
                      <button 
                        onClick={() => {
                          if (startDate) {
                            // Close the date filter popup
                            setShowDateFilter(false);
                            setShowStartCalendar(false);
                            setShowEndCalendar(false);
                            
                            // Explicitly fetch orders with the selected date range
                            fetchOrders();
                            
                            // Log for debugging
                            console.log('Applying date filter:', { startDate, endDate });
                          } else {
                            toast.error('Please select at least a start date');
                          }
                        }}
                        className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                      <div className="relative">
                        <div 
                          className="w-full px-3 py-1.5 border border-gray-200 rounded text-sm flex justify-between items-center cursor-pointer"
                          onClick={() => {
                            setShowStartCalendar(!showStartCalendar);
                            setShowEndCalendar(false);
                          }}
                        >
                          <span>{startDate ? format(parse(startDate, 'yyyy-MM-dd', new Date()), 'PP') : 'Select start date'}</span>
                          <Calendar className="h-4 w-4 text-gray-400" />
                        </div>
                        
                        {showStartCalendar && (
                          <div 
                            ref={startCalendarRef}
                            className="absolute z-20 mt-1 bg-white rounded-lg shadow-lg border border-gray-200"
                          >
                            <DayPicker
                              mode="single"
                              selected={startDate ? parse(startDate, 'yyyy-MM-dd', new Date()) : undefined}
                              onSelect={(date) => {
                                if (date) {
                                  setStartDate(format(date, 'yyyy-MM-dd'));
                                  setShowStartCalendar(false);
                                }
                              }}
                              className="p-2"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">End Date</label>
                      <div className="relative">
                        <div 
                          className="w-full px-3 py-1.5 border border-gray-200 rounded text-sm flex justify-between items-center cursor-pointer"
                          onClick={() => {
                            setShowEndCalendar(!showEndCalendar);
                            setShowStartCalendar(false);
                          }}
                        >
                          <span>{endDate ? format(parse(endDate, 'yyyy-MM-dd', new Date()), 'PP') : 'Today (optional)'}</span>
                          <Calendar className="h-4 w-4 text-gray-400" />
                        </div>
                        
                        {showEndCalendar && (
                          <div 
                            ref={endCalendarRef}
                            className="absolute z-20 mt-1 bg-white rounded-lg shadow-lg border border-gray-200"
                          >
                            <DayPicker
                              mode="single"
                              selected={endDate ? parse(endDate, 'yyyy-MM-dd', new Date()) : undefined}
                              onSelect={(date) => {
                                if (date) {
                                  setEndDate(format(date, 'yyyy-MM-dd'));
                                  setShowEndCalendar(false);
                                }
                              }}
                              className="p-2"
                              fromDate={startDate ? parse(startDate, 'yyyy-MM-dd', new Date()) : undefined}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Pickup Date Filter */}
            <div className="relative">
              <button
                onClick={() => setShowPickupDateFilter(!showPickupDateFilter)}
                className="w-full md:w-48 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 flex items-center justify-between"
              >
                <span>{pickupDate ? format(parse(pickupDate, 'yyyy-MM-dd', new Date()), 'PP') : 'Pickup Date'}</span>
                <Store className="h-4 w-4 text-gray-400 ml-2" />
              </button>
              
              {/* Pickup date picker */}
              {showPickupDateFilter && (
                <div 
                  ref={pickupDateFilterRef}
                  className="absolute z-10 mt-2 p-4 bg-white rounded-lg shadow-lg border border-gray-200 w-80"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-700">Pickup Date</h3>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => {
                          setPickupDate('');
                          setShowPickupDateFilter(false);
                          fetchOrders();
                          console.log('Cleared pickup date filter');
                        }}
                        className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        Clear
                      </button>
                      <button 
                        onClick={() => {
                          if (pickupDate) {
                            setShowPickupDateFilter(false);
                            setShowPickupCalendar(false);
                            fetchOrders();
                            console.log('Applying pickup date filter:', pickupDate);
                          } else {
                            toast.error('Please select a pickup date');
                          }
                        }}
                        className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="relative">
                        <div 
                          className="w-full px-3 py-1.5 border border-gray-200 rounded text-sm flex justify-between items-center cursor-pointer"
                          onClick={() => setShowPickupCalendar(!showPickupCalendar)}
                        >
                          <span>{pickupDate ? format(parse(pickupDate, 'yyyy-MM-dd', new Date()), 'PP') : 'Select pickup date'}</span>
                          <Calendar className="h-4 w-4 text-gray-400" />
                        </div>
                        
                        {showPickupCalendar && (
                          <div 
                            ref={pickupCalendarRef}
                            className="absolute z-20 mt-1 bg-white rounded-lg shadow-lg border border-gray-200"
                          >
                            <DayPicker
                              mode="single"
                              selected={pickupDate ? parse(pickupDate, 'yyyy-MM-dd', new Date()) : undefined}
                              onSelect={(date) => {
                                if (date) {
                                  setPickupDate(format(date, 'yyyy-MM-dd'));
                                  setShowPickupCalendar(false);
                                }
                              }}
                              footer={<p className="text-center text-sm p-2">Click to select</p>}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Delivery Date Filter */}
            <div className="relative">
              <button
                onClick={() => setShowDeliveryDateFilter(!showDeliveryDateFilter)}
                className="w-full md:w-48 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 flex items-center justify-between"
              >
                <span>{deliveryDate ? format(parse(deliveryDate, 'yyyy-MM-dd', new Date()), 'PP') : 'Delivery Date'}</span>
                <Truck className="h-4 w-4 text-gray-400 ml-2" />
              </button>
              
              {/* Delivery date picker */}
              {showDeliveryDateFilter && (
                <div 
                  ref={deliveryDateFilterRef}
                  className="absolute z-10 mt-2 p-4 bg-white rounded-lg shadow-lg border border-gray-200 w-80"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-700">Delivery Date</h3>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => {
                          setDeliveryDate('');
                          setShowDeliveryDateFilter(false);
                          fetchOrders();
                          console.log('Cleared delivery date filter');
                        }}
                        className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        Clear
                      </button>
                      <button 
                        onClick={() => {
                          if (deliveryDate) {
                            setShowDeliveryDateFilter(false);
                            setShowDeliveryCalendar(false);
                            fetchOrders();
                            console.log('Applying delivery date filter:', deliveryDate);
                          } else {
                            toast.error('Please select a delivery date');
                          }
                        }}
                        className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="relative">
                        <div 
                          className="w-full px-3 py-1.5 border border-gray-200 rounded text-sm flex justify-between items-center cursor-pointer"
                          onClick={() => setShowDeliveryCalendar(!showDeliveryCalendar)}
                        >
                          <span>{deliveryDate ? format(parse(deliveryDate, 'yyyy-MM-dd', new Date()), 'PP') : 'Select delivery date'}</span>
                          <Calendar className="h-4 w-4 text-gray-400" />
                        </div>
                        
                        {showDeliveryCalendar && (
                          <div 
                            ref={deliveryCalendarRef}
                            className="absolute z-20 mt-1 bg-white rounded-lg shadow-lg border border-gray-200"
                          >
                            <DayPicker
                              mode="single"
                              selected={deliveryDate ? parse(deliveryDate, 'yyyy-MM-dd', new Date()) : undefined}
                              onSelect={(date) => {
                                if (date) {
                                  setDeliveryDate(format(date, 'yyyy-MM-dd'));
                                  setShowDeliveryCalendar(false);
                                }
                              }}
                              footer={<p className="text-center text-sm p-2">Click to select</p>}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  // Reset all filters
                  setSearchTerm('');
                  setSelectedOrderStatus('all');
                  setSelectedPaymentStatus('all');
                  setStartDate('');
                  setEndDate('');
                  setPickupDate('');
                  setDeliveryDate('');
                  setShowDateFilter(false);
                  setShowPickupDateFilter(false);
                  setShowDeliveryDateFilter(false);
                  
                  // Fetch orders without any filters
                  fetchOrders();
                  
                  // Log for debugging
                  console.log('Reset all filters');
                  
                  // Show success message
                  toast.success('All filters have been reset');
                }}
                className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 flex items-center justify-center gap-1"
              >
                <X className="h-3 w-3" />
                Reset
              </button>
              
              <button
                onClick={handleRefresh}
                className="w-full md:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 flex items-center justify-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Refresh
              </button>
            </div>
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
            {orders
              .filter(order => {
                // Apply search term filtering
                if (searchTerm) {
                  const searchLower = searchTerm.toLowerCase();
                  if (!(
                    order.orderNumber?.toString().includes(searchLower) ||
                    order.customerName?.toLowerCase().includes(searchLower) ||
                    order.customerPhone?.toLowerCase().includes(searchLower) ||
                    order.customerEmail?.toLowerCase().includes(searchLower) ||
                    order.id?.toLowerCase().includes(searchLower)
                  )) {
                    return false;
                  }
                }
                
                // Apply date filtering on the client side as well for extra safety
                if (startDate) {
                  try {
                    const orderDate = new Date(order.createdAt);
                    const filterStartDate = parse(startDate, 'yyyy-MM-dd', new Date());
                    const filterStartDay = startOfDay(filterStartDate);
                    
                    if (endDate) {
                      const filterEndDate = parse(endDate, 'yyyy-MM-dd', new Date());
                      const filterEndDay = endOfDay(filterEndDate);
                      
                      // If order date is before start date, filter it out
                      if (isBefore(orderDate, filterStartDay) || isAfter(orderDate, filterEndDay)) {
                        return false;
                      }
                    } else {
                      // If only start date is provided, check if order date is on or after start date
                      if (isBefore(orderDate, filterStartDay)) {
                        return false;
                      }
                    }
                  } catch (error) {
                    console.error('Error filtering by date:', error);
                  }
                }
                
                // Apply pickup date filtering on the client side
                if (pickupDate) {
                  try {
                    // Skip orders without pickup date
                    if (!order.pickupDate) return false;
                    
                    // Convert both dates to local date strings to avoid timezone issues
                    const orderDate = new Date(order.pickupDate);
                    // Format as YYYY-MM-DD for consistent comparison
                    const orderPickupDateFormatted = format(orderDate, 'yyyy-MM-dd');
                    console.log('Comparing pickup dates:', { orderDate: orderPickupDateFormatted, filterDate: pickupDate });
                    
                    if (orderPickupDateFormatted !== pickupDate) {
                      return false;
                    }
                  } catch (error) {
                    console.error('Error filtering by pickup date:', error);
                  }
                }
                
                // Apply delivery date filtering on the client side
                if (deliveryDate) {
                  try {
                    // Skip orders without delivery date
                    if (!order.deliveryDate) return false;
                    
                    // Convert both dates to local date strings to avoid timezone issues
                    const orderDate = new Date(order.deliveryDate);
                    // Format as YYYY-MM-DD for consistent comparison
                    const orderDeliveryDateFormatted = format(orderDate, 'yyyy-MM-dd');
                    console.log('Comparing delivery dates:', { orderDate: orderDeliveryDateFormatted, filterDate: deliveryDate });
                    
                    if (orderDeliveryDateFormatted !== deliveryDate) {
                      return false;
                    }
                  } catch (error) {
                    console.error('Error filtering by delivery date:', error);
                  }
                }
                
                return true;
              })
              .map((order) => (
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
                            {orderStatusLabels[order.status] || order.status}
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
                              {/* Add button to update order details */}
                              {!['COMPLETED', 'CANCELLED'].includes(order.status) && (
                                <button
                                  onClick={() => setSelectedOrderForPickupUpdate(order)}
                                  className="mt-2 px-3 py-1 text-xs font-medium text-indigo-600 bg-indigo-100 rounded-md hover:bg-indigo-200 inline-flex items-center"
                                >
                                  <Truck className="h-3 w-3 mr-1" />
                                  Change Delivery/Pickup
                                </button>
                              )}
                            </div>
                          </>
                        ) : order.deliveryMethod === 'PICKUP' && (
                          <>
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <h4 className="font-semibold text-gray-700">Pickup Details:</h4>
                              {order.deliveryMethod === 'PICKUP' && order.pickupDate && order.pickupTimeSlot && (
                                <p>Pickup Date & Time: {format(new Date(order.pickupDate), 'PP')} - {order.pickupTimeSlot}</p>
                              )}
                              {/* Add button to update order details */}
                              {!['COMPLETED', 'CANCELLED'].includes(order.status) && (
                                <button
                                  onClick={() => setSelectedOrderForPickupUpdate(order)}
                                  className="mt-2 px-3 py-1 text-xs font-medium text-indigo-600 bg-indigo-100 rounded-md hover:bg-indigo-200 inline-flex items-center"
                                >
                                  {order.deliveryMethod === 'PICKUP' ? (
                                    <>
                                      <Clock className="h-3 w-3 mr-1" />
                                      Change Pickup/Delivery
                                    </>
                                  ) : (
                                    <>
                                      <Truck className="h-3 w-3 mr-1" />
                                      Change Delivery Method
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </>
                        )}
                        
                        {/* Gift Information Section */}
                        {order.isGift && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <div className="flex items-center gap-1 mb-1">
                              <Gift className="h-4 w-4 text-pink-500" />
                              <h4 className="font-semibold text-gray-700">Gift Information:</h4>
                            </div>
                            {order.giftRecipientName && (
                              <p className="text-sm">Recipient: {order.giftRecipientName}</p>
                            )}
                            {order.giftRecipientPhone && (
                              <p className="text-sm">Recipient Phone: {order.giftRecipientPhone}</p>
                            )}
                            {order.giftMessage && (
                              <p className="text-sm">Message: "{order.giftMessage}"</p>
                            )}
                            {order.giftCashAmount && parseFloat(String(order.giftCashAmount)) > 0 && (
                              <p className="text-sm">Cash Gift: AED {parseFloat(String(order.giftCashAmount)).toFixed(2)}</p>
                            )}
                            {/* Add button to update gift details */}
                            {!['COMPLETED', 'CANCELLED'].includes(order.status) && (
                              <button
                                onClick={() => setSelectedOrderForPickupUpdate(order)}
                                className="mt-2 px-3 py-1 text-xs font-medium text-pink-600 bg-pink-100 rounded-md hover:bg-pink-200 inline-flex items-center"
                              >
                                <Gift className="h-3 w-3 mr-1" />
                                Update Gift Details
                              </button>
                            )}
                          </div>
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
                                        src={processImageUrl(img.url)}
                                        alt={`Custom image ${idx + 1}`}
                                        className="w-full h-24 object-cover rounded"
                                        onError={(e) => {
                                          if (e.currentTarget.src !== '/placeholder.jpg') {
                                            e.currentTarget.src = '/placeholder.jpg';
                                          }
                                        }}
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
                          {/* Show payment status at the top */}
                          {isFullyPaid(order) && (
                            <div className="text-sm font-medium text-green-600 mb-2">
                              Status: Fully Paid
                            </div>
                          )}
                          {hasPendingPayment(order) && (
                            <div className="text-sm font-medium text-orange-600 mb-2">
                              Status: Payment Pending
                            </div>
                          )}
                          {!isFullyPaid(order) && !hasPendingPayment(order) && hasPartialPayment(order) && (
                            <div className="text-sm font-medium text-orange-600 mb-2">
                              Status: Partially Paid
                            </div>
                          )}
                          
                          {order.payments.map((payment, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="flex-1">
                                <span className="font-medium">
                                  {payment.status === POSPaymentStatus.PARTIALLY_PAID 
                                    ? 'Partial Payment' 
                                    : payment.status === POSPaymentStatus.PENDING
                                      ? `${getPaymentMethodString(payment.method)} (Pending)` 
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
                                
                                {/* For Pay Later payments, show pending status */}
                                {payment.status === POSPaymentStatus.PENDING && (
                                  <div className="text-orange-600 mt-1 ml-2">
                                    <div>Status: Payment Pending</div>
                                    <div>Amount Due: AED {payment.amount.toFixed(2)}</div>
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
                        onClick={() => isSuperAdmin ? setShowCancelConfirm(order.id) : handleCancelAttempt()}
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
                      {order.isGift && (
                        <button
                          onClick={() => handleViewGiftReceipt(order)}
                          className="px-3 py-2 text-sm font-medium text-pink-700 bg-pink-100 rounded-md hover:bg-pink-200 flex items-center gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Gift Receipt
                        </button>
                      )}
                    {(hasPartialPayment(order) || hasPendingPayment(order)) && !isFullyPaid(order) && (
                      <button
                        onClick={() => setSelectedOrderForPayment(order)}
                        className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-100 rounded-md hover:bg-indigo-200 flex-1 flex items-center justify-center gap-2"
                      >
                        {hasPendingPayment(order) ? '💰 Pay Now' : '💰 Pay Remaining'}
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

      {/* Gift Receipt Modal */}
      {selectedOrderForGiftReceipt && (
        <GiftReceipt
          order={selectedOrderForGiftReceipt}
          onClose={() => setSelectedOrderForGiftReceipt(null)}
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

      {/* Update Order Details Modal */}
      {selectedOrderForPickupUpdate && (
        <UpdateOrderDetailsModal
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
