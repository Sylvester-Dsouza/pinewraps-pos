'use client';

import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/header/header';
import { Search, RefreshCcw, Clock, CheckCircle, XCircle, RotateCcw, Truck, Store, Download, Loader2, Gift, Calendar, ChevronDown, X, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Printer } from 'lucide-react';
import { format, isAfter, isBefore, startOfDay, endOfDay, parseISO, isValid, parse } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { apiMethods } from '@/services/api';
import { toast } from 'react-hot-toast';
import { toast as sonnerToast } from 'sonner';

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
import { Order, POSPaymentMethod, POSPaymentStatus, POSOrderStatus } from '@/types/order';
import { getPaymentMethodString } from '@/utils/payment-utils';
import RemainingPaymentModal from '@/components/pos/RemainingPaymentModal';
import UpdateOrderDetailsModal from '@/components/pos/UpdateOrderDetailsModal';
import { useUserRole } from '@/hooks/use-user-role';
import CustomImageManager from '@/components/orders/CustomImageManager';

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
  PENDING: 'Pending',
  REFUNDED: 'Refunded',
  PARTIALLY_REFUNDED: 'Partially Refunded',
  CANCELLED: 'Cancelled'
} as const;

const deliveryMethodColors = {
  DELIVERY: { bg: 'bg-orange-100', text: 'text-orange-800', icon: Truck },
  PICKUP: { bg: 'bg-indigo-100', text: 'text-indigo-800', icon: Store }
} as const;

const OrdersPage = () => {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [allOrdersForCounts, setAllOrdersForCounts] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'orderNumber' | 'customerPhone' | 'customerName'>('orderNumber');
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
  const [selectedGiftOrder, setSelectedGiftOrder] = useState<Order | null>(null);
  const [downloadingInvoices, setDownloadingInvoices] = useState<Record<string, boolean>>({});
  const [showCancelConfirm, setShowCancelConfirm] = useState<string | null>(null);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Order | null>(null);
  const [selectedOrderForPickupUpdate, setSelectedOrderForPickupUpdate] = useState<Order | null>(null);
  const [showPartialRefundModal, setShowPartialRefundModal] = useState<string | null>(null);
  const [partialRefundAmount, setPartialRefundAmount] = useState<string>('');
  const [refundNotes, setRefundNotes] = useState<string>('');
  const [partialRefundNotes, setPartialRefundNotes] = useState<string>('');
  const [showRefundModal, setShowRefundModal] = useState<string | null>(null);
  const [showCustomImageModal, setShowCustomImageModal] = useState(false);
  const [selectedOrderItem, setSelectedOrderItem] = useState<{orderId: string, item: any, itemIndex: number} | null>(null);
  const { isSuperAdmin, userRole } = useUserRole();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const ordersPerPage = 20;

  // Sorting state
  const [sortBy, setSortBy] = useState<'createdAt' | 'pickupTime' | 'deliveryTime'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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
          fetchAllOrdersForCounts();
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

  // Fetch orders when status changes or page changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders();
    }
  }, [isAuthenticated, selectedOrderStatus, selectedPaymentStatus, currentPage, sortBy, sortOrder, searchTerm, searchType]);

  // Reset to first page when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [selectedOrderStatus, selectedPaymentStatus, startDate, endDate, pickupDate, deliveryDate, searchTerm, searchType]);

  // Helper function to parse time slot and get start time for sorting
  const parseTimeSlot = (timeSlot: string): number => {
    if (!timeSlot) return 0;

    // Extract start time from time slot (e.g., "11:00 AM - 1:00 PM" -> "11:00 AM")
    const startTime = timeSlot.split(' - ')[0]?.trim();
    if (!startTime) return 0;

    // Convert to 24-hour format for comparison
    const [time, period] = startTime.split(' ');
    if (!time || !period) return 0;

    const [hours, minutes] = time.split(':').map(Number);
    if (isNaN(hours)) return 0;

    let hour24 = hours;
    if (period.toUpperCase() === 'PM' && hours !== 12) {
      hour24 += 12;
    } else if (period.toUpperCase() === 'AM' && hours === 12) {
      hour24 = 0;
    }

    const totalMinutes = hour24 * 60 + (minutes || 0);

    // Debug logging for time parsing
    console.log(`Parsing time slot: "${timeSlot}" -> "${startTime}" -> ${hour24}:${minutes || 0} -> ${totalMinutes} minutes`);

    return totalMinutes; // Convert to minutes for easy comparison
  };

  // Function to handle sorting
  const handleSort = (newSortBy: 'createdAt' | 'pickupTime' | 'deliveryTime') => {
    if (sortBy === newSortBy) {
      // Toggle sort order if same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new sort field with default order
      setSortBy(newSortBy);
      setSortOrder(newSortBy === 'createdAt' ? 'desc' : 'asc'); // Default to desc for date, asc for time
    }

    // Refetch orders to apply the new sorting/filtering
    setTimeout(() => {
      fetchOrders();
    }, 100); // Small delay to ensure state is updated
  };
  
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

  // Fetch all orders for filter counts (without pagination)
  const fetchAllOrdersForCounts = async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;

      const token = await user.getIdToken(true);
      Cookies.set('firebase-token', token, {
        expires: 7,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });

      // Fetch all orders without pagination for counting
      const response = await apiMethods.pos.getOrders({
        limit: 10000 // Large number to get all orders
      });

      if (response.success && Array.isArray(response.data)) {
        // Transform the data similar to main fetchOrders
        const transformedOrders = response.data.map((order: any) => {
          const transformedPayments = order.payments?.map((payment: any) => {
            if (payment.method === 'SPLIT' || payment.isSplitPayment) {
              return {
                ...payment,
                cashPortion: payment.cashPortion || payment.metadata?.cashPortion || payment.metadata?.cashAmount || 0,
                cardPortion: payment.cardPortion || payment.metadata?.cardPortion || payment.metadata?.cardAmount ||
                  (parseFloat(payment.amount) - parseFloat(payment.cashPortion || payment.metadata?.cashPortion || payment.metadata?.cashAmount || 0))
              };
            }

            if (payment.status === POSPaymentStatus.PARTIALLY_PAID || payment.isPartialPayment) {
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

          const calculatedTotal = order.items.reduce((sum: number, item: any) => {
            return sum + Number(item.totalPrice || item.total || (item.quantity * item.unitPrice)) || 0;
          }, 0);

          const discountedTotal = order.couponDiscount ? calculatedTotal - Number(order.couponDiscount) : calculatedTotal;
          const finalTotal = discountedTotal + Number(order.deliveryCharge || 0);

          return {
            ...order,
            items: order.items.map((item: any) => ({
              ...item,
              name: item.productName || item.name,
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
              totalPrice: Number(item.totalPrice || item.total || (item.quantity * item.unitPrice)) || 0
            })),
            totalAmount: finalTotal,
            total: finalTotal,
            subtotal: calculatedTotal,
            paidAmount: Number(order.paidAmount) || 0,
            changeAmount: Number(order.changeAmount) || 0,
            deliveryCharge: Number(order.deliveryCharge || 0),
            paymentMethod: order.paymentMethod || 'CASH',
            payments: transformedPayments
          };
        });

        setAllOrdersForCounts(transformedOrders);
      }
    } catch (error) {
      console.error('Error fetching all orders for counts:', error);
    }
  };

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
        deliveryDate?: string,
        page?: number,
        limit?: number,
        search?: string,
        searchType?: string
      } = {
        page: currentPage,
        limit: ordersPerPage
      };
      
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
        // Only add end date if it's explicitly set
        if (endDate) {
          params.endDate = endDate;
          console.log('Fetching orders with date range:', { startDate, endDate });
        } else {
          // If no end date, filter for exact date only
          params.endDate = startDate;
          console.log('Fetching orders for exact date:', { startDate });
        }
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

      // Add search term if provided
      if (searchTerm && searchTerm.trim()) {
        params.search = searchTerm.trim();
        params.searchType = searchType; // Add search type parameter
        console.log('Fetching orders with search term:', searchTerm, 'type:', searchType);
      }

      console.log('Final API params:', params);
      
      const response = await apiMethods.pos.getOrders(params);

      console.log('Orders API Response:', response);

      if (response.success && Array.isArray(response.data)) {
        // Update total count from pagination metadata
        if (response.pagination) {
          setTotalOrders(response.pagination.total);
          console.log('Pagination info:', response.pagination);
        }
        // Debug total values from API
        response.data.forEach((order: any) => {
          console.log(`Order ${order.id} values:`, {
            totalAmount: order.totalAmount,
            total: order.total,
            subtotal: order.subtotal,
            rawOrder: order
          });
        });
        // Log the payment data for debugging
        response.data.forEach((order: any) => {
          if (order.payments && order.payments.length > 0) {
            console.log('Order ID:', order.id);
            console.log('Payment Data:', JSON.stringify(order.payments, null, 2));
          }
        });
        
        // Transform the data to match the Order interface
        const transformedOrders = response.data.map((order: any) => {
          // Debug order items
          console.log('Processing order:', order.id);
          order.items?.forEach((item: any) => {
            console.log('Item:', {
              id: item.id,
              name: item.name,
              category: item.category,
              totalPrice: item.totalPrice,
              total: item.total,
              quantity: item.quantity,
              unitPrice: item.unitPrice
            });
          });
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
            if (payment.status === POSPaymentStatus.PARTIALLY_PAID || payment.isPartialPayment) {
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

          // Extract the latest refund notes from statusHistory if available
          let refundNotes = '';
          
          // Debug the order object
          console.log(`Order ${order.id} status:`, order.status);
          console.log(`Order ${order.id} direct notes:`, order.notes);
          
          if (order.statusHistory && Array.isArray(order.statusHistory) && order.statusHistory.length > 0) {
            console.log(`Order ${order.id} has status history:`, order.statusHistory.length, 'entries');
            
            // Log all status history entries for debugging
            order.statusHistory.forEach((entry: any, index: number) => {
              console.log(`Status history entry ${index}:`, {
                status: entry.status,
                notes: entry.notes,
                updatedAt: entry.updatedAt
              });
            });
            
            // Find the most recent REFUNDED or PARTIALLY_REFUNDED status entry
            const refundEntries = order.statusHistory
              .filter((entry: any) => 
                (entry.status === POSOrderStatus.REFUNDED || entry.status === POSOrderStatus.PARTIALLY_REFUNDED)
              );
              
            console.log(`Found ${refundEntries.length} refund status entries`);
            
            const refundEntry = refundEntries.sort((a: any, b: any) => 
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            )[0];
              
            if (refundEntry) {
              console.log('Latest refund entry:', refundEntry);
              
              if (refundEntry.notes) {
                refundNotes = refundEntry.notes;
                console.log('Found refund notes:', refundNotes);
              } else {
                console.log('Refund entry has no notes');
              }
            } else {
              console.log('No refund entries found in status history');
            }
          } else {
            console.log(`Order ${order.id} has no status history`);
          }
          
          // Calculate total from items
          const calculatedTotal = order.items.reduce((sum: number, item: any) => {
            return sum + Number(item.totalPrice || item.total || (item.quantity * item.unitPrice)) || 0;
          }, 0);
          
          // Apply any discounts
          const discountedTotal = order.couponDiscount ? calculatedTotal - Number(order.couponDiscount) : calculatedTotal;
          
          // Add delivery charge
          const finalTotal = discountedTotal + Number(order.deliveryCharge || 0);

          return {
            ...order,
            // Add the refund notes to the order object
            notes: (order.status === POSOrderStatus.REFUNDED || order.status === POSOrderStatus.PARTIALLY_REFUNDED)
              ? (refundNotes || order.notes || '') 
              : (order.notes || ''),
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
              totalPrice: Number(item.totalPrice || item.total || (item.quantity * item.unitPrice)) || 0
            })),
            // Assign the calculated values
            totalAmount: finalTotal,
            total: finalTotal,
            subtotal: calculatedTotal,
            paidAmount: Number(order.paidAmount) || 0,
            changeAmount: Number(order.changeAmount) || 0,
            deliveryCharge: Number(order.deliveryCharge || 0),
            // Normalize payment information
            paymentMethod: order.paymentMethod || 'CASH',
            payments: transformedPayments
          };
        });
        
        console.log('Transformed orders:', transformedOrders);

        // Apply filtering and sorting based on current sort settings
        let filteredAndSortedOrders = [...transformedOrders];

        // Filter by delivery method if sorting by pickup or delivery time
        if (sortBy === 'pickupTime') {
          filteredAndSortedOrders = filteredAndSortedOrders.filter(order => order.deliveryMethod === 'PICKUP');
        } else if (sortBy === 'deliveryTime') {
          filteredAndSortedOrders = filteredAndSortedOrders.filter(order => order.deliveryMethod === 'DELIVERY');
        }

        // Apply sorting
        filteredAndSortedOrders.sort((a: Order, b: Order) => {
          let comparison = 0;

          switch (sortBy) {
            case 'createdAt':
              comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
              break;
            case 'pickupTime':
              // Only pickup orders should reach here due to filtering above
              const aPickupTime = parseTimeSlot(a.pickupTimeSlot || '');
              const bPickupTime = parseTimeSlot(b.pickupTimeSlot || '');
              comparison = aPickupTime - bPickupTime;
              console.log(`Sorting pickup: Order ${a.orderNumber} (${a.pickupTimeSlot}) = ${aPickupTime} vs Order ${b.orderNumber} (${b.pickupTimeSlot}) = ${bPickupTime}, comparison: ${comparison}`);
              break;
            case 'deliveryTime':
              // Only delivery orders should reach here due to filtering above
              const aDeliveryTime = parseTimeSlot(a.deliveryTimeSlot || '');
              const bDeliveryTime = parseTimeSlot(b.deliveryTimeSlot || '');
              comparison = aDeliveryTime - bDeliveryTime;
              console.log(`Sorting delivery: Order ${a.orderNumber} (${a.deliveryTimeSlot}) = ${aDeliveryTime} vs Order ${b.orderNumber} (${b.deliveryTimeSlot}) = ${bDeliveryTime}, comparison: ${comparison}`);
              break;
          }

          const result = sortOrder === 'asc' ? comparison : -comparison;
          return result;
        });

        // Debug: Log the final sorted order
        if (sortBy === 'pickupTime' || sortBy === 'deliveryTime') {
          console.log(`Final sorted order (${sortBy}, ${sortOrder}):`);
          filteredAndSortedOrders.forEach((order, index) => {
            const timeSlot = sortBy === 'pickupTime' ? order.pickupTimeSlot : order.deliveryTimeSlot;
            const timeValue = parseTimeSlot(timeSlot || '');
            console.log(`${index + 1}. Order ${order.orderNumber}: ${timeSlot} (${timeValue} minutes)`);
          });
        }

        setOrders(filteredAndSortedOrders);
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
      console.log('Reordering order:', order);
      
      // Format cart items to match the POS cart structure with all details preserved
      const cartItems = order.items.map((item: any) => {
        // Process custom images if available - ensure they are properly formatted for display
        const customImages = [];
        
        // Handle customImages array if it exists
        if (item.customImages && Array.isArray(item.customImages)) {
          item.customImages.forEach((img: any) => {
            if (img && img.url) {
              // Ensure image URLs are properly formatted
              const imgUrl = img.url.startsWith('http') ? img.url : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${img.url.startsWith('/') ? '' : '/'}${img.url}`;
              
              customImages.push({
                id: nanoid(),
                url: imgUrl,
                previewUrl: imgUrl,
                comment: img.comment || ''
              });
            }
          });
        }
        
        // Handle images array if customImages doesn't exist
        if ((!customImages.length) && item.images && Array.isArray(item.images)) {
          item.images.forEach((img: any) => {
            if (img && img.url) {
              // Ensure image URLs are properly formatted
              const imgUrl = img.url.startsWith('http') ? img.url : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${img.url.startsWith('/') ? '' : '/'}${img.url}`;
              
              customImages.push({
                id: nanoid(),
                url: imgUrl,
                previewUrl: imgUrl,
                comment: ''
              });
            }
          });
        }
        
        // Process variations properly
        const selectedVariations = [];
        const variations = item.selectedVariations || item.variations || [];
        
        if (Array.isArray(variations)) {
          variations.forEach((v: any) => {
            if (typeof v === 'object' && v !== null) {
              selectedVariations.push({
                id: v.id || nanoid(),
                type: (v.type || v.name || v.variationType || '').toString(),
                value: (v.value || v.variationValue || '').toString(),
                priceAdjustment: Number(v.priceAdjustment) || Number(v.price) || 0
              });
            } else if (v) {
              // Handle string variations
              selectedVariations.push({
                id: nanoid(),
                type: 'Option',
                value: String(v),
                priceAdjustment: 0
              });
            }
          });
        }
        
        // Create a properly formatted cart item with all details
        return {
          id: nanoid(),
          product: {
            id: item.productId || '',
            name: item.productName || item.name || 'Unknown Product',
            basePrice: parseFloat(String(item.unitPrice || (item.totalPrice / item.quantity))) || 0,
            requiresKitchen: item.requiresKitchen || false,
            requiresDesign: item.requiresDesign || false,
            allowCustomImages: true, // Enable custom images for reordered items
            status: 'ACTIVE',
            // Ensure product images are properly formatted
            images: Array.isArray(item.images) ? item.images.map((img: any) => {
              if (img && img.url) {
                return {
                  ...img,
                  url: img.url.startsWith('http') ? img.url : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${img.url.startsWith('/') ? '' : '/'}${img.url}`
                };
              }
              return img;
            }) : [],
            allowCustomPrice: false,
            categoryId: item.categoryId || '',
            sku: item.sku || '',
            barcode: item.barcode || ''
          },
          quantity: parseInt(String(item.quantity)) || 1,
          selectedVariations: selectedVariations,
          customImages: customImages,
          notes: item.notes || item.kitchenNotes || '',
          totalPrice: parseFloat(String(item.totalPrice)) || 0
        };
      });
      
      // Save cart items to localStorage
      localStorage.setItem('pos-cart', JSON.stringify(cartItems));
      
      // Create checkout details object with customer info and delivery/pickup details
      const checkoutDetails = {
        customerDetails: {
          name: order.customerName || '',
          phone: order.customerPhone || '',
          email: order.customerEmail || ''
        },
        deliveryMethod: order.deliveryMethod || 'PICKUP',
        deliveryDetails: order.deliveryMethod === 'DELIVERY' ? {
          date: order.deliveryDate || '',
          timeSlot: order.deliveryTimeSlot || '',
          instructions: order.deliveryInstructions || '',
          streetAddress: order.streetAddress || '',
          apartment: order.apartment || '',
          emirate: order.emirate || '',
          city: order.city || '',
          charge: parseFloat(String(order.deliveryCharge)) || 0
        } : undefined,
        pickupDetails: order.deliveryMethod === 'PICKUP' ? {
          date: order.pickupDate || '',
          timeSlot: order.pickupTimeSlot || ''
        } : undefined,
        giftDetails: order.isGift ? {
          isGift: true,
          recipientName: order.giftRecipientName || '',
          recipientPhone: order.giftRecipientPhone || '',
          message: order.giftMessage || '',
          note: '',
          cashAmount: parseFloat(String(order.giftCashAmount)) || 0,
          includeCash: parseFloat(String(order.giftCashAmount)) > 0
        } : undefined,
        // Add a flag to indicate this is a reorder and checkout should open automatically
        isReorder: true
      };
      
      // Save checkout details to localStorage
      localStorage.setItem('pos-checkout-details', JSON.stringify(checkoutDetails));
      
      toast.success('Order replicated - proceeding to checkout');
      
      // Add a URL parameter to indicate that checkout should open automatically
      router.push('/pos?checkout=true');
    } catch (error) {
      console.error('Error handling reorder:', error);
      toast.error('Failed to process reorder');
    }
  };

  const handleRefresh = async () => {
    await fetchOrders();
    await fetchAllOrdersForCounts();
    toast.success('Orders refreshed');
  };

  const handlePrintReceipt = (order: Order) => {
    console.log('Printing order:', order); // Debug log
    setSelectedOrder(order);
  };

  const handleCancelOrder = async (orderId: string) => {
    console.log('=== CANCEL ORDER STARTED ===');
    console.log('Order ID:', orderId);
    console.log('Is Super Admin:', isSuperAdmin);
    console.log('User Role:', userRole);

    try {
      if (!isSuperAdmin) {
        console.log('User is not super admin, showing error');
        toast.error('Only Super Admins can cancel orders');
        setShowCancelConfirm(null);
        return;
      }

      // Get the current order to check its status and payments
      const orderToCancel = orders.find(order => order.id === orderId);

      if (!orderToCancel) {
        console.error('Order not found in orders list');
        throw new Error('Order not found');
      }

      console.log('Found order to cancel:', {
        id: orderToCancel.id,
        status: orderToCancel.status,
        paymentsCount: orderToCancel.payments?.length || 0,
        payments: orderToCancel.payments
      });

      // Use a unified approach for cancelling orders regardless of status
      console.log(`Cancelling order with status: ${orderToCancel.status}`);

      // Use the cancelOrder API which handles the order status update
      console.log('Calling cancelOrder API...');
      const success = await apiMethods.pos.cancelOrder(orderId);
      console.log('Cancel order API response:', success);

      if (success) {
        console.log('Order cancelled successfully, updating payment statuses...');
        // Update all payment statuses to CANCELLED
        if (orderToCancel.payments && orderToCancel.payments.length > 0) {
          console.log(`Updating ${orderToCancel.payments.length} payment statuses to CANCELLED`);
          for (const payment of orderToCancel.payments) {
            if (payment.id && payment.status !== POSPaymentStatus.CANCELLED) {
              try {
                console.log(`Updating payment ${payment.id} from ${payment.status} to CANCELLED`);
                const paymentResponse = await apiMethods.pos.updatePaymentStatus(orderId, payment.id, POSPaymentStatus.CANCELLED);
                console.log(`Payment ${payment.id} update response:`, paymentResponse);

                if (paymentResponse.success) {
                  console.log(`✅ Payment ${payment.id} successfully updated to CANCELLED`);
                } else {
                  console.error(`❌ Failed to update payment ${payment.id}:`, paymentResponse);
                }
              } catch (paymentError) {
                console.error('Error updating payment status to cancelled:', paymentError);
                // Don't fail the entire operation if payment status update fails
              }
            } else {
              console.log(`Skipping payment ${payment.id} - already CANCELLED or no ID`);
            }
          }
        }
        console.log('All payment statuses updated, showing success message');
        toast.success('Order cancelled successfully');
        setShowCancelConfirm(null);
        fetchOrders();
      } else {
        console.error('Cancel order API returned false');
        throw new Error('Failed to cancel order - API returned false');
      }
    } catch (error: any) {
      console.error('Error cancelling order:', error);

      // Check if it's a permission error
      if (error.message?.includes('super admin') || error.message?.includes('Super Admin')) {
        toast.error('Only Super Admins can cancel orders');
      } else {
        toast.error(error.message || 'Failed to cancel order');
      }

      setShowCancelConfirm(null);
    }
  };

  const handleRefundOrder = async (orderId: string) => {
    try {
      // Close the modal first
      setShowRefundModal(null);

      const userEmail = Cookies.get('user-email') || 'Unknown';

      // Format notes with user email
      const formattedNotes = refundNotes
        ? `Refunded by ${userEmail}: ${refundNotes}`
        : `Refunded by ${userEmail}`;

      console.log('Starting refund process for order:', orderId);

      // Show processing notification
      sonnerToast.loading('Processing refund...', {
        id: `refund-${orderId}`,
        description: 'Please wait while we process the refund',
      });

      // Get the order first to access its payments
      const orderResponse = await apiMethods.pos.getOrderById(orderId);
      if (!orderResponse.success) {
        console.error('Failed to fetch order details:', orderResponse);
        throw new Error(orderResponse.message || 'Failed to fetch order details');
      }

      const order = orderResponse.data;
      console.log('Order details for refund:', order);

      // Check if order is completed and cancel it first
      if (order.status === POSOrderStatus.COMPLETED) {
        console.log('Order is completed, cancelling first...');
        const cancelResponse = await apiMethods.pos.updateOrderStatus(orderId, {
          status: POSOrderStatus.CANCELLED,
          notes: 'Order cancelled before refund by POS user'
        });

        if (!cancelResponse.success) {
          console.error('Failed to cancel order before refund:', cancelResponse);
          throw new Error(cancelResponse.message || 'Failed to cancel order before refund');
        }

        console.log('Order cancelled successfully, waiting before refund...');
        // Wait a moment for the backend to process the cancellation
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Now refund the order
      console.log('Updating order status to REFUNDED...');
      const response = await apiMethods.pos.updateOrderStatus(orderId, {
        status: POSOrderStatus.REFUNDED,
        notes: formattedNotes
      });

      console.log('Order status update response:', response);

      if (response.success) {
        console.log('Order status updated successfully, updating payment statuses...');

        // Update loading message
        sonnerToast.loading('Updating payment statuses...', {
          id: `refund-${orderId}`,
          description: 'Finalizing refund process',
        });

        // Update all payment statuses to REFUNDED
        if (order.payments && order.payments.length > 0) {
          console.log(`Updating ${order.payments.length} payment statuses to REFUNDED`);
          for (const payment of order.payments) {
            if (payment.id && payment.status !== POSPaymentStatus.REFUNDED) {
              try {
                console.log(`Updating payment ${payment.id} status to REFUNDED`);
                const paymentUpdateResponse = await apiMethods.pos.updatePaymentStatus(orderId, payment.id, POSPaymentStatus.REFUNDED);
                console.log(`Payment ${payment.id} update response:`, paymentUpdateResponse);

                if (!paymentUpdateResponse.success) {
                  console.warn(`Failed to update payment ${payment.id} status:`, paymentUpdateResponse);
                }
              } catch (paymentError) {
                console.error('Error updating payment status:', paymentError);
                // Don't fail the entire operation if payment status update fails
              }
            }
          }
        }

        // Dismiss loading toast and show success
        sonnerToast.dismiss(`refund-${orderId}`);
        sonnerToast.success('Order Refunded Successfully', {
          description: `Order #${order.orderNumber || orderId} has been marked as refunded`,
          duration: 5000,
        });
        setRefundNotes(''); // Clear notes
        fetchOrders(); // Refresh orders list
      } else {
        console.error('Failed to update order status:', response);
        throw new Error(response.message || 'Failed to mark order as refunded');
      }
    } catch (error: any) {
      console.error('Error marking order as refunded:', error);

      // Dismiss loading toast
      sonnerToast.dismiss(`refund-${orderId}`);

      // Check if it's a permission error
      if (error.message?.includes('super admin') || error.message?.includes('Super Admin')) {
        sonnerToast.error('Permission Denied', {
          description: 'Only Super Admins can refund orders',
          duration: 5000,
        });
      } else {
        sonnerToast.error('Refund Failed', {
          description: error.message || 'Failed to mark order as refunded',
          duration: 5000,
        });
      }
    }
  };

  const handlePartialRefund = async (orderId: string) => {
    try {
      // Validate refund amount
      const amount = parseFloat(partialRefundAmount);
      if (isNaN(amount) || amount <= 0) {
        sonnerToast.error('Invalid Amount', {
          description: 'Please enter a valid refund amount greater than 0',
          duration: 4000,
        });
        return;
      }

      const userEmail = Cookies.get('user-email') || 'Unknown';

      // Format notes with user email and amount
      const formattedNotes = partialRefundNotes
        ? `Refunded by ${userEmail} (Amount: AED ${amount}): ${partialRefundNotes}`
        : `Refunded by ${userEmail} (Amount: AED ${amount})`;

      console.log('Starting partial refund process for order:', orderId, 'amount:', amount);

      // Show processing notification
      sonnerToast.loading('Processing partial refund...', {
        id: `partial-refund-${orderId}`,
        description: `Processing AED ${amount} refund`,
      });

      // Get the order first to access its payments
      const orderResponse = await apiMethods.pos.getOrderById(orderId);
      if (!orderResponse.success) {
        console.error('Failed to fetch order details:', orderResponse);
        throw new Error(orderResponse.message || 'Failed to fetch order details');
      }

      const order = orderResponse.data;
      console.log('Order details for partial refund:', order);

      // Check if order is completed and cancel it first
      if (order.status === POSOrderStatus.COMPLETED) {
        console.log('Order is completed, cancelling first...');
        const cancelResponse = await apiMethods.pos.updateOrderStatus(orderId, {
          status: POSOrderStatus.CANCELLED,
          notes: 'Order cancelled before partial refund by POS user'
        });

        if (!cancelResponse.success) {
          console.error('Failed to cancel order before partial refund:', cancelResponse);
          throw new Error(cancelResponse.message || 'Failed to cancel order before partial refund');
        }

        console.log('Order cancelled successfully, waiting before partial refund...');
        // Wait a moment for the backend to process the cancellation
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Now partially refund the order
      console.log('Updating order status to PARTIALLY_REFUNDED...');
      const response = await apiMethods.pos.updateOrderStatus(orderId, {
        status: POSOrderStatus.PARTIALLY_REFUNDED,
        notes: formattedNotes,
        partialRefundAmount: amount
      });

      console.log('Partial refund order status update response:', response);

      if (response.success) {
        console.log('Order status updated successfully, updating payment statuses...');

        // Update loading message
        sonnerToast.loading('Updating payment statuses...', {
          id: `partial-refund-${orderId}`,
          description: 'Finalizing partial refund process',
        });

        // Update all payment statuses to PARTIALLY_REFUNDED
        if (order.payments && order.payments.length > 0) {
          console.log(`Updating ${order.payments.length} payment statuses to PARTIALLY_REFUNDED`);
          for (const payment of order.payments) {
            if (payment.id && payment.status !== POSPaymentStatus.PARTIALLY_REFUNDED) {
              try {
                console.log(`Updating payment ${payment.id} status to PARTIALLY_REFUNDED`);
                const paymentUpdateResponse = await apiMethods.pos.updatePaymentStatus(orderId, payment.id, POSPaymentStatus.PARTIALLY_REFUNDED);
                console.log(`Payment ${payment.id} update response:`, paymentUpdateResponse);

                if (!paymentUpdateResponse.success) {
                  console.warn(`Failed to update payment ${payment.id} status:`, paymentUpdateResponse);
                }
              } catch (paymentError) {
                console.error('Error updating payment status:', paymentError);
                // Don't fail the entire operation if payment status update fails
              }
            }
          }
        }

        // Dismiss loading toast and show success
        sonnerToast.dismiss(`partial-refund-${orderId}`);
        sonnerToast.success('Partial Refund Processed', {
          description: `Order #${order.orderNumber || orderId} has been partially refunded (AED ${amount})`,
          duration: 5000,
        });
        setShowPartialRefundModal(null);
        setPartialRefundAmount('');
        setPartialRefundNotes(''); // Clear notes
        fetchOrders(); // Refresh orders list
      } else {
        throw new Error(response.message || 'Failed to mark order as partially refunded');
      }
    } catch (error: any) {
      console.error('Error marking order as partially refunded:', error);

      // Dismiss loading toast
      sonnerToast.dismiss(`partial-refund-${orderId}`);

      // Check if it's a permission error
      if (error.message?.includes('super admin') || error.message?.includes('Super Admin')) {
        sonnerToast.error('Permission Denied', {
          description: 'Only Super Admins can refund orders',
          duration: 5000,
        });
      } else {
        sonnerToast.error('Partial Refund Failed', {
          description: error.message || 'Failed to mark order as partially refunded',
          duration: 5000,
        });
      }
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

  const handlePrintGiftReceipt = (order: Order) => {
    console.log('Opening gift receipt for printing:', order); // Debug log
    setSelectedGiftOrder(order);
  };

  const calculateRemainingAmount = (order: Order) => {
    // Get the final total after coupon discount
    const finalTotal = order.totalAmount - (order.couponDiscount || 0);
    
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
      
      // If order has PENDING_PAYMENT status but no pending payments, use the final total
      if (order.status === POSOrderStatus.PENDING_PAYMENT) {
        return finalTotal;
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
    
    // Check if there are any pay later payments (regardless of status)
    // This ensures all PAY_LATER orders show the Pay Now button
    const hasPayLaterPayment = order.payments?.some(p => p.method === POSPaymentMethod.PAY_LATER);
    
    // Check if there are any pay later payments that are still pending
    const hasPayLaterPending = order.payments?.some(p => 
      p.method === POSPaymentMethod.PAY_LATER && p.status === POSPaymentStatus.PENDING
    );
    
    // Check if the order status indicates pending payment
    const hasPendingPaymentStatus2 = order.status === POSOrderStatus.PENDING_PAYMENT;
    
    // Calculate total paid amount
    const totalPaid = order.payments?.reduce((sum, payment) => {
      // Only count fully paid payments that are not PAY_LATER
      if (payment.status === POSPaymentStatus.FULLY_PAID && payment.method !== POSPaymentMethod.PAY_LATER) {
        return sum + payment.amount;
      }
      return sum;
    }, 0) || 0;
    
    // Check if the total paid amount is less than the order total
    const hasRemainingBalance = Math.abs(totalPaid - order.totalAmount) > 0.01;
    
    console.log(`Order ${order.orderNumber} payment check:`, {
      hasPendingPaymentStatus,
      hasPayLaterPayment,
      hasPayLaterPending,
      hasPendingPaymentStatus2,
      totalPaid,
      orderTotal: order.totalAmount,
      hasRemainingBalance
    });
    
    // For the filter dropdown, we need to match the exact paymentStatus value that's sent to the API
    // When selectedPaymentStatus is 'PENDING', we need to return true for orders with pending payments
    if (selectedPaymentStatus === POSPaymentStatus.PENDING) {
      // Return true if any payment has PENDING status
      return hasPendingPaymentStatus || hasPayLaterPending;
    }
    
    // For other UI elements (like showing the Pay Now button), use the original logic
    return (hasPendingPaymentStatus || hasPayLaterPayment || hasPayLaterPending || hasPendingPaymentStatus2) && hasRemainingBalance;
  };

  const isFullyPaid = (order: Order) => {
    // If any payment has PENDING status, the order is not fully paid regardless of amount
    if (hasPendingPayment(order)) {
      return false;
    }
    
    const paidAmount = order.payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
    const finalTotal = order.totalAmount - (order.couponDiscount || 0);
    return Math.max(0, finalTotal - paidAmount) === 0; // Using a small epsilon for floating point comparison
  };

  const handlePaymentComplete = async () => {
    await fetchOrders();
    setSelectedOrderForPayment(null);
  };

  const handlePickupDetailsUpdated = async () => {
    await fetchOrders();
    setSelectedOrderForPickupUpdate(null);
  };



  const handleMarkAsCompleted = async (orderId: string) => {
    try {
      // Find the order to validate it exists and is pending
      const order = orders.find(o => o.id === orderId);
      if (!order) {
        toast.error('Order not found');
        return;
      }

      if (order.status !== 'PENDING') {
        toast.error('Only pending orders can be marked as completed');
        return;
      }

      const result = await apiMethods.pos.updateOrderStatus(orderId, {
        status: 'COMPLETED',
        notes: 'Order marked as completed from POS'
      });

      if (result.success) {
        toast.success('Order marked as completed successfully');
        // Refresh the orders list
        fetchOrders();
      } else {
        toast.error(result.message || 'Failed to mark order as completed');
      }
    } catch (error) {
      console.error('Error marking order as completed:', error);
      toast.error('Failed to mark order as completed');
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
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-6 gap-4">
            <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          </div>
          
          {/* Enhanced Filters Section */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
            {/* Search and Quick Filter Presets */}
            <div className="mb-4 pb-4 border-b border-gray-100">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Quick Filters</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setStartDate(format(new Date(), 'yyyy-MM-dd'));
                        setEndDate('');
                        setSelectedOrderStatus('all');
                        setSelectedPaymentStatus('all');
                        setPickupDate('');
                        setDeliveryDate('');
                      }}
                      className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      Today's Orders
                    </button>
                    <button
                      onClick={() => {
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        setStartDate(format(yesterday, 'yyyy-MM-dd'));
                        setEndDate(format(yesterday, 'yyyy-MM-dd'));
                        setSelectedOrderStatus('all');
                        setSelectedPaymentStatus('all');
                        setPickupDate('');
                        setDeliveryDate('');
                      }}
                      className="px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      Yesterday
                    </button>
                    <button
                      onClick={() => {
                        const weekAgo = new Date();
                        weekAgo.setDate(weekAgo.getDate() - 7);
                        setStartDate(format(weekAgo, 'yyyy-MM-dd'));
                        setEndDate(format(new Date(), 'yyyy-MM-dd'));
                        setSelectedOrderStatus('all');
                        setSelectedPaymentStatus('all');
                        setPickupDate('');
                        setDeliveryDate('');
                      }}
                      className="px-3 py-1.5 text-xs font-medium bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
                    >
                      Last 7 Days
                    </button>
                    <button
                      onClick={() => {
                        setSelectedOrderStatus('all');
                        setSelectedPaymentStatus('PENDING');
                        setStartDate('');
                        setEndDate('');
                        setPickupDate('');
                        setDeliveryDate('');
                      }}
                      className="px-3 py-1.5 text-xs font-medium bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors"
                    >
                      Pending Payments
                    </button>
                    <button
                      onClick={() => {
                        setSelectedOrderStatus('COMPLETED');
                        setSelectedPaymentStatus('all');
                        setStartDate('');
                        setEndDate('');
                        setPickupDate('');
                        setDeliveryDate('');
                      }}
                      className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors"
                    >
                      Completed Orders
                    </button>
                  </div>
                </div>

                {/* Search Section */}
                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                  {/* Search Type Selector */}
                  <div className="w-full sm:w-[180px]">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Search</label>
                    <select
                      value={searchType}
                      onChange={(e) => setSearchType(e.target.value as 'all' | 'orderNumber' | 'customerPhone' | 'customerName')}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm shadow-sm transition-all duration-200 bg-white"
                    >
                      <option value="orderNumber">Order Number</option>
                      <option value="customerPhone">Customer Phone</option>
                      <option value="customerName">Customer Name</option>
                      <option value="all">All Fields</option>
                    </select>
                  </div>

                  {/* Search Input */}
                  <div className="relative w-full sm:w-[300px]">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">&nbsp;</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={
                          searchType === 'orderNumber' ? 'Search by order number...' :
                          searchType === 'customerPhone' ? 'Search by customer phone...' :
                          searchType === 'customerName' ? 'Search by customer name...' :
                          'Search by order number, customer name, phone, or email...'
                        }
                        className="w-full pl-10 pr-8 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm shadow-sm transition-all duration-200 bg-white"
                      />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm('')}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* First Row: Main Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-end">

              {/* Order Status Filter */}
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-2">Order Status</label>
                <div className="relative">
                  <select
                    value={selectedOrderStatus}
                    onChange={(e) => setSelectedOrderStatus(e.target.value)}
                    className={`w-full px-4 py-2.5 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white transition-all duration-200 ${
                      selectedOrderStatus !== 'all'
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <option value="all">All Status ({allOrdersForCounts.length})</option>
                    {Object.entries(orderStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label} ({allOrdersForCounts.filter(order => order.status === value).length})
                      </option>
                    ))}
                  </select>
                  {selectedOrderStatus !== 'all' && (
                    <button
                      onClick={() => setSelectedOrderStatus('all')}
                      className="absolute right-8 top-1/2 transform -translate-y-1/2 text-blue-500 hover:text-blue-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Payment Status Filter */}
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-2">Payment Status</label>
                <div className="relative">
                  <select
                    value={selectedPaymentStatus}
                    onChange={(e) => setSelectedPaymentStatus(e.target.value)}
                    className={`w-full px-4 py-2.5 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white transition-all duration-200 ${
                      selectedPaymentStatus !== 'all'
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <option value="all">All Payments ({allOrdersForCounts.length})</option>
                    {Object.entries(paymentStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label} ({allOrdersForCounts.filter(order => {
                          // Check if any payment has this status
                          if (value === 'FULLY_PAID') {
                            return isFullyPaid(order);
                          } else if (value === 'PARTIALLY_PAID') {
                            return hasPartialPayment(order);
                          } else if (value === 'PENDING') {
                            return hasPendingPayment(order);
                          } else if (value === 'REFUNDED') {
                            return order.payments?.some(p => p.status === POSPaymentStatus.REFUNDED);
                          } else if (value === 'PARTIALLY_REFUNDED') {
                            return order.payments?.some(p => p.status === POSPaymentStatus.PARTIALLY_REFUNDED);
                          } else if (value === 'CANCELLED') {
                            return order.payments?.some(p => p.status === POSPaymentStatus.CANCELLED);
                          }
                          return false;
                        }).length})
                      </option>
                    ))}
                  </select>
                  {selectedPaymentStatus !== 'all' && (
                    <button
                      onClick={() => setSelectedPaymentStatus('all')}
                      className="absolute right-8 top-1/2 transform -translate-y-1/2 text-green-500 hover:text-green-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

            {/* Order Date Filter */}
            <div className="relative">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Order Date</label>
              <button
                onClick={() => setShowDateFilter(!showDateFilter)}
                className={`w-full px-4 py-2.5 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm flex items-center justify-between transition-all duration-200 ${
                  startDate || endDate
                    ? 'border-purple-300 bg-purple-50 text-purple-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="truncate">
                  {startDate ? `${format(parse(startDate, 'yyyy-MM-dd', new Date()), 'PP')}${endDate ? ` - ${format(parse(endDate, 'yyyy-MM-dd', new Date()), 'PP')}` : ''}` : 'Select Date Range'}
                </span>
                <div className="flex items-center gap-1">
                  {(startDate || endDate) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setStartDate('');
                        setEndDate('');
                      }}
                      className="text-purple-500 hover:text-purple-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <Calendar className="h-4 w-4 text-gray-400" />
                </div>
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
              <label className="text-sm font-medium text-gray-700 mb-2 block">Pickup Date</label>
              <button
                onClick={() => setShowPickupDateFilter(!showPickupDateFilter)}
                className={`w-full px-4 py-2.5 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm flex items-center justify-between transition-all duration-200 ${
                  pickupDate
                    ? 'border-green-300 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="truncate">
                  {pickupDate ? format(parse(pickupDate, 'yyyy-MM-dd', new Date()), 'PP') : 'Select Pickup Date'}
                </span>
                <div className="flex items-center gap-1">
                  {pickupDate && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPickupDate('');
                      }}
                      className="text-green-500 hover:text-green-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <Store className="h-4 w-4 text-gray-400" />
                </div>
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
              <label className="text-sm font-medium text-gray-700 mb-2 block">Delivery Date</label>
              <button
                onClick={() => setShowDeliveryDateFilter(!showDeliveryDateFilter)}
                className={`w-full px-4 py-2.5 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm flex items-center justify-between transition-all duration-200 ${
                  deliveryDate
                    ? 'border-orange-300 bg-orange-50 text-orange-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="truncate">
                  {deliveryDate ? format(parse(deliveryDate, 'yyyy-MM-dd', new Date()), 'PP') : 'Select Delivery Date'}
                </span>
                <div className="flex items-center gap-1">
                  {deliveryDate && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeliveryDate('');
                      }}
                      className="text-orange-500 hover:text-orange-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <Truck className="h-4 w-4 text-gray-400" />
                </div>
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
            </div>

            {/* Second Row: Sort By and Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end mt-4">

            {/* Sort By Controls */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleSort('createdAt')}
                  className={`px-3 py-2 text-sm font-medium rounded-lg border-2 transition-all duration-200 flex items-center gap-1 ${
                    sortBy === 'createdAt'
                      ? 'bg-blue-500 text-white border-blue-500 shadow-md'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <Clock className="h-4 w-4" />
                  Created
                  {sortBy === 'createdAt' && (
                    sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </button>

                <button
                  onClick={() => handleSort('pickupTime')}
                  className={`px-3 py-2 text-sm font-medium rounded-lg border-2 transition-all duration-200 flex items-center gap-1 ${
                    sortBy === 'pickupTime'
                      ? 'bg-green-500 text-white border-green-500 shadow-md'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-green-300 hover:bg-green-50'
                  }`}
                  title="Show only pickup orders sorted by pickup time"
                >
                  <Store className="h-4 w-4" />
                  Pickup Orders
                  {sortBy === 'pickupTime' && (
                    sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </button>

                <button
                  onClick={() => handleSort('deliveryTime')}
                  className={`px-3 py-2 text-sm font-medium rounded-lg border-2 transition-all duration-200 flex items-center gap-1 ${
                    sortBy === 'deliveryTime'
                      ? 'bg-orange-500 text-white border-orange-500 shadow-md'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                  }`}
                  title="Show only delivery orders sorted by delivery time"
                >
                  <Truck className="h-4 w-4" />
                  Delivery Orders
                  {sortBy === 'deliveryTime' && (
                    sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-2">Actions</label>
              <div className="flex flex-wrap gap-2">
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
                  className="px-4 py-2.5 text-sm font-medium text-red-700 bg-red-50 border-2 border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 flex items-center gap-2 transition-all duration-200"
                >
                  <X className="h-4 w-4" />
                  Reset All
                </button>

                <button
                  onClick={handleRefresh}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-50 border-2 border-gray-200 rounded-lg hover:bg-gray-100 hover:border-gray-300 flex items-center gap-2 transition-all duration-200"
                >
                  <RotateCcw className="h-4 w-4" />
                  Refresh
                </button>
              </div>
            </div>
            </div>

            {/* Active Filters Summary */}
            {(searchTerm || selectedOrderStatus !== 'all' || selectedPaymentStatus !== 'all' || startDate || endDate || pickupDate || deliveryDate) && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">Active Filters:</span>

                  {searchTerm && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      Search: "{searchTerm}"
                      <button onClick={() => setSearchTerm('')} className="text-blue-600 hover:text-blue-800">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}

                  {selectedOrderStatus !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                      Status: {orderStatusLabels[selectedOrderStatus as keyof typeof orderStatusLabels]}
                      <button onClick={() => setSelectedOrderStatus('all')} className="text-purple-600 hover:text-purple-800">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}

                  {selectedPaymentStatus !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                      Payment: {paymentStatusLabels[selectedPaymentStatus as keyof typeof paymentStatusLabels]}
                      <button onClick={() => setSelectedPaymentStatus('all')} className="text-green-600 hover:text-green-800">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}

                  {(startDate || endDate) && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full">
                      Date: {startDate ? `${format(parse(startDate, 'yyyy-MM-dd', new Date()), 'PP')}${endDate ? ` - ${format(parse(endDate, 'yyyy-MM-dd', new Date()), 'PP')}` : ''}` : 'Select Date Range'}
                      <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-indigo-600 hover:text-indigo-800">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}

                  {pickupDate && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-800 text-xs rounded-full">
                      Pickup: {format(parse(pickupDate, 'yyyy-MM-dd', new Date()), 'PP')}
                      <button onClick={() => setPickupDate('')} className="text-emerald-600 hover:text-emerald-800">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}

                  {deliveryDate && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                      Delivery: {format(parse(deliveryDate, 'yyyy-MM-dd', new Date()), 'PP')}
                      <button onClick={() => setDeliveryDate('')} className="text-orange-600 hover:text-orange-800">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                </div>
              </div>
            )}
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
          <div className="flex flex-wrap -mx-3 content-start">
            {orders
              .filter(order => {
                // Note: Search term filtering is now handled by the API

                // Apply date filtering on the client side as well for extra safety
                if (startDate) {
                  try {
                    const orderDate = new Date(order.createdAt);
                    const filterStartDate = parse(startDate, 'yyyy-MM-dd', new Date());
                    const filterStartDay = startOfDay(filterStartDate);

                    if (endDate) {
                      // Date range filtering
                      const filterEndDate = parse(endDate, 'yyyy-MM-dd', new Date());
                      const filterEndDay = endOfDay(filterEndDate);

                      // If order date is outside the range, filter it out
                      if (isBefore(orderDate, filterStartDay) || isAfter(orderDate, filterEndDay)) {
                        return false;
                      }
                    } else {
                      // Single date filtering - only show orders from the exact date
                      const filterEndDay = endOfDay(filterStartDate);

                      // If order date is not within the single day, filter it out
                      if (isBefore(orderDate, filterStartDay) || isAfter(orderDate, filterEndDay)) {
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
              <div key={order.id} className="w-full md:w-1/2 px-3 mb-6">
                <div className="bg-white rounded-lg shadow-sm p-6 h-full">
                  <div className="flex flex-col">
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
                        <p className="text-sm break-words overflow-hidden">Customer: {order.customerName}</p>
                        <p className="text-sm break-words overflow-hidden">Phone: {order.customerPhone}</p>
                        {order.customerEmail && <p className="break-words overflow-hidden">Email: {order.customerEmail}</p>}
                        <p>Date: {format(new Date(order.createdAt), 'PPpp')}</p>
                        
                        {/* Display refund status */}
                        {order.status === POSOrderStatus.REFUNDED && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="font-medium text-red-600">Status: Fully Refunded</p>
                            {order.notes && (
                              <div className="bg-red-50 p-2 rounded-md mt-1 border border-red-200">
                                <p className="text-red-700 text-sm">
                                  <span className="font-medium">Refund Notes:</span> {order.notes}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                        {order.status === POSOrderStatus.PARTIALLY_REFUNDED && order.partialRefundAmount && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="font-medium text-orange-600">
                              Status: Partially Refunded (AED {order.partialRefundAmount.toFixed(2)})
                            </p>
                            {order.notes && (
                              <div className="bg-orange-50 p-2 rounded-md mt-1 border border-orange-200">
                                <p className="text-orange-700 text-sm">
                                  <span className="font-medium">Refund Notes:</span> {order.notes}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Delivery/Pickup Details */}
                        {order.deliveryMethod === 'DELIVERY' ? (
                          <>
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <h4 className="font-semibold text-gray-700">Delivery Details:</h4>
                              {order.deliveryMethod === 'DELIVERY' && order.deliveryDate && order.deliveryTimeSlot && (
                                <p className="text-sm break-words">Delivery Date & Time: {format(new Date(order.deliveryDate), 'PP')} - {order.deliveryTimeSlot}</p>
                              )}
                              {order.streetAddress && (
                                <div className="mt-1">
                                  <p className="text-sm font-medium text-gray-600">Address:</p>
                                  <div className="text-sm break-all whitespace-pre-wrap max-w-full overflow-hidden overflow-wrap-anywhere">
                                    <p className="mb-1" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                                      {order.streetAddress}
                                    </p>
                                    {order.apartment && (
                                      <p className="text-gray-600" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                                        {order.apartment}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                              {order.emirate && (
                                <p className="text-sm break-words mt-1">Emirate: {order.emirate}</p>
                              )}
                              {order.city && (
                                <p className="text-sm break-words">City: {order.city}</p>
                              )}
                              {order.deliveryInstructions && (
                                <div className="mt-1">
                                  <p className="text-sm font-medium text-gray-600">Instructions:</p>
                                  <p className="text-sm break-words whitespace-pre-wrap">{order.deliveryInstructions}</p>
                                </div>
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
                                  className="mt-2 px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 inline-flex items-center"
                                >
                                  <Clock className="h-3 w-3 mr-1" />
                                  Change Pickup/Delivery
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
                              <p className="text-sm break-words overflow-hidden">Recipient: {order.giftRecipientName}</p>
                            )}
                            {order.giftRecipientPhone && (
                              <p className="text-sm break-words overflow-hidden">Recipient Phone: {order.giftRecipientPhone}</p>
                            )}
                            {order.giftMessage && (
                              <p className="text-sm break-words overflow-hidden">Message: "{order.giftMessage}"</p>
                            )}
                            <p className="text-sm">Gift Cash: AED {parseFloat(String(order.giftCashAmount || 0)).toFixed(2)}</p>

                            {/* Add button to update gift details */}
                            <button
                              onClick={() => setSelectedOrderForPickupUpdate(order)}
                              className="mt-2 px-3 py-1 text-xs font-medium text-pink-600 bg-pink-100 rounded-md hover:bg-pink-200 inline-flex items-center"
                            >
                              <Gift className="h-3 w-3 mr-1" />
                              Update Gift Details
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Order Items</h4>
                    <div className="space-y-2">
                      {order.items.map((item, index) => (
                        <div key={index} className="flex justify-between items-start text-sm">
                          <div className="flex-1">
                            <p className="font-medium break-words overflow-hidden">{item.productName}</p>
                            <p className="text-gray-600">Quantity: {item.quantity}</p>
                            {item.selectedVariations && item.selectedVariations.length > 0 && (
                              <div className="text-gray-600">
                                {item.selectedVariations.map((v, idx) => (
                                  <p key={idx} className="text-sm break-words overflow-hidden">
                                    {v.type}: <span className="font-medium">{v.value}</span>
                                  </p>
                                ))}
                              </div>
                            )}
                            {item.notes && (
                              <p className="text-gray-600 mt-1 break-words overflow-hidden">Notes: {item.notes}</p>
                            )}
                            {/* Custom Images Section - Always show if order has items */}
                            <div className="mt-2">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-gray-700">Custom Images:</p>
                                <button
                                  onClick={() => {
                                    setSelectedOrderItem({ orderId: order.id, item, itemIndex: index });
                                    setShowCustomImageModal(true);
                                  }}
                                  className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                >
                                  Manage Images
                                </button>
                              </div>

                              {item.customImages && item.customImages.length > 0 ? (
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
                              ) : (
                                <p className="text-sm text-gray-500 mt-1">No custom images added</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p>AED {typeof item.totalPrice === 'number' ? item.totalPrice.toFixed(2) : '0.00'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Display partial refund amount if applicable */}
                    {order.status === POSOrderStatus.PARTIALLY_REFUNDED && order.partialRefundAmount && (
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
                          {order.payments?.some(p => p.status === POSPaymentStatus.REFUNDED) && (
                            <div className="text-sm font-medium text-red-600 mb-2">
                              Status: Payment Refunded
                            </div>
                          )}
                          {order.payments?.some(p => p.status === POSPaymentStatus.PARTIALLY_REFUNDED) && (
                            <div className="text-sm font-medium text-red-600 mb-2">
                              Status: Payment Partially Refunded
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
                                      : payment.status === POSPaymentStatus.REFUNDED
                                        ? `${getPaymentMethodString(payment.method)} (Refunded)`
                                        : payment.status === POSPaymentStatus.PARTIALLY_REFUNDED
                                          ? `${getPaymentMethodString(payment.method)} (Partially Refunded)`
                                          : getPaymentMethodString(payment.method)}
                                </span>
                                
                                {/* Show payment reference if available */}
                                {payment.reference && (
                                  <span className="text-gray-500 text-xs ml-2">
                                    (Ref: {payment.reference})
                                  </span>
                                )}
                                
                                {/* For Split payments, show both payment methods and amounts */}
                                {payment.method === POSPaymentMethod.SPLIT && payment.isSplitPayment && (
                                  <div className="text-gray-600 mt-1 ml-2">
                                    {payment.splitFirstMethod && payment.splitFirstAmount && (
                                      <div>{getPaymentMethodString(payment.splitFirstMethod)}: AED {Number(payment.splitFirstAmount).toFixed(2)}</div>
                                    )}
                                    {payment.splitSecondMethod && payment.splitSecondAmount && (
                                      <div>{getPaymentMethodString(payment.splitSecondMethod)}: AED {Number(payment.splitSecondAmount).toFixed(2)}</div>
                                    )}
                                    {payment.splitFirstReference && payment.splitFirstMethod === POSPaymentMethod.CARD && (
                                      <div>Card Ref: {payment.splitFirstReference}</div>
                                    )}
                                    {payment.splitSecondReference && payment.splitSecondMethod === POSPaymentMethod.CARD && (
                                      <div>Card Ref: {payment.splitSecondReference}</div>
                                    )}
                                    {payment.splitSecondReference && payment.splitSecondMethod === POSPaymentMethod.BANK_TRANSFER && (
                                      <div>Bank Transfer Ref: {payment.splitSecondReference}</div>
                                    )}
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
                                    <div>Remaining: AED {(order.totalAmount - payment.amount).toFixed(2)}</div>
                                    {payment.reference && (
                                      <div>Reference: {payment.reference}</div>
                                    )}
                                  </div>
                                )}

                                {/* For Refunded payments, show refund status */}
                                {payment.status === POSPaymentStatus.REFUNDED && (
                                  <div className="text-red-600 mt-1 ml-2">
                                    <div>Status: Payment Refunded</div>
                                    <div>Refunded Amount: AED {payment.amount.toFixed(2)}</div>
                                  </div>
                                )}

                                {/* For Partially Refunded payments, show partial refund status */}
                                {payment.status === POSPaymentStatus.PARTIALLY_REFUNDED && (
                                  <div className="text-red-600 mt-1 ml-2">
                                    <div>Status: Partially Refunded</div>
                                    <div>Original Amount: AED {payment.amount.toFixed(2)}</div>
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
                                <span>AED {(order.totalAmount - (order.payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0)).toFixed(2)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-3 pt-2 border-t border-gray-200">
                      <h4 className="font-medium text-gray-700 mb-2">Order Summary:</h4>
                      <div className="space-y-1">
                        {/* Always show subtotal */}
                        <div className="flex justify-between text-sm">
                          <span>Subtotal:</span>
                          <span>AED {order.subtotal?.toFixed(2) || order.totalAmount?.toFixed(2) || '0.00'}</span>
                        </div>
                        
                        {/* Show coupon discount if available */}
                        {order.couponDiscount > 0 && order.couponCode && (
                          <div className="flex justify-between text-sm text-green-600">
                            <span>Coupon Discount ({order.couponCode}):</span>
                            <span>-AED {order.couponDiscount.toFixed(2)}</span>
                          </div>
                        )}
                        {order.couponDiscount > 0 && !order.couponCode && (
                          <div className="flex justify-between text-sm text-green-600">
                            <span>Discount:</span>
                            <span>-AED {order.couponDiscount.toFixed(2)}</span>
                          </div>
                        )}
                        {/* For backward compatibility with older orders */}
                        {!order.couponDiscount && (order as any).metadata?.discount > 0 && (
                          <div className="flex justify-between text-sm text-green-600">
                            <span>
                              {(order as any).metadata?.coupon?.code ? 
                                `Coupon Discount (${(order as any).metadata.coupon.code})` : 
                                'Discount'}
                            </span>
                            <span>-AED {(order as any).metadata.discount.toFixed(2)}</span>
                          </div>
                        )}
                        {!order.couponDiscount && !(order as any).metadata?.discount && (order as any).metadata?.coupon?.discount > 0 && (
                          <div className="flex justify-between text-sm text-green-600">
                            <span>
                              {(order as any).metadata?.coupon?.code ? 
                                `Coupon Discount (${(order as any).metadata.coupon.code})` : 
                                'Discount'}
                            </span>
                            <span>-AED {(order as any).metadata.coupon.discount.toFixed(2)}</span>
                          </div>
                        )}
                        
                        {/* Show delivery charge if applicable */}
                        {order.deliveryMethod === 'DELIVERY' && order.deliveryCharge && order.deliveryCharge > 0 && (
                          <div className="flex justify-between text-sm">
                            <span>Delivery Charge:</span>
                            <span>AED {order.deliveryCharge.toFixed(2)}</span>
                          </div>
                        )}
                        
                        {/* Calculate and show VAT using the formula: total / 1.05 = amount before VAT, then VAT = total - amountBeforeVAT */}
                        <div className="flex justify-between text-sm">
                          <span>Includes VAT (5%):</span>
                          <span>
                            {(() => {
                              // Get the subtotal and any discounts
                              const subtotal = (order as any).subtotal || (order as any).total || 0;
                              const discount = (order as any).discount || (order as any).metadata?.discount || (order as any).metadata?.coupon?.discount || 0;
                              
                              // Calculate the discounted subtotal
                              const discountedSubtotal = subtotal - discount;
                              
                              // Calculate amount before VAT and VAT amount using improved rounding
                              const amountBeforeVAT = Math.round((discountedSubtotal / 1.05) * 100) / 100;
                              const vatAmount = Math.round((discountedSubtotal - amountBeforeVAT) * 100) / 100;
                              
                              return `AED ${vatAmount.toFixed(2)}`;
                            })()}
                          </span>
                        </div>
                        
                        <div className="flex justify-between font-medium text-gray-900 pt-1 border-t border-gray-100">
                          <span>Total:</span>
                          <span>AED {order.totalAmount?.toFixed(2) || '0.00'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 min-w-fit"
                    >
                      View Receipt
                    </button>
                    {!['COMPLETED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(order.status) && (
                      <>
                        <button
                          onClick={() => setSelectedOrderForPickupUpdate(order)}
                          className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 min-w-fit flex items-center gap-1"
                        >
                          {order.deliveryMethod === 'PICKUP' ? <Store className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                          Update Details
                        </button>
                        <button
                          onClick={() => {
                            console.log('=== CANCEL BUTTON CLICKED ===');
                            console.log('Is Super Admin:', isSuperAdmin);
                            console.log('User Role:', userRole);
                            console.log('Order ID:', order.id);

                            if (isSuperAdmin) {
                              console.log('Opening cancel confirmation modal');
                              setShowCancelConfirm(order.id);
                            } else {
                              console.log('User is not super admin, showing error');
                              toast.error('Only Super Admins can cancel orders');
                            }
                          }}
                          className={`px-3 py-2 text-sm font-medium ${isSuperAdmin ? 'text-red-700 bg-red-100 hover:bg-red-200' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'} rounded-md min-w-fit`}
                        >
                          Cancel Order
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleReorder(order)}
                      className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-fit"
                    >
                      Reorder
                    </button>
                    <button
                        onClick={() => handleDownloadInvoice(order.id)}
                        disabled={downloadingInvoices[order.id]}
                        className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 flex items-center gap-2 min-w-fit whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
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
                          onClick={() => handlePrintGiftReceipt(order)}
                          className="px-3 py-2 text-sm font-medium text-pink-700 bg-pink-100 rounded-md hover:bg-pink-200 flex items-center gap-2 min-w-fit whitespace-nowrap"
                        >
                          <Printer className="h-4 w-4" />
                          Print Gift Receipt
                        </button>
                      )}
                    {(hasPartialPayment(order) || hasPendingPayment(order)) && !isFullyPaid(order) && !['REFUNDED', 'PARTIALLY_REFUNDED'].includes(order.status) && (
                      <button
                        onClick={() => setSelectedOrderForPayment(order)}
                        className="px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-100 rounded-md hover:bg-indigo-200 min-w-fit flex items-center justify-center gap-2"
                      >
                        {hasPendingPayment(order) ? '💰 Pay Now' : '💰 Pay Remaining'}
                      </button>
                    )}
                    {(order.status === POSOrderStatus.CANCELLED || order.status === POSOrderStatus.COMPLETED) && (
                      <>
                        <button
                          onClick={() => {
                            setRefundNotes('');
                            setShowRefundModal(order.id);
                          }}
                          className="px-3 py-2 text-sm font-medium text-orange-600 bg-orange-100 rounded-md hover:bg-orange-200 flex items-center gap-1 min-w-fit whitespace-nowrap"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Mark as Refunded
                        </button>
                        <button
                          onClick={() => {
                            setPartialRefundAmount('');
                            setPartialRefundNotes('');
                            setShowPartialRefundModal(order.id);
                          }}
                          className="px-3 py-2 text-sm font-medium text-orange-600 bg-orange-100 rounded-md hover:bg-orange-200 flex items-center gap-1 min-w-fit whitespace-nowrap"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Mark as Partial Refund
                        </button>
                      </>
                    )}
                    {order.status === POSOrderStatus.PENDING && (
                      <button
                        onClick={() => handleMarkAsCompleted(order.id)}
                        className="px-3 py-2 text-sm font-medium text-green-600 bg-green-100 rounded-md hover:bg-green-200 flex items-center gap-1 min-w-fit whitespace-nowrap"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Mark as Completed
                      </button>
                    )}
                  </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && orders.length > 0 && totalOrders > ordersPerPage && (
          <div className="mt-8 flex items-center justify-between bg-white p-4 rounded-lg shadow-sm">
            <div className="text-sm text-gray-700">
              Showing {((currentPage - 1) * ordersPerPage) + 1} to {Math.min(currentPage * ordersPerPage, totalOrders)} of {totalOrders} orders
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (currentPage > 1) {
                    setCurrentPage(currentPage - 1);
                  }
                }}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>

              <div className="flex items-center gap-1">
                {(() => {
                  const totalPages = Math.ceil(totalOrders / ordersPerPage);
                  const pages = [];
                  const maxVisiblePages = 5;

                  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

                  if (endPage - startPage + 1 < maxVisiblePages) {
                    startPage = Math.max(1, endPage - maxVisiblePages + 1);
                  }

                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i)}
                        className={`px-3 py-2 text-sm font-medium rounded-md ${
                          i === currentPage
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        {i}
                      </button>
                    );
                  }

                  return pages;
                })()}
              </div>

              <button
                onClick={() => {
                  const totalPages = Math.ceil(totalOrders / ordersPerPage);
                  if (currentPage < totalPages) {
                    setCurrentPage(currentPage + 1);
                  }
                }}
                disabled={currentPage >= Math.ceil(totalOrders / ordersPerPage)}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
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
      {selectedGiftOrder && (
        <GiftReceipt
          order={selectedGiftOrder}
          onClose={() => setSelectedGiftOrder(null)}
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

      {/* Full Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Refund Order</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to mark this order as refunded?
            </p>
            <div className="mb-4">
              <label htmlFor="refundNotes" className="block text-sm font-medium text-gray-700 mb-1">
                Refund Notes (Optional)
              </label>
              <textarea
                id="refundNotes"
                value={refundNotes}
                onChange={(e) => setRefundNotes(e.target.value)}
                placeholder="Enter any notes about this refund"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
              />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowRefundModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRefundOrder(showRefundModal)}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700"
              >
                Confirm Refund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partial Refund Modal */}
      {showPartialRefundModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Partial Refund</h3>
            <div className="mb-4">
              <label htmlFor="partialRefundAmount" className="block text-sm font-medium text-gray-700 mb-1">
                Refund Amount
              </label>
              <input
                id="partialRefundAmount"
                type="number"
                value={partialRefundAmount}
                onChange={(e) => setPartialRefundAmount(e.target.value)}
                placeholder="Enter amount to refund"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="partialRefundNotes" className="block text-sm font-medium text-gray-700 mb-1">
                Refund Notes (Optional)
              </label>
              <textarea
                id="partialRefundNotes"
                value={partialRefundNotes}
                onChange={(e) => setPartialRefundNotes(e.target.value)}
                placeholder="Enter any notes about this partial refund"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
              />
            </div>
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
                Confirm Partial Refund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Image Manager Modal */}
      {showCustomImageModal && selectedOrderItem && (
        <CustomImageManager
          isOpen={showCustomImageModal}
          onClose={() => {
            setShowCustomImageModal(false);
            setSelectedOrderItem(null);
          }}
          orderId={selectedOrderItem.orderId}
          orderItem={selectedOrderItem.item}
          itemIndex={selectedOrderItem.itemIndex}
          onImagesUpdated={(orderId, itemIndex, images) => {
            // Update the orders state with new images
            setOrders(prevOrders =>
              prevOrders.map(order =>
                order.id === orderId
                  ? {
                      ...order,
                      items: order.items.map((item, idx) =>
                        idx === itemIndex
                          ? { ...item, customImages: images }
                          : item
                      )
                    }
                  : order
              )
            );
            setShowCustomImageModal(false);
            setSelectedOrderItem(null);
          }}
        />
      )}
    </div>
  );
};

export default OrdersPage;
