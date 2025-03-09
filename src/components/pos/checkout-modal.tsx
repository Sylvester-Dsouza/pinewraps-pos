"use client";

import { Fragment, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { X, Minus, Plus, Trash, Search, ShoppingCart, Upload, Camera, User, MapPin, ListOrdered } from "lucide-react";
import { toast } from "@/lib/toast-utils";
import { apiMethods } from "@/services/api";
import { POSOrderData, POSOrderItemData, POSOrderStatus, POSPaymentMethod, POSPaymentStatus, DeliveryMethod } from "@/types/order";
import { nanoid } from 'nanoid';
import Image from "next/image";
import ImageUpload from "./custom-images/image-upload";
import { useAuth } from "@/providers/auth-provider";
import debounce from 'lodash/debounce';
import { CartItem, CustomImage, SelectedVariation } from "@/types/cart";
import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';
import crypto from 'crypto';

interface CustomerAddress {
  id: string;
  street: string;
  apartment: string;
  emirate: string;
  city: string;
  country: string;
  pincode: string;
  isDefault: boolean;
  type: string;
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addresses: CustomerAddress[];
  reward: {
    points: number;
  };
}

interface Payment {
  id: string;
  amount: number;
  method: POSPaymentMethod;
  reference?: string | null;
  status: POSPaymentStatus;
  metadata: {
    source: 'POS';
    cashAmount?: string;
    changeAmount?: string;
    futurePaymentMethod?: POSPaymentMethod;
  };
}

interface CheckoutDetails {
  customerDetails: {
    name: string;
    email: string;
    phone: string;
  };
  deliveryMethod: DeliveryMethod;
  deliveryDetails?: {
    date: string;
    timeSlot: string;
    instructions: string;
    streetAddress: string;
    apartment: string;
    emirate: string;
    city: string;
    charge: number;
  };
  pickupDetails?: {
    date: string;
    timeSlot: string;
  };
  giftDetails?: {
    isGift: boolean;
    recipientName: string;
    recipientPhone: string;
    message: string;
    note: string;
    cashAmount: string;
    includeCash: boolean;
  };
  payments: Payment[];
  paymentMethod: POSPaymentMethod;
  paymentReference: string;
  orderSummary: {
    totalItems: number;
    totalAmount: number;
    products: {
      id: string;
      productId: string;
      name: string;
      quantity: number;
      price: number;
      unitPrice: number;
      sku: string;
      requiresKitchen: boolean;
      requiresDesign: boolean;
      hasVariations?: boolean;
      hasCustomImages?: boolean;
    }[];
  };
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  setCart: (cart: CartItem[]) => void;
  cartTotal: number;
  onCheckoutComplete?: (checkoutDetails: CheckoutDetails) => void;
  onQueueOrder?: (checkoutDetails: CheckoutDetails) => void;
  onSaveCheckoutDetails?: (checkoutDetails: CheckoutDetails) => void;
  customerDetails?: {
    name: string;
    email: string;
    phone: string;
  };
  deliveryMethod?: DeliveryMethod;
  deliveryDetails?: {
    date: string;
    timeSlot: string;
    instructions: string;
    streetAddress: string;
    apartment: string;
    emirate: string;
    city: string;
    charge: number;
  };
  pickupDetails?: {
    date: string;
    timeSlot: string;
  };
  giftDetails?: {
    isGift: boolean;
    recipientName: string;
    recipientPhone: string;
    message: string;
    note: string;
    cashAmount: string;
    includeCash: boolean;
  };
  payments?: Payment[];
  paymentMethod?: POSPaymentMethod;
  paymentReference?: string;
  orderName?: string; 
}

interface OrderData {
  items: (POSOrderItemData & { customImages?: CustomImage[] })[];
  payments: Payment[];
  customer?: Customer;
  giftDetails?: {
    isGift: boolean;
    recipientName: string;
    recipientPhone: string;
    message: string;
    note: string;
    cashAmount: string;
    includeCash: boolean;
  };
  orderSummary: {
    totalItems: number;
    totalAmount: number;
    products: {
      id: string;
      productId: string;
      name: string;
      quantity: number;
      price: number;
      unitPrice: number;
      sku: string;
      requiresKitchen: boolean;
      requiresDesign: boolean;
      hasVariations?: boolean;
      hasCustomImages?: boolean;
    }[];
  };
}

export default function CheckoutModal({
  isOpen,
  onClose,
  cart,
  setCart,
  cartTotal,
  onCheckoutComplete,
  onQueueOrder,
  onSaveCheckoutDetails,
  customerDetails,
  deliveryMethod,
  deliveryDetails,
  pickupDetails,
  giftDetails,
  payments,
  paymentMethod,
  paymentReference,
  orderName
}: CheckoutModalProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQueuingOrder, setIsQueuingOrder] = useState(false);
  const [teamSelection, setTeamSelection] = useState<'KITCHEN' | 'DESIGN' | 'BOTH'>('KITCHEN');
  const [deliveryMethodState, setDeliveryMethodState] = useState<DeliveryMethod>(
    deliveryMethod && Object.values(DeliveryMethod).includes(deliveryMethod) 
      ? deliveryMethod 
      : DeliveryMethod.PICKUP
  );
  const [customerDetailsState, setCustomerDetailsState] = useState({
    name: customerDetails?.name || "",
    email: customerDetails?.email || "",
    phone: customerDetails?.phone || "",
  });
  const [giftDetailsState, setGiftDetailsState] = useState({
    isGift: giftDetails?.isGift || false,
    recipientName: giftDetails?.recipientName || '',
    recipientPhone: giftDetails?.recipientPhone || '',
    message: giftDetails?.message || '',
    note: giftDetails?.note || '',
    cashAmount: giftDetails?.cashAmount || '0',
    includeCash: giftDetails?.includeCash || false
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    reward: {
      points: number;
    };
  }>>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef(null);
  const [deliveryDetailsState, setDeliveryDetailsState] = useState({
    date: "",
    timeSlot: "",
    instructions: "",
    streetAddress: "",
    apartment: "",
    emirate: "",
    city: "",
    charge: 0,
  });
  const [pickupDetailsState, setPickupDetailsState] = useState({
    date: "",
    timeSlot: "",
  });
  const [orderItems, setOrderItems] = useState<Array<{
    productId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    variations: Record<string, any>;
    requiresDesign: boolean;
    designDetails?: string;
    kitchenNotes?: string;
    customImages?: CustomImage[];
  }>>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerAddresses, setCustomerAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<CustomerAddress | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [orderNameState, setOrderNameState] = useState(orderName || "");
  const [orderNotes, setOrderNotes] = useState("");
  const [isGiftState, setIsGiftState] = useState(giftDetails?.isGift || false);

  // Payment state
  const [showRemainingPaymentModal, setShowRemainingPaymentModal] = useState(false);
  const [showSplitPaymentModal, setShowSplitPaymentModal] = useState(false);
  const [currentPaymentMethodState, setCurrentPaymentMethodState] = useState<POSPaymentMethod>(POSPaymentMethod.CASH);
  const [currentPaymentReferenceState, setCurrentPaymentReferenceState] = useState('');
  const [currentPaymentAmountState, setCurrentPaymentAmountState] = useState('');
  const [isPartialPaymentState, setIsPartialPaymentState] = useState(false);
  const [isSplitPaymentState, setIsSplitPaymentState] = useState(false);
  const [splitCashAmount, setSplitCashAmount] = useState('');
  const [splitCardAmount, setSplitCardAmount] = useState('');
  const [splitCardReference, setSplitCardReference] = useState('');
  const [paymentsState, setPaymentsState] = useState<Payment[]>([]);

  // Payment utility functions
  const calculateTotalPaid = useCallback(() => {
    return paymentsState.reduce((total, payment) => total + payment.amount, 0);
  }, [paymentsState]);

  const calculateRemainingAmount = useCallback(() => {
    const totalPaid = calculateTotalPaid();
    return Math.max(0, cartTotal - totalPaid);
  }, [cartTotal, calculateTotalPaid]);

  // Calculate final total including discounts and delivery
  const calculateFinalTotal = useCallback(() => {
    let total = cartTotal;

    // Apply coupon discount if available
    if (appliedCoupon) {
      total -= appliedCoupon.discount;
    }

    // Add delivery charge if applicable
    if (deliveryMethod === DeliveryMethod.DELIVERY && deliveryDetails?.charge) {
      total += deliveryDetails.charge;
    }

    return Math.max(0, total); // Ensure total is not negative
  }, [cartTotal, appliedCoupon, deliveryMethod, deliveryDetails]);

  // Validate order details before proceeding
  const validateOrderDetails = useCallback(() => {
    // Basic cart validation
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return false;
    }

    // Validate delivery details
    if (deliveryMethod === DeliveryMethod.DELIVERY) {
      if (!deliveryDetails?.date) {
        toast.error('Please select a delivery date');
        return false;
      }
      if (!deliveryDetails?.timeSlot) {
        toast.error('Please select a delivery time slot');
        return false;
      }
      if (!deliveryDetails?.emirate) {
        toast.error('Please select a delivery emirate');
        return false;
      }
      if (!deliveryDetails?.streetAddress) {
        toast.error('Please enter a delivery address');
        return false;
      }
    }

    // Validate pickup details
    if (deliveryMethod === DeliveryMethod.PICKUP) {
      if (!pickupDetails?.date) {
        toast.error('Please select a pickup date');
        return false;
      }
      if (!pickupDetails?.timeSlot) {
        toast.error('Please select a pickup time slot');
        return false;
      }
    }

    // Validate gift details if gift option is selected
    if (isGiftState) {
      if (!giftDetails?.recipientName) {
        toast.error('Please enter gift recipient name');
        return false;
      }
      if (!giftDetails?.recipientPhone) {
        toast.error('Please enter gift recipient phone');
        return false;
      }
    }

    return true;
  }, [cart.length, deliveryMethod, deliveryDetails, pickupDetails, isGiftState, giftDetails]);

  // Handle create order with validation
  const handleCreateOrder = useCallback(async () => {
    if (!validateOrderDetails()) {
      return;
    }

    try {
      setIsSubmitting(true);

      // Prepare order data with routing logic
      const orderData = {
        items: cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          variations: item.selectedVariations.map(v => ({
            id: v.id,
            type: v.type,
            value: v.value,
            priceAdjustment: v.priceAdjustment || 0
          })),
          notes: '',
          totalPrice: item.price
        })),
        totalAmount: calculateFinalTotal(),
        // Customer and delivery details
        customerName: selectedCustomer ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}` : '',
        customerPhone: selectedCustomer?.phone || '',
        customerEmail: selectedCustomer?.email || '',
        deliveryMethod,
        ...(deliveryMethod === 'DELIVERY' ? {
          deliveryDate: deliveryDetails?.date,
          deliveryTimeSlot: deliveryDetails?.timeSlot,
          deliveryInstructions: deliveryDetails?.instructions,
          deliveryCharge: deliveryDetails?.charge,
          streetAddress: deliveryDetails?.streetAddress,
          apartment: deliveryDetails?.apartment,
          emirate: deliveryDetails?.emirate,
          city: deliveryDetails?.city
        } : {
          pickupDate: pickupDetails?.date,
          pickupTimeSlot: pickupDetails?.timeSlot
        }),
        // Gift details if applicable
        ...(isGiftState ? {
          isGift: true,
          giftRecipientName: giftDetails?.recipientName || '',
          giftRecipientPhone: giftDetails?.recipientPhone || '',
          giftMessage: giftDetails?.message || '',
          giftCashAmount: giftDetails?.cashAmount ? parseFloat(giftDetails.cashAmount) : 0
        } : {}),
        // Add discount details if coupon applied
        ...(appliedCoupon ? {
          discount: {
            code: appliedCoupon.code,
            type: appliedCoupon.type,
            value: appliedCoupon.value,
            amount: appliedCoupon.discount
          }
        } : {}),
        // Order flow metadata
        metadata: {
          routing: {
            // Initial queue based on category
            initialQueue: cart.some(item => item.product.categoryId === 'sets') ? 'DESIGN_QUEUE' :
                         cart.some(item => item.product.categoryId === 'flowers') ? 'DESIGN_QUEUE' :
                         'KITCHEN_QUEUE',
            status: 'QUEUED',
            // Team assignment based on category
            assignedTeam: cart.some(item => item.product.categoryId === 'sets' || item.product.categoryId === 'flowers') ? 'DESIGN' : 'KITCHEN',
            // Processing flow based on category
            processingFlow: cart.some(item => item.product.categoryId === 'sets') ? 
              ['DESIGN_QUEUE', 'DESIGN_PROCESSING', 'DESIGN_READY', 'KITCHEN_QUEUE', 'KITCHEN_PROCESSING', 'KITCHEN_READY', 'FINAL_CHECK_QUEUE'] :
              cart.some(item => item.product.categoryId === 'flowers') ?
              ['DESIGN_QUEUE', 'DESIGN_PROCESSING', 'DESIGN_READY', 'FINAL_CHECK_QUEUE'] :
              ['KITCHEN_QUEUE', 'KITCHEN_PROCESSING', 'KITCHEN_READY', 'FINAL_CHECK_QUEUE'],
            currentStep: 0
          },
          // Quality control settings
          qualityControl: {
            requiresFinalCheck: true,
            canReturnToKitchen: true,
            canReturnToDesign: true,
            finalCheckNotes: ''
          },
          // Item-specific requirements
          itemRequirements: cart.map(item => ({
            productId: item.product.id,
            categoryId: item.product.categoryId,
            requiresKitchen: item.product.categoryId === 'cakes' || item.product.categoryId === 'sets',
            requiresDesign: item.product.categoryId === 'flowers' || item.product.categoryId === 'sets',
            requiresSequentialProcessing: item.product.categoryId === 'sets',
            processingOrder: item.product.categoryId === 'sets' ? ['DESIGN', 'KITCHEN'] :
                           item.product.categoryId === 'flowers' ? ['DESIGN'] :
                           ['KITCHEN']
          }))
        }
      };

      // Create order
      const response = await apiMethods.orders.createOrder(orderData);
      
      if (response.data.success) {
        toast.success('Order created successfully!');
        onClose();
        router.push('/orders');
      } else {
        toast.error(response.data.message || 'Failed to create order');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    apiMethods.orders,
    appliedCoupon,
    calculateFinalTotal,
    cart,
    deliveryDetails,
    deliveryMethod,
    giftDetails,
    isGiftState,
    onClose,
    pickupDetails,
    router,
    selectedCustomer
  ]);

  // Payment handling functions
  const handleAddPayment = useCallback((payment: Payment) => {
    setPaymentsState(prev => [...prev, {
      ...payment,
      metadata: {
        ...payment.metadata,
        source: 'POS' as const,
        futurePaymentMethod: payment.method === POSPaymentMethod.CASH ? POSPaymentMethod.CARD : POSPaymentMethod.CARD
      }
    }]);
  }, []);

  const handleRemovePayment = useCallback((paymentId: string) => {
    setPaymentsState(prev => prev.filter(p => p.id !== paymentId));
  }, []);

  const handlePartialPayment = useCallback((amount: number, method: POSPaymentMethod, reference?: string) => {
    const payment: Payment = {
      id: nanoid(),
      amount,
      method: POSPaymentMethod.PARTIAL,
      reference: method === POSPaymentMethod.CARD ? reference || null : null,
      status: POSPaymentStatus.PARTIALLY_PAID,
      metadata: {
        source: 'POS' as const,
        cashAmount: method === POSPaymentMethod.CASH ? amount.toString() : undefined,
        changeAmount: method === POSPaymentMethod.CASH ? '0' : undefined,
        futurePaymentMethod: POSPaymentMethod.CARD
      }
    };
    handleAddPayment(payment);
    setIsPartialPaymentState(true);
  }, [handleAddPayment]);

  const handlePaymentMethodSelect = useCallback((method: POSPaymentMethod) => {
    // Handle special payment methods
    if (method === POSPaymentMethod.SPLIT) {
      setIsSplitPaymentState(true);
      setIsPartialPaymentState(false);
      setShowSplitPaymentModal(true);
    } else if (method === POSPaymentMethod.PARTIAL) {
      setIsPartialPaymentState(true);
      setIsSplitPaymentState(false);
    } else {
      setCurrentPaymentMethodState(method);
      setIsSplitPaymentState(false);
      setIsPartialPaymentState(false);
    }

    // Reset all payment-related state
    setPaymentsState([]);
    setCurrentPaymentReferenceState('');
    setCurrentPaymentAmountState('');
    setSplitCashAmount('');
    setSplitCardAmount('');
    setSplitCardReference('');
  }, []);

  const handleSplitPayment = useCallback(() => {
    const parsedCashAmount = parseFloat(splitCashAmount);
    const parsedCardAmount = parseFloat(splitCardAmount);
    
    if (isNaN(parsedCashAmount) || isNaN(parsedCardAmount)) {
      toast.error('Please enter valid amounts for both cash and card');
      return;
    }

    const total = parsedCashAmount + parsedCardAmount;
    if (Math.abs(total - cartTotal) > 0.01) {
      toast.error('Total amount must equal the cart total');
      return;
    }

    // Create cash payment
    const cashPayment: Payment = {
      id: nanoid(),
      method: POSPaymentMethod.CASH,
      amount: parsedCashAmount,
      reference: null,
      status: POSPaymentStatus.FULLY_PAID,
      metadata: {
        source: 'POS' as const,
        cashAmount: splitCashAmount,
        changeAmount: '0.00'
      }
    };

    // Create card payment
    const cardPayment: Payment = {
      id: nanoid(),
      method: POSPaymentMethod.CARD,
      amount: parsedCardAmount,
      reference: splitCardReference || null,
      status: POSPaymentStatus.FULLY_PAID,
      metadata: {
        source: 'POS' as const
      }
    };

    // Update payments state
    setPaymentsState([cashPayment, cardPayment]);
    setCurrentPaymentMethodState(POSPaymentMethod.SPLIT);
    setIsSplitPaymentState(true);

    // Reset split payment form
    setSplitCashAmount('');
    setSplitCardAmount('');
    setSplitCardReference('');

    toast.success('Split payment applied successfully');
  }, [cartTotal, splitCashAmount, splitCardAmount, splitCardReference]);

  const handlePaymentClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const amount = parseFloat(currentPaymentAmountState);
    if (!amount || isNaN(amount)) {
      toast.error('Please enter a valid amount');
      return;
    }

    // For card payments, ensure reference is provided
    if (currentPaymentMethodState === POSPaymentMethod.CARD && !currentPaymentReferenceState.trim()) {
      toast.error('Please enter a payment reference');
      return;
    }

    const totalPaid = calculateTotalPaid();
    const isComplete = Math.abs((totalPaid + amount) - cartTotal) < 0.01;

    // Handle partial payment
    if (!isComplete) {
      handlePartialPayment(amount, currentPaymentMethodState, currentPaymentReferenceState);
      setCurrentPaymentAmountState('');
      setCurrentPaymentReferenceState('');
      return;
    }

    // Handle full payment
    const payment: Payment = {
      id: nanoid(),
      amount,
      method: currentPaymentMethodState,
      reference: currentPaymentMethodState === POSPaymentMethod.CARD ? currentPaymentReferenceState : null,
      status: POSPaymentStatus.FULLY_PAID,
      metadata: {
        source: 'POS' as const,
        cashAmount: currentPaymentMethodState === POSPaymentMethod.CASH ? amount.toString() : undefined,
        changeAmount: currentPaymentMethodState === POSPaymentMethod.CASH ? '0' : undefined,
        futurePaymentMethod: POSPaymentMethod.CARD
      }
    };

    handleAddPayment(payment);

    // Reset form
    setCurrentPaymentAmountState('');
    setCurrentPaymentReferenceState('');

    // If payment is complete, proceed with checkout
    if (isComplete) {
      handleCreateOrder();
    }
  }, [currentPaymentAmountState, currentPaymentMethodState, currentPaymentReferenceState, cartTotal, calculateTotalPaid, handleCreateOrder, handleAddPayment, handlePartialPayment]);

  // Handle queue order
  const handleQueueOrder = useCallback(async () => {
    if (!validateOrderDetails()) {
      return;
    }

    try {
      setIsQueuingOrder(true);

      // Map cart items to queued order items
      const mappedItems = cart.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        totalPrice: item.price,
        selectedVariations: item.selectedVariations.map(v => ({
          id: v.id,
          type: v.type,
          value: v.value,
          price: v.priceAdjustment
        })),
        notes: '',
        customImages: item.customImages || [],
        requiresKitchen: item.product.categoryId === 'cakes' || item.product.categoryId === 'sets',
        requiresDesign: item.product.categoryId === 'flowers' || item.product.categoryId === 'sets',
        hasVariations: item.selectedVariations && item.selectedVariations.length > 0,
        hasCustomImages: item.customImages && item.customImages.length > 0,
        sku: item.product.sku,
        categoryId: item.product.categoryId,
        barcode: item.product.barcode
      }));

      // Base order data that's always required
      const baseOrderData = {
        totalAmount: calculateFinalTotal(),
        subtotal: cartTotal,
        items: mappedItems,
        name: orderName || undefined,
        notes: '',
        // Customer information
        customerName: selectedCustomer ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}` : undefined,
        customerEmail: selectedCustomer?.email,
        customerPhone: selectedCustomer?.phone,
        // Delivery method
        deliveryMethod,
        // Add discount details if coupon applied
        ...(appliedCoupon ? {
          discount: {
            code: appliedCoupon.code,
            type: appliedCoupon.type,
            value: appliedCoupon.value,
            amount: appliedCoupon.discount
          }
        } : {}),
        // Metadata for order flow
        metadata: {
          routing: {
            // Initial queue based on category
            initialQueue: cart.some(item => item.product.categoryId === 'sets') ? 'DESIGN_QUEUE' :
                         cart.some(item => item.product.categoryId === 'flowers') ? 'DESIGN_QUEUE' :
                         'KITCHEN_QUEUE',
            status: 'QUEUED',
            // Team assignment based on category
            assignedTeam: cart.some(item => item.product.categoryId === 'sets' || item.product.categoryId === 'flowers') ? 'DESIGN' : 'KITCHEN',
            // Processing flow based on category
            processingFlow: cart.some(item => item.product.categoryId === 'sets') ? 
              ['DESIGN_QUEUE', 'DESIGN_PROCESSING', 'DESIGN_READY', 'KITCHEN_QUEUE', 'KITCHEN_PROCESSING', 'KITCHEN_READY', 'FINAL_CHECK_QUEUE'] :
              cart.some(item => item.product.categoryId === 'flowers') ?
              ['DESIGN_QUEUE', 'DESIGN_PROCESSING', 'DESIGN_READY', 'FINAL_CHECK_QUEUE'] :
              ['KITCHEN_QUEUE', 'KITCHEN_PROCESSING', 'KITCHEN_READY', 'FINAL_CHECK_QUEUE'],
            currentStep: 0,
            // Quality control settings
            qualityControl: {
              requiresFinalCheck: true,
              canReturnToKitchen: true,
              canReturnToDesign: true,
              finalCheckNotes: ''
            },
            // Item-specific requirements
            itemRequirements: cart.map(item => ({
              productId: item.product.id,
              categoryId: item.product.categoryId,
              requiresKitchen: item.product.categoryId === 'cakes' || item.product.categoryId === 'sets',
              requiresDesign: item.product.categoryId === 'flowers' || item.product.categoryId === 'sets',
              requiresSequentialProcessing: item.product.categoryId === 'sets',
              processingOrder: item.product.categoryId === 'sets' ? ['DESIGN', 'KITCHEN'] :
                             item.product.categoryId === 'flowers' ? ['DESIGN'] :
                             ['KITCHEN']
            }))
          }
        }
      };

      // Add delivery-specific fields
      if (deliveryMethod === DeliveryMethod.DELIVERY && deliveryDetails) {
        Object.assign(baseOrderData, {
          deliveryDate: deliveryDetails.date,
          deliveryTimeSlot: deliveryDetails.timeSlot,
          deliveryInstructions: deliveryDetails.instructions,
          deliveryCharge: deliveryDetails.charge,
          streetAddress: deliveryDetails.streetAddress,
          apartment: deliveryDetails.apartment,
          emirate: deliveryDetails.emirate,
          city: deliveryDetails.city
        });
      } else if (deliveryMethod === DeliveryMethod.PICKUP && pickupDetails) {
        Object.assign(baseOrderData, {
          pickupDate: pickupDetails.date,
          pickupTimeSlot: pickupDetails.timeSlot
        });
      }

      // Add gift details if applicable
      if (isGiftState && giftDetails) {
        Object.assign(baseOrderData, {
          isGift: true,
          giftRecipientName: giftDetails.recipientName,
          giftRecipientPhone: giftDetails.recipientPhone,
          giftMessage: giftDetails.message,
          giftCashAmount: giftDetails.cashAmount ? parseFloat(giftDetails.cashAmount) : undefined
        });
      }

      // Queue the order
      const response = await apiMethods.pos.queueOrder(baseOrderData);

      if (response.data.success) {
        toast.success('Order queued successfully!');
        onClose();
        router.push('/queued-orders');
      } else {
        toast.error(response.data.message || 'Failed to queue order');
      }
    } catch (error) {
      console.error('Error queueing order:', error);
      toast.error('Failed to queue order');
    } finally {
      setIsQueuingOrder(false);
    }
  }, [
    apiMethods.pos,
    appliedCoupon,
    calculateFinalTotal,
    cart,
    deliveryDetails,
    deliveryMethod,
    giftDetails,
    isGiftState,
    onClose,
    orderName,
    pickupDetails,
    router,
    selectedCustomer,
    validateOrderDetails
  ]);

  // Process cart items
  const processCartItems = (items: CartItem[]) => {
    return items.map(item => {
      // Ensure variations are in the correct format
      const selectedVariations = Array.isArray(item.selectedVariations) 
        ? item.selectedVariations.map(v => {
            if (typeof v === 'object' && v !== null) {
              return {
                id: v.id || '',
                type: v.type,
                value: v.value,
                price: Number(v.price) || 0
              };
            }
            return {
              id: '',
              type: '',
              value: '',
              price: 0
            };
          })
        : [];

      return {
        id: nanoid(),
        productId: item.product?.id || '',
        productName: item.product?.name || '',
        quantity: item.quantity,
        totalPrice: item.totalPrice,
        unitPrice: item.product?.basePrice || 0,
        selectedVariations,
        customImages: Array.isArray(item.customImages) ? item.customImages : [],
        notes: item.notes || '',
        requiresKitchen: item.product?.requiresKitchen || item.product.categoryId === 'cakes' || item.product.categoryId === 'sets',
        requiresDesign: item.product?.requiresDesign || item.product.categoryId === 'flowers' || item.product.categoryId === 'sets',
        hasVariations: selectedVariations.length > 0,
        hasCustomImages: Array.isArray(item.customImages) && item.customImages.length > 0,
        sku: item.product?.sku || '',
        categoryId: item.product?.categoryId,
        barcode: item.product?.barcode,
        allowCustomImages: item.product?.allowCustomImages || false,
        allowCustomPrice: item.product?.allowCustomPrice || false
      };
    });
  };

  // Get the payment method for API
  const getApiPaymentMethod = () => {
    // If split payment is active, always return SPLIT
    if (isSplitPaymentState) {
      return POSPaymentMethod.SPLIT;
    }
    // Otherwise use the current payment method
    return currentPaymentMethodState;
  };

  // Get formatted checkout details for saving
  const getCheckoutDetails = (): CheckoutDetails => {
    const sanitizedCustomerDetails = sanitizeCustomerDetails();
    const payments = getOrderPayments();
    const currentPayment = payments[0] || {
      method: POSPaymentMethod.CASH,
      reference: ''
    };

    return {
      customerDetails: sanitizedCustomerDetails,
      deliveryMethod: deliveryMethod,
      deliveryDetails: deliveryMethod === DeliveryMethod.DELIVERY ? {
        date: deliveryDetailsState?.date,
        timeSlot: deliveryDetailsState?.timeSlot,
        instructions: deliveryDetailsState?.instructions,
        streetAddress: deliveryDetailsState?.streetAddress,
        apartment: deliveryDetailsState?.apartment,
        emirate: deliveryDetailsState?.emirate,
        city: deliveryDetailsState?.city,
        charge: deliveryDetailsState?.charge
      } : undefined,
      pickupDetails: deliveryMethod === DeliveryMethod.PICKUP ? {
        date: pickupDetailsState?.date,
        timeSlot: pickupDetailsState?.timeSlot
      } : undefined,
      giftDetails: {
        isGift: giftDetailsState.isGift,
        recipientName: giftDetailsState.recipientName,
        recipientPhone: giftDetailsState.recipientPhone,
        message: giftDetailsState.message,
        note: giftDetailsState.note || '',
        cashAmount: giftDetailsState.cashAmount || '0',
        includeCash: giftDetailsState.includeCash || false
      },
      payments,
      paymentMethod: currentPayment.method,
      paymentReference: currentPayment.reference || '',
      orderSummary: {
        totalItems: cart.length,
        totalAmount: cartTotal,
        products: cart.map(item => ({
          id: item.id,
          productId: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.basePrice * item.quantity,
          unitPrice: item.product.basePrice,
          sku: item.product.sku || '',
          requiresKitchen: item.product.requiresKitchen || item.product.categoryId === 'cakes' || item.product.categoryId === 'sets',
          requiresDesign: item.product.requiresDesign || item.product.categoryId === 'flowers' || item.product.categoryId === 'sets',
          hasVariations: item.selectedVariations && item.selectedVariations.length > 0,
          hasCustomImages: item.customImages && item.customImages.length > 0
        }))
      }
    };
  };

  // Determine initial status based on product requirements and category
  const determineInitialStatus = () => {
    const hasSetItems = cart.some(item => item.product.categoryId === 'sets');
    const hasFlowerItems = cart.some(item => item.product.categoryId === 'flowers');
    const hasCakeItems = cart.some(item => item.product.categoryId === 'cakes');
    
    // Follow the order flow logic:
    // - Products from Cake category -> Kitchen Queue
    // - Products from Flower category -> Design Queue
    // - Products from Sets category -> Design Queue first, then will be moved to Kitchen Queue
    if (hasSetItems) {
      // Sets always go to Design Queue first, then will be moved to Kitchen Queue
      return POSOrderStatus.DESIGN_QUEUE;
    } else if (hasFlowerItems) {
      // Flowers go directly to Design Queue
      return POSOrderStatus.DESIGN_QUEUE;
    } else if (hasCakeItems) {
      // Cakes go directly to Kitchen Queue
      return POSOrderStatus.KITCHEN_QUEUE;
    }
    
    // Default to PENDING if no special routing needed
    return POSOrderStatus.PENDING;
  };

  // Calculate processing requirements based on cart items
  const calculateProcessingRequirements = () => {
    return {
      requiresKitchen: cart.some(item => 
        item.product.requiresKitchen || 
        item.product.categoryId === 'cakes' || 
        item.product.categoryId === 'sets'
      ),
      requiresDesign: cart.some(item => 
        item.product.requiresDesign || 
        item.product.categoryId === 'flowers' || 
        item.product.categoryId === 'sets'
      ),
      requiresSequentialProcessing: cart.some(item => 
        item.product.categoryId === 'sets'
      )
    };
  };

  // Prepare order data for API
  const prepareOrderData = (): POSOrderData => {
    const { customerDetails, deliveryDetails, pickupDetails, giftDetails } = getCheckoutDetails();

    // Calculate processing requirements based on cart items
    const { requiresKitchen, requiresDesign, requiresSequentialProcessing } = calculateProcessingRequirements();

    // Convert gift cash amount to string with proper formatting
    const giftCashAmountStr = giftDetails?.cashAmount || '0.00';

    // Map items with proper type conversions
    const mappedItems = cart.map(item => ({
      id: item.id,
      productId: item.product.id,
      productName: item.product.name,
      unitPrice: item.product.basePrice,
      quantity: item.quantity,
      totalPrice: item.product.basePrice * item.quantity,
      variations: item.selectedVariations?.reduce((acc, variation) => ({
        ...acc,
        [variation.type]: variation.value
      }), {}),
      selectedVariations: item.selectedVariations.map(variation => ({
        type: variation.type,
        value: variation.value,
        price: variation.priceAdjustment || 0
      })),
      notes: item.notes || '',
      customImages: item.customImages?.map(img => ({
        id: img.id || crypto.randomUUID(),
        url: img.url,
        comment: img.comment || '',
        previewUrl: img.previewUrl || '',
        createdAt: img.createdAt || new Date().toISOString()
      })),
      requiresKitchen: item.product.requiresKitchen || item.product.categoryId === 'cakes' || item.product.categoryId === 'sets',
      requiresDesign: item.product.requiresDesign || item.product.categoryId === 'flowers' || item.product.categoryId === 'sets',
      requiresSequentialProcessing: item.product.categoryId === 'sets',
      requiresFinalCheck: true,
      sku: item.product.sku || '',
      categoryId: item.product.categoryId,
      barcode: item.product.barcode,
      allowCustomImages: item.product.allowCustomImages || false,
      allowCustomPrice: item.product.allowCustomPrice || false
    }));

    // Base order data that's always required
    const baseOrderData: POSOrderData = {
      totalAmount: calculateFinalTotal(),
      subtotal: cartTotal,
      payments: paymentsState.map(p => ({
        ...p,
        metadata: {
          ...p.metadata,
          source: 'POS' as const
        }
      })),
      paymentMethod: currentPaymentMethodState,
      paymentReference: currentPaymentReferenceState || '',
      requiresKitchen,
      requiresDesign,
      requiresSequentialProcessing,
      requiresFinalCheck: true,
      customerName: customerDetails.name,
      customerEmail: customerDetails.email,
      customerPhone: customerDetails.phone,
      items: mappedItems,
      deliveryMethod,
      // Initialize optional fields with undefined
      deliveryDate: undefined,
      deliveryTimeSlot: undefined,
      deliveryInstructions: undefined,
      deliveryCharge: undefined,
      streetAddress: undefined,
      apartment: undefined,
      emirate: undefined,
      city: undefined,
      pickupDate: undefined,
      pickupTimeSlot: undefined,
      isGift: giftDetails.isGift,
      giftRecipientName: giftDetails.isGift ? giftDetails.recipientName : undefined,
      giftRecipientPhone: giftDetails.isGift ? giftDetails.recipientPhone : undefined,
      giftMessage: giftDetails.isGift ? giftDetails.message : undefined,
      giftCashAmount: giftDetails.isGift ? giftCashAmountStr : undefined
    };

    // Add delivery-specific fields
    if (deliveryMethod === DeliveryMethod.DELIVERY && deliveryDetails) {
      baseOrderData.deliveryDate = deliveryDetails.date;
      baseOrderData.deliveryTimeSlot = deliveryDetails.timeSlot;
      baseOrderData.deliveryInstructions = deliveryDetails.instructions;
      baseOrderData.deliveryCharge = parseFloat(deliveryDetails.charge.toString());
      baseOrderData.streetAddress = deliveryDetails.streetAddress;
      baseOrderData.apartment = deliveryDetails.apartment;
      baseOrderData.emirate = deliveryDetails.emirate;
      baseOrderData.city = deliveryDetails.city;
    } else if (deliveryMethod === DeliveryMethod.PICKUP && pickupDetails) {
      baseOrderData.pickupDate = pickupDetails.date;
      baseOrderData.pickupTimeSlot = pickupDetails.timeSlot;
    }

    return baseOrderData;
  };

  // Debug cart items function (moved outside useEffect)
  const debugCartItems = () => {
    if (!Array.isArray(cart) || cart.length === 0) {
      console.warn('Cart is empty or not an array:', cart);
      return;
    }
    
    console.log(`Cart has ${cart.length} items`);
    cart.forEach((item, index) => {
      console.log(`Cart item ${index}:`, JSON.stringify(item, null, 2));
      
      // Check for missing or invalid product
      if (!item || !item.product) {
        console.error(`Invalid cart item at index ${index}:`, item);
      } else {
        console.log(`Product details for item ${index}:`, JSON.stringify(item.product, null, 2));
      }
      
      // Check for missing or invalid selectedVariations
      if (!item.selectedVariations || !Array.isArray(item.selectedVariations)) {
        console.warn(`Cart item ${index} has invalid selectedVariations:`, item.selectedVariations);
      } else if (item.selectedVariations.length > 0) {
        console.log(`Selected variations for item ${index}:`, JSON.stringify(item.selectedVariations, null, 2));
      }
      
      // Check for missing or invalid customImages
      if (!item.customImages || !Array.isArray(item.customImages)) {
        console.warn(`Cart item ${index} has invalid customImages:`, item.customImages);
      } else if (item.customImages.length > 0) {
        console.log(`Custom images for item ${index}:`, JSON.stringify(item.customImages, null, 2));
      }
    });
  };

  // Call debugCartItems whenever cart changes
  useEffect(() => {
    if (isOpen && Array.isArray(cart)) {
      debugCartItems();
    }
  }, [cart, isOpen]);

  // Debug cart items when they change
  useEffect(() => {
    if (cart && cart.length > 0) {
      console.log('Cart items in checkout modal:', cart.length);
      
      // Check for items with custom images
      const itemsWithCustomImages = cart.filter(item => 
        item.customImages && Array.isArray(item.customImages) && item.customImages.length > 0
      );
      
      if (itemsWithCustomImages.length > 0) {
        console.log(`Found ${itemsWithCustomImages.length} items with custom images`);
        itemsWithCustomImages.forEach((item, index) => {
          console.log(`Item ${index + 1} custom images:`, item.customImages);
        });
      } else {
        console.log('No items with custom images found');
      }
      
      // Check for items that allow custom images
      const itemsAllowingCustomImages = cart.filter(item => 
        item.product?.allowCustomImages === true
      );
      
      if (itemsAllowingCustomImages.length > 0) {
        console.log(`Found ${itemsAllowingCustomImages.length} items that allow custom images`);
      } else {
        console.log('No items that allow custom images found');
      }
    }
  }, [cart]);

  // Initialize customer details from props when the modal opens
  useEffect(() => {
    if (isOpen && customerDetails) {
      console.log('Initializing customer details from props:', customerDetails);
      setCustomerDetailsState({
        name: customerDetails.name || "",
        email: customerDetails.email || "",
        phone: customerDetails.phone || "",
      });
    }
  }, [isOpen, customerDetails]);

  // Save checkout details whenever they change
  useEffect(() => {
    if (isOpen && onSaveCheckoutDetails) {
      // Use a debounce mechanism to prevent too frequent updates
      const timeoutId = setTimeout(() => {
        const details = getCheckoutDetails();
        onSaveCheckoutDetails(details);
      }, 500); // 500ms debounce
      
      return () => clearTimeout(timeoutId);
    }
  }, [
    isOpen, 
    customerDetailsState, 
    deliveryMethod, 
    deliveryDetailsState, 
    pickupDetailsState, 
    giftDetailsState, 
    currentPaymentMethodState, 
    currentPaymentReferenceState, 
    onSaveCheckoutDetails
  ]);

  // Close search results when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search for customers by name or phone
  const searchCustomers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      setShowSearchResults(false);
      return;
    }

    try {
      const response = await apiMethods.pos.searchCustomers(query);
      if (response.data) {
        // Sort results: exact matches first, then partial matches
        const sortedResults = response.data.sort((a, b) => {
          const aName = `${a.firstName} ${a.lastName}`.toLowerCase();
          const bName = `${b.firstName} ${b.lastName}`.toLowerCase();
          const queryLower = query.toLowerCase();
          
          // Exact matches first
          if (aName === queryLower && bName !== queryLower) return -1;
          if (bName === queryLower && aName !== queryLower) return 1;
          
          // Then starts with
          if (aName.startsWith(queryLower) && !bName.startsWith(queryLower)) return -1;
          if (bName.startsWith(queryLower) && !aName.startsWith(queryLower)) return 1;
          
          // Then alphabetical
          return aName.localeCompare(bName);
        });
        
        setSearchResults(sortedResults);
        setShowSearchResults(true);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    } catch (error) {
      console.error('Error searching customers:', error);
      setSearchResults([]);
      setShowSearchResults(false);
    } finally {
      setIsSearching(false);
    }
  };

  // Create debounced search function
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      searchCustomers(query);
    }, 300), // Reduced debounce time for faster response
    []
  );

  // Handle customer selection
  const handleCustomerSelect = useCallback(async (customer: Customer) => {
    setCustomerDetailsState({
      name: `${customer.firstName} ${customer.lastName}`.trim(),
      email: customer.email,
      phone: customer.phone
    });
    setSelectedCustomer({
      ...customer,
      addresses: customer.addresses || [] // Ensure addresses is always an array
    });
    setShowSearchResults(false);
    setSearchResults([]);

    try {
      const addressResponse = await apiMethods.pos.getCustomerAddresses(customer.id);
      if (addressResponse.success) {
        const addresses = addressResponse.data;
        setCustomerAddresses(addresses);
        
        // Update customer with addresses
        setSelectedCustomer(prev => prev ? { ...prev, addresses } : null);
        
        // If delivery method is selected, auto-select default address
        if (deliveryMethod === DeliveryMethod.DELIVERY && addresses.length > 0) {
          const defaultAddress = addresses.find(addr => addr.isDefault) || addresses[0];
          setSelectedAddress(defaultAddress);
          setDeliveryDetailsState(prev => ({
            ...prev,
            streetAddress: defaultAddress.street,
            apartment: defaultAddress.apartment,
            emirate: defaultAddress.emirate,
            city: defaultAddress.city || 'Dubai'
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching customer addresses:', error);
    }
  }, [deliveryMethod]);

  // Handle address selection
  const handleAddressSelect = (address: CustomerAddress) => {
    setSelectedAddress(address);
    setDeliveryDetailsState(prev => ({
      ...prev,
      streetAddress: address.street,
      apartment: address.apartment,
      emirate: address.emirate,
      city: address.city || 'Dubai'
    }));
  };

  // Update delivery method
  const handleDeliveryMethodChange = (method: DeliveryMethod) => {
    setDeliveryMethodState(method);
    
    // If switching to delivery and customer has addresses, auto-select default
    if (method === DeliveryMethod.DELIVERY && selectedCustomer?.addresses?.length > 0) {
      const defaultAddress = selectedCustomer.addresses.find(addr => addr.isDefault) || selectedCustomer.addresses[0];
      setSelectedAddress(defaultAddress);
      setDeliveryDetailsState(prev => ({
        ...prev,
        streetAddress: defaultAddress.street,
        apartment: defaultAddress.apartment,
        emirate: defaultAddress.emirate,
        city: defaultAddress.city || 'Dubai'
      }));
    }
  };

  // Handle customer name change and search
  const handleCustomerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomerDetailsState(prev => ({ ...prev, name: value }));
    setSearchQuery(value);
    setIsSearching(true);
    
    // Trigger search if value is not empty
    if (value.trim()) {
      debouncedSearch(value);
    } else {
      setShowSearchResults(false);
      setSearchResults([]);
    }
  };

  // Time slots based on emirate
  const getTimeSlots = (emirate: string) => {
    if (emirate === 'DUBAI') {
      return [
        "10:00 AM - 12:00 PM",
        "12:00 PM - 02:00 PM",
        "02:00 PM - 04:00 PM",
        "04:00 PM - 06:00 PM",
        "06:00 PM - 08:00 PM"
      ];
    }
    // Other emirates have limited slots
    return [
      "10:00 AM - 02:00 PM",
      "02:00 PM - 06:00 PM"
    ];
  };

  // Get available dates based on emirate
  const getAvailableDates = (emirate: string) => {
    const dates = [];
    const today = new Date();
    
    // Dubai: Next day delivery
    // Other emirates: 2 days advance delivery
    const startDays = emirate === 'DUBAI' ? 1 : 2;
    
    for (let i = startDays; i < startDays + 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

  // Emirates list
  const emirates = [
    "DUBAI",
    "ABU_DHABI",
    "SHARJAH",
    "AJMAN",
    "UMM_AL_QUWAIN",
    "RAS_AL_KHAIMAH",
    "FUJAIRAH"
  ];

  // Calculate delivery charge based on emirate
  const calculateDeliveryCharge = (emirate: string) => {
    return emirate === 'DUBAI' ? 30 : 50;
  };

  // Calculate total with delivery charge and discounts
  const calculateTotal = () => {
    let baseTotal = cartTotal;
    
    // Apply coupon discount if any
    if (appliedCoupon) {
      if (appliedCoupon.type === 'PERCENTAGE') {
        const discountAmount = (baseTotal * appliedCoupon.value) / 100;
        baseTotal -= discountAmount;
      } else if (appliedCoupon.type === 'FIXED_AMOUNT') {
        baseTotal -= appliedCoupon.value;
      }
    }
    
    let total = baseTotal;
    
    // Add delivery charge if applicable
    if (deliveryMethod === DeliveryMethod.DELIVERY && deliveryDetailsState.emirate) {
      const deliveryCharge = deliveryDetailsState.charge !== undefined ? 
        deliveryDetailsState.charge : 
        calculateDeliveryCharge(deliveryDetailsState.emirate);
      console.log('Delivery Charge:', deliveryCharge);
      total += deliveryCharge;
    }
    
    return Math.max(0, total); // Ensure total is not negative
  };

  // Calculate coupon discount for display
  const calculateCouponDiscount = useMemo(() => {
    if (!appliedCoupon) return 0;
    
    if (appliedCoupon.type === 'PERCENTAGE') {
      return (cartTotal * appliedCoupon.value) / 100;
    } else if (appliedCoupon.type === 'FIXED_AMOUNT') {
      return appliedCoupon.value;
    }
    
    return 0;
  }, [appliedCoupon, cartTotal]);

  // Update emirate and recalculate total
  const handleEmirateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedEmirate = e.target.value;
    const defaultCharge = calculateDeliveryCharge(selectedEmirate);
    
    setDeliveryDetailsState(prevState => ({
      ...prevState, 
      emirate: selectedEmirate,
      // Reset time slot when emirate changes
      timeSlot: "",
      // Set delivery charge based on emirate
      charge: defaultCharge
    }));
    
    console.log(`Updated emirate to ${selectedEmirate} with default charge: ${defaultCharge}`);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    
    setIsValidatingCoupon(true);
    setCouponError('');
    
    try {
      const response = await apiMethods.pos.validateCoupon(couponCode, cartTotal);
      console.log('Coupon Response:', response);
      
      if (!response.data || !response.data.code) {
        setCouponError('Invalid coupon code');
        setAppliedCoupon(null);
        return;
      }
      
      // Parse numeric values and validate
      const parsedValue = parseFloat(String(response.data.value));
      if (isNaN(parsedValue) || parsedValue <= 0) {
        setCouponError('Invalid coupon value');
        setAppliedCoupon(null);
        return;
      }

      // Check minimum order amount if specified
      if (response.data.minOrderAmount && cartTotal < response.data.minOrderAmount) {
        setCouponError(`Minimum order amount required: AED ${response.data.minOrderAmount}`);
        setAppliedCoupon(null);
        return;
      }

      // Calculate discount based on coupon type
      let discount = 0;
      if (response.data.type === 'PERCENTAGE') {
        discount = (cartTotal * parsedValue) / 100;
        // Apply max discount if specified
        if (response.data.maxDiscount && discount > response.data.maxDiscount) {
          discount = response.data.maxDiscount;
        }
      } else { // FIXED_AMOUNT
        discount = parsedValue;
      }

      // Set the applied coupon with calculated discount
      setAppliedCoupon({
        code: response.data.code,
        type: response.data.type,
        value: parsedValue,
        description: response.data.description || '',
        minOrderAmount: response.data.minOrderAmount,
        maxDiscount: response.data.maxDiscount,
        discount: discount
      });

      toast.success('Coupon applied successfully!');
    } catch (error) {
      console.error('Error validating coupon:', error);
      setCouponError('Failed to validate coupon');
      setAppliedCoupon(null);
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
  };

  // Create or update customer
  const handleCreateCustomer = async (): Promise<boolean> => {
    try {
      if (!customerDetailsState.name || !customerDetailsState.phone) {
        return false;
      }

      // Split name into first and last name
      const [firstName, lastName] = customerDetailsState.name.trim().split(' ');
      const customerData = {
        customerName: customerDetailsState.name || '',
        customerPhone: customerDetailsState.phone || '',
        customerEmail: customerDetailsState.email || '',
      };

      const response = await apiMethods.pos.createOrUpdateCustomer(customerData);
      return response.data.success;
    } catch (error) {
      console.error('Error creating/updating customer:', error);
      return false;
    }
  };

  // Get order payments
  const getOrderPayments = (): Payment[] => {
    return paymentsState.map(payment => ({
      ...payment,
      metadata: {
        ...payment.metadata,
        source: 'POS' as const
      }
    }));
  };

  // Ensure customer details are not empty strings
  const sanitizeCustomerDetails = () => {
    // Trim all values to remove whitespace
    const trimmedName = customerDetailsState.name?.trim() || '';
    const trimmedEmail = customerDetailsState.email?.trim() || '';
    const trimmedPhone = customerDetailsState.phone?.trim() || '';
    
    // Only use the actual customer data, don't provide defaults
    const details = {
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone
    };
    
    console.log('Sanitized customer details:', details);
    return details;
  };

  const remainingAmountState = useMemo(() => {
    const totalPaid = paymentsState.reduce((sum, p) => sum + p.amount, 0);
    return Math.max(0, cartTotal - totalPaid);
  }, [cartTotal, paymentsState]);

  // Handle customer search
  const handleCustomerSearch = useCallback(async (searchTerm: string) => {
    try {
      const response = await apiMethods.customers.search(searchTerm);
      if (response.data) {
        const customers: Customer[] = response.data.map(customer => ({
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          addresses: customer.addresses || [], // Ensure addresses is always an array
          reward: {
            points: customer.reward?.points || 0
          }
        }));
        setSearchResults(customers); 
      }
    } catch (error) {
      console.error('Error searching customers:', error);
      toast.error('Failed to search customers');
    }
  }, []);

  // Handle customer create
  const handleCustomerCreate = useCallback(async (customer: Omit<Customer, 'id' | 'addresses' | 'reward'>) => {
    try {
      const response = await apiMethods.customers.create({
        ...customer,
        addresses: [],
        reward: {
          points: 0
        }
      });
      if (response.data) {
        const newCustomer: Customer = {
          ...response.data,
          addresses: [],
          reward: {
            points: 0
          }
        };
        handleCustomerSelect(newCustomer);
        toast.success('Customer created successfully!');
      }
    } catch (error) {
      console.error('Error creating customer:', error);
      toast.error('Failed to create customer');
    }
  }, [handleCustomerSelect]);

  const handlePaymentComplete = useCallback(() => {
    // Reset payment form
    setCurrentPaymentAmountState('');
    setCurrentPaymentReferenceState('');

    // If payment is complete, proceed with checkout
    if (calculateTotalPaid() >= cartTotal) {
      handleCreateOrder();
    }
  }, [cartTotal, calculateTotalPaid, handleCreateOrder]);

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-6xl transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                <div className="relative">
                  <button
                    onClick={onClose}
                    className="absolute right-0 top-0 p-4 text-gray-400 hover:text-gray-500"
                  >
                    <X className="h-6 w-6" />
                  </button>

                  <div className="mt-8">
                    <Dialog.Title
                      as="h3"
                      className="text-2xl font-semibold leading-6 text-gray-900 mb-8"
                    >
                      Checkout
                    </Dialog.Title>

                    <div className="flex flex-col lg:flex-row h-full space-y-8 lg:space-y-0 lg:space-x-8">
                      {/* Left Side - Customer Details & Delivery/Pickup */}
                      <div className="flex-1 lg:pr-8 lg:border-r">
                        {/* Customer Details */}
                        <div className="space-y-4 mb-8">
                          <h3 className="text-lg font-semibold">Customer Details:</h3>
                          <div ref={searchRef} className="relative">
                            <div className="relative">
                              <input
                                type="text"
                                value={customerDetailsState.name}
                                onChange={handleCustomerNameChange}
                                className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4 pl-12"
                                placeholder="Customer Name *"
                                autoComplete="off"
                                onFocus={() => {
                                  if (customerDetailsState.name.trim() !== '') {
                                    setShowSearchResults(true);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (showSearchResults && searchResults.length > 0) {
                                    if (e.key === 'ArrowDown') {
                                      e.preventDefault();
                                      const firstResult = searchResults[0];
                                      handleCustomerSelect(firstResult);
                                    } else if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      const firstResult = searchResults[0];
                                      handleCustomerSelect(firstResult);
                                    } else if (e.key === 'Escape') {
                                      e.preventDefault();
                                      setShowSearchResults(false);
                                    }
                                  }
                                }}
                                aria-expanded={showSearchResults}
                                aria-haspopup="listbox"
                                aria-controls="customer-search-results"
                                role="combobox"
                              />
                              <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                            </div>

                            {/* Search Results Dropdown */}
                            {showSearchResults && (
                              <div 
                                id="customer-search-results"
                                role="listbox"
                                className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200"
                              >
                                {isSearching ? (
                                  <div className="p-4 text-center text-gray-500">
                                    Searching...
                                  </div>
                                ) : searchResults.length > 0 ? (
                                  <ul className="max-h-60 overflow-auto">
                                    {searchResults.map((customer, index) => (
                                      <li
                                        key={customer.id}
                                        className="p-4 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                                        onClick={() => handleCustomerSelect(customer)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handleCustomerSelect(customer);
                                          }
                                        }}
                                        role="option"
                                        aria-selected={index === 0}
                                        tabIndex={0}
                                      >
                                        <div className="font-medium">
                                          {customer.firstName} {customer.lastName}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                          {customer.phone}
                                          {customer.email && ` • ${customer.email}`}
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <div className="p-4 text-center text-gray-500">
                                    No customers found
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                              type="tel"
                              value={customerDetailsState.phone}
                              onChange={(e) => setCustomerDetailsState((prev) => ({ ...prev, phone: e.target.value }))}
                              className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                              placeholder="Phone Number *"
                              required
                            />
                            <input
                              type="email"
                              value={customerDetailsState.email}
                              onChange={(e) => setCustomerDetailsState((prev) => ({ ...prev, email: e.target.value }))}
                              className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                              placeholder="Email Address *"
                              required
                            />
                          </div>
                        </div>

                        {/* Delivery/Pickup Selection */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">Delivery/Pickup:</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <button
                              type="button"
                              onClick={() => setDeliveryMethodState(DeliveryMethod.PICKUP)}
                              className={`p-4 text-center border-2 rounded-lg flex items-center justify-center ${
                                deliveryMethodState === DeliveryMethod.PICKUP
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200'
                              }`}
                            >
                              <div className={`w-6 h-6 border-2 rounded-full mr-3 flex items-center justify-center ${
                                deliveryMethodState === DeliveryMethod.PICKUP
                                  ? 'border-blue-500 bg-blue-500'
                                  : 'border-gray-300'
                              }`}>
                                {deliveryMethodState === DeliveryMethod.PICKUP && (
                                  <div className="w-3 h-3 bg-white rounded-full" />
                                )}
                              </div>
                              <span className="text-lg">Pickup</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeliveryMethodState(DeliveryMethod.DELIVERY)}
                              className={`p-4 text-center border-2 rounded-lg flex items-center justify-center ${
                                deliveryMethodState === DeliveryMethod.DELIVERY
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200'
                              }`}
                            >
                              <div className={`w-6 h-6 border-2 rounded-full mr-3 flex items-center justify-center ${
                                deliveryMethodState === DeliveryMethod.DELIVERY
                                  ? 'border-blue-500 bg-blue-500'
                                  : 'border-gray-300'
                              }`}>
                                {deliveryMethodState === DeliveryMethod.DELIVERY && (
                                  <div className="w-3 h-3 bg-white rounded-full" />
                                )}
                              </div>
                              <span className="text-lg">Delivery</span>
                            </button>
                          </div>
                        </div>

                        {/* Delivery Form */}
                        {deliveryMethodState === DeliveryMethod.DELIVERY && (
                          <div className="grid grid-cols-1 gap-4 pt-8">
                            <input
                              type="text"
                              value={deliveryDetailsState.streetAddress}
                              onChange={(e) => setDeliveryDetailsState((prev) => ({ ...prev, streetAddress: e.target.value }))}
                              className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                              placeholder="Street Address *"
                            />

                            <input
                              type="text"
                              value={deliveryDetailsState.apartment}
                              onChange={(e) => setDeliveryDetailsState((prev) => ({ ...prev, apartment: e.target.value }))}
                              className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                              placeholder="Apartment/Villa/Office (Optional)"
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <select
                                value={deliveryDetailsState.emirate}
                                onChange={handleEmirateChange}
                                className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                              >
                                <option value="">Select Emirate *</option>
                                {emirates.map((emirate) => (
                                  <option key={emirate} value={emirate}>{emirate.replace('_', ' ')}</option>
                                ))}
                              </select>

                              <input
                                type="text"
                                value={deliveryDetailsState.city}
                                onChange={(e) => setDeliveryDetailsState((prev) => ({ ...prev, city: e.target.value }))}
                                className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                placeholder="City/Area *"
                              />
                            </div>

                            {deliveryDetailsState.emirate && (
                              <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <select
                                    value={deliveryDetailsState.date}
                                    onChange={(e) => setDeliveryDetailsState((prev) => ({ ...prev, date: e.target.value }))}
                                    className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                  >
                                    <option value="">Select Date *</option>
                                    {getAvailableDates(deliveryDetailsState.emirate).map((date) => (
                                      <option key={date} value={date}>
                                        {new Date(date).toLocaleDateString('en-US', { 
                                          weekday: 'short', 
                                          month: 'short', 
                                          day: 'numeric' 
                                        })}
                                      </option>
                                    ))}
                                  </select>

                                  <select
                                    value={deliveryDetailsState.timeSlot}
                                    onChange={(e) => setDeliveryDetailsState((prev) => ({ ...prev, timeSlot: e.target.value }))}
                                    className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                  >
                                    <option value="">Select Time Slot *</option>
                                    {getTimeSlots(deliveryDetailsState.emirate).map((slot) => (
                                      <option key={slot} value={slot}>{slot}</option>
                                    ))}
                                  </select>
                                </div>

                                <textarea
                                  value={deliveryDetailsState.instructions}
                                  onChange={(e) => setDeliveryDetailsState((prev) => ({ ...prev, instructions: e.target.value }))}
                                  className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                  placeholder="Delivery Instructions (Optional)"
                                  rows={2}
                                />
                              </>
                            )}
                          </div>
                        )}

                        {/* Pickup Form */}
                        {deliveryMethodState === DeliveryMethod.PICKUP && (
                          <div className="grid grid-cols-1 gap-4 pt-8">
                            <select
                              value={pickupDetailsState.date}
                              onChange={(e) => setPickupDetailsState((prev) => ({ ...prev, date: e.target.value }))}
                              className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                            >
                              <option value="">Select Pickup Date *</option>
                              {getAvailableDates('DUBAI').map((date) => (
                                <option key={date} value={date}>
                                  {new Date(date).toLocaleDateString('en-US', { 
                                    weekday: 'short', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })}
                                </option>
                              ))}
                            </select>

                            <select
                              value={pickupDetailsState.timeSlot}
                              onChange={(e) => setPickupDetailsState((prev) => ({ ...prev, timeSlot: e.target.value }))}
                              className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                            >
                              <option value="">Select Pickup Time *</option>
                              {getTimeSlots('DUBAI').map((slot) => (
                                <option key={slot} value={slot}>{slot}</option>
                              ))}
                            </select>
                          </div>
                        )}


 {/* Gift Section */}
 <div className="mt-6 space-y-4">
                          <button
                            type="button"
                            onClick={() => {
                              setGiftDetailsState(prev => ({ ...prev, isGift: !prev.isGift }));
                              setIsGiftState(!isGiftState);
                            }}
                            className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-gray-200 hover:border-blue-500 transition-colors relative"
                          >
                            <div className="flex items-center">
                              <span className="text-lg font-medium text-gray-900">Send as a Gift</span>
                            </div>
                            <div className={`w-14 h-8 relative rounded-full transition-colors ${isGiftState ? 'bg-blue-600' : 'bg-gray-200'}`}>
                              <div 
                                className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform transform ${
                                  isGiftState ? 'translate-x-7' : 'translate-x-1'
                                }`} 
                              />
                            </div>
                          </button>

                          {isGiftState && (
                            <div className="space-y-4 p-4 bg-gray-50 rounded-xl">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input
                                  type="text"
                                  value={giftDetailsState.recipientName}
                                  onChange={(e) => setGiftDetailsState(prev => ({ ...prev, recipientName: e.target.value }))}
                                  className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-lg p-4"
                                  placeholder="Recipient Name"
                                />
                                <input
                                  type="tel"
                                  value={giftDetailsState.recipientPhone}
                                  onChange={(e) => setGiftDetailsState(prev => ({ ...prev, recipientPhone: e.target.value }))}
                                  className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-lg p-4"
                                  placeholder="Recipient Phone"
                                />
                              </div>
                              <textarea
                                value={giftDetailsState.message}
                                onChange={(e) => setGiftDetailsState(prev => ({ ...prev, message: e.target.value }))}
                                className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-lg p-4"
                                placeholder="Gift Message"
                                rows={3}
                              />
                              <div className="flex items-center space-x-4">
                                <div className="flex-1">
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Include Cash Gift</label>
                                  <div className="relative mt-1 rounded-xl shadow-sm">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                                      <span className="text-gray-500 sm:text-lg">AED</span>
                                    </div>
                                    <input
                                      type="number"
                                      value={giftDetailsState.cashAmount || ''}
                                      onChange={(e) => setGiftDetailsState(prev => ({
                                        ...prev, 
                                        cashAmount: e.target.value,
                                        includeCash: e.target.value !== ''
                                      }))}
                                      className="w-20 text-lg font-medium border-b-2 border-gray-300 focus:border-black focus:outline-none text-right"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                       

                        
                      </div>

                      {/* Right Side - Order Summary */}
                      <div className="flex-1 lg:pl-8">
                        {/* Order Summary */}
                        <div className="mb-8">
                          <h4 className="text-xl font-medium mb-6">Order Summary</h4>
                          <div className="max-h-[40vh] overflow-y-auto pr-4 space-y-6">
                            {(() => {
                              console.log('Rendering cart items in checkout modal:', JSON.stringify(cart, null, 2));
                              console.log('Cart length:', Array.isArray(cart) ? cart.length : 'cart is not an array');
                              console.log('Cart total:', cartTotal);
                              return null;
                            })()}
                            
                            {Array.isArray(cart) && cart.length > 0 ? (
                              cart.map((item, index) => {
                                console.log(`Rendering cart item ${index}:`, JSON.stringify(item, null, 2));
                                
                                // Skip rendering if product is missing or invalid
                                if (!item || !item.product) {
                                  console.error(`Invalid cart item at index ${index}:`, item);
                                  return null;
                                }
                                
                                // Ensure selectedVariations is an array
                                const selectedVariations = Array.isArray(item.selectedVariations) 
                                  ? item.selectedVariations.map(v => {
                                      if (typeof v === 'object' && v !== null) {
                                        return {
                                          id: v.id || '',
                                          type: v.type,
                                          value: v.value,
                                          price: Number(v.price) || 0
                                        };
                                      }
                                      return {
                                        id: '',
                                        type: '',
                                        value: '',
                                        price: 0
                                      };
                                    })
                                  : [];

                                // Ensure customImages is an array
                                const customImages = Array.isArray(item.customImages) 
                                  ? item.customImages
                                  : [];
                                 
                                console.log(`Item ${index} allowCustomImages:`, item.product?.allowCustomImages);
                                console.log(`Item ${index} customImages:`, customImages);
                                 
                                return (
                                  <div
                                    key={item.id || `item-${index}`}
                                    className="flex items-start justify-between p-4 bg-gray-50 rounded-lg"
                                  >
                                    <div className="flex-1">
                                      <p className="text-lg font-medium">{item.product?.name || 'Unknown Product'}</p>
                                      <p className="text-base text-gray-500 mt-2">
                                        Quantity: {item.quantity || 0}
                                      </p>
                                      {selectedVariations.length > 0 && selectedVariations.map((variation, i) => {
                                          // Ensure variation has the correct structure
                                          const type = typeof variation === 'object' && variation !== null 
                                            ? (variation.type || variation.id || '').toString()
                                            : '';
                                          const value = typeof variation === 'object' && variation !== null 
                                            ? (variation.value || variation.id || '').toString()
                                            : '';
                                          const priceAdjustment = typeof variation === 'object' && variation !== null 
                                            ? Number(variation.priceAdjustment) || 0
                                            : 0;
                                          
                                          return (
                                            <p
                                              key={`${item.id}-var-${i}`}
                                              className="text-base text-gray-500"
                                            >
                                              {type}: {value}
                                              {priceAdjustment > 0 && ` (+AED ${priceAdjustment.toFixed(2)})`}
                                            </p>
                                          );
                                        })}
                                      {item.notes && (
                                        <p className="text-sm text-gray-600 mt-2">
                                          Notes: {item.notes}
                                        </p>
                                      )}

                                      {/* Spacer before custom images */}
                                      <div className="mt-4 border-t border-gray-200"></div>

                                      {/* Custom Images Upload */}
                                      <div className="mt-6 border-2 border-dashed border-blue-300 p-4 rounded-lg bg-blue-50 hover:border-blue-400 transition-colors relative">
                                        <div className="absolute -top-3 left-4 bg-white px-2 text-xs font-semibold text-blue-600 flex items-center">
                                           <Camera className="w-3 h-3 mr-1" /> UPLOAD IMAGES
                                         </div>
                                        <div className="flex items-center justify-between mb-2">
                                          <label className="text-sm font-semibold text-gray-800">
                                            Upload Reference Images
                                          </label>
                                          <span className="text-xs text-gray-500">
                                            Add photos for your order
                                          </span>
                                        </div>
                                        <ImageUpload
                                          onChange={(images) => {
                                            console.log('Custom images updated:', images);
                                            const updatedCart = cart.map(cartItem =>
                                              cartItem.id === item.id
                                                ? { ...cartItem, customImages: images }
                                                : cartItem
                                            );
                                            setCart(updatedCart);
                                          }}
                                          value={customImages}
                                        />
                                        {customImages.length > 0 && (
                                          <div className="mt-2 text-sm text-gray-500">
                                            {customImages.length} image{customImages.length !== 1 ? 's' : ''} added
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-lg font-medium ml-4">
                                      AED {(item.product.basePrice * item.quantity).toFixed(2)}
                                    </p>
                                  </div>
                                );
                              }).filter(Boolean)
                            ) : (
                              <div className="text-center py-8 text-gray-500">
                                No items in cart
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col space-y-4 p-4 bg-gray-50 rounded-lg mt-4">
                            <div className="flex justify-between items-center font-medium">
                              <p className="text-xl">Subtotal</p>
                              <p className="text-xl">AED {cartTotal.toFixed(2)}</p>
                            </div>
                            
                            {appliedCoupon && (
                              <div className="flex justify-between items-center font-medium">
                                <div className="flex items-center">
                                  <p className="text-xl text-green-600">
                                    Discount ({appliedCoupon.code})
                                    {appliedCoupon.type === 'PERCENTAGE' && ` (${appliedCoupon.value}%)`}
                                  </p>
                                  <button
                                    onClick={() => {
                                      setAppliedCoupon(null);
                                      setCouponCode('');
                                    }}
                                    className="ml-2 text-red-500 hover:text-red-700"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                                <p className="text-xl text-green-600">-AED {appliedCoupon.discount.toFixed(2)}</p>
                              </div>
                            )}
                            
                            {deliveryMethod === DeliveryMethod.DELIVERY && deliveryDetailsState.emirate && (
                              <div className="flex justify-between items-center font-medium">
                                <p className="text-xl">Delivery Charge ({deliveryDetailsState.emirate.replace('_', ' ')})</p>
                                <p className="text-xl">AED {deliveryDetailsState.charge.toFixed(2)}</p>
                              </div>
                            )}

                            <div className="flex justify-between items-center font-medium pt-2 border-t border-gray-200">
                              <p className="text-2xl font-bold">Total</p>
                              <p className="text-2xl font-bold">AED {calculateFinalTotal().toFixed(2)}</p>
                            </div>

                            {/* Show minimum order amount warning if coupon has minimum requirement */}
                            {appliedCoupon?.minOrderAmount && cartTotal < appliedCoupon.minOrderAmount && (
                              <div className="text-sm text-red-500 mt-2">
                                Minimum order amount required: AED {appliedCoupon.minOrderAmount}
                              </div>
                            )}
                          </div>

                          {/* Payment Method */}
                          <div className="mt-8 pt-8 border-t">
                            <h4 className="text-xl font-medium mb-6">Payment Method</h4>
                            <div className="space-y-4">
                              <div className="flex space-x-4">
                                <button
                                  type="button"
                                  onClick={() => handlePaymentMethodSelect(POSPaymentMethod.CASH)}
                                  className={`flex-1 p-6 text-lg font-medium rounded-xl border-2 transition-all ${
                                    currentPaymentMethodState === POSPaymentMethod.CASH
                                      ? "bg-black text-white"
                                      : "bg-gray-100 text-gray-700"
                                  }`}
                                >
                                  Cash
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePaymentMethodSelect(POSPaymentMethod.CARD)}
                                  className={`flex-1 p-6 text-lg font-medium rounded-xl border-2 transition-all ${
                                    currentPaymentMethodState === POSPaymentMethod.CARD
                                      ? "bg-black text-white"
                                      : "bg-gray-100 text-gray-700"
                                  }`}
                                >
                                  Card
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePaymentMethodSelect(POSPaymentMethod.SPLIT)}
                                  className={`flex-1 p-6 text-lg font-medium rounded-xl border-2 transition-all ${
                                    isSplitPaymentState
                                      ? "bg-black text-white"
                                      : "bg-gray-100 text-gray-700"
                                  }`}
                                >
                                  Split
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePaymentMethodSelect(POSPaymentMethod.PARTIAL)}
                                  className={`flex-1 p-6 text-lg font-medium rounded-xl border-2 transition-all ${
                                    currentPaymentMethodState === POSPaymentMethod.PARTIAL
                                      ? "bg-black text-white"
                                      : "bg-gray-100 text-gray-700"
                                  }`}
                                >
                                  Partial
                                </button>
                              </div>

                              {/* Split Payment Form */}
                              {isSplitPaymentState && (
                                <div className="mt-6 space-y-6">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">Cash Amount</label>
                                      <input
                                        type="number"
                                        value={splitCashAmount}
                                        onChange={(e) => setSplitCashAmount(e.target.value)}
                                        className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                        placeholder="Enter cash amount"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">Card Amount</label>
                                      <input
                                        type="number"
                                        value={splitCardAmount}
                                        onChange={(e) => setSplitCardAmount(e.target.value)}
                                        className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                        placeholder="Enter card amount"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Card Reference</label>
                                    <input
                                      type="text"
                                      value={splitCardReference}
                                      onChange={(e) => setSplitCardReference(e.target.value)}
                                      className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                      placeholder="Enter card reference"
                                    />
                                  </div>
                                  <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl">
                                    <div className="space-y-1">
                                      <div className="text-sm font-medium text-gray-900">
                                        Total: AED {cartTotal.toFixed(2)}
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        Remaining: AED {(cartTotal - (parseFloat(splitCashAmount) || 0) - (parseFloat(splitCardAmount) || 0)).toFixed(2)}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={handleSplitPayment}
                                      className="px-6 py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-900"
                                    >
                                      Apply Split Payment
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Payment Summary */}
                              {paymentsState.length > 0 && (
                                <div className="mt-6 bg-gray-50 rounded-xl p-3">
                                  <div className="space-y-2">
                                    {paymentsState.map(payment => (
                                      <div key={payment.id} className="flex items-center justify-between py-2 px-3">
                                        <div className="flex items-center space-x-3">
                                          <div className={`px-2 py-1 text-sm rounded-lg ${
                                            payment.method === POSPaymentMethod.CASH ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                                          }`}>
                                            {payment.method}
                                          </div>
                                          {payment.reference && (
                                            <span className="text-sm text-gray-500">Ref: {payment.reference}</span>
                                          )}
                                          {payment.status === POSPaymentStatus.PARTIALLY_PAID && (
                                            <div className="px-2 py-1 text-sm rounded-lg bg-yellow-100 text-yellow-800">
                                              Partial Payment
                                            </div>
                                          )}
                                          {payment.metadata?.futurePaymentMethod && (
                                            <div className="text-sm text-gray-500">
                                              Future: {payment.metadata.futurePaymentMethod}
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex items-center space-x-3">
                                          <span className="font-medium">AED {payment.amount.toFixed(2)}</span>
                                          <button
                                            type="button"
                                            onClick={() => handleRemovePayment(payment.id)}
                                            className="text-gray-400 hover:text-red-600"
                                          >
                                            <X className="h-4 w-4" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                    <div className="flex justify-between items-center py-2 px-3 border-t border-gray-200">
                                      <span className="text-sm font-medium text-gray-900">Remaining</span>
                                      <span className="font-medium">AED {remainingAmountState.toFixed(2)}</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Coupon Section */}
                          <div className="mt-6 space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-lg font-medium text-gray-900">Apply Coupon</h3>
                            </div>
                            <div className="flex space-x-2">
                              <input
                                type="text"
                                value={couponCode}
                                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                className="flex-1 rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                placeholder="Enter Coupon Code"
                              />
                              <button
                                onClick={handleApplyCoupon}
                                disabled={!couponCode || isValidatingCoupon}
                                className="px-6 py-4 bg-black text-white rounded-xl font-medium hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed"
                              >
                                {isValidatingCoupon ? 'Validating...' : 'Apply'}
                              </button>
                            </div>
                            {couponError && (
                              <p className="text-red-500">{couponError}</p>
                            )}
                            {appliedCoupon && (
                              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="text-green-700 font-medium">{appliedCoupon.code}</p>
                                    <p className="text-green-600 text-sm">
                                      {appliedCoupon.type === 'PERCENTAGE' 
                                        ? `${appliedCoupon.value}% off`
                                        : `AED ${appliedCoupon.value} off`
                                      }
                                    </p>
                                  </div>
                                  <button
                                    onClick={handleRemoveCoupon}
                                    className="text-green-700 hover:text-green-800"
                                  >
                                    <X className="h-5 w-5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="mt-8">
                            <div className="flex gap-4">
                              <button
                                type="button"
                                onClick={handleCreateOrder}
                                disabled={isSubmitting || isQueuingOrder}
                                className={`flex-[2] inline-flex justify-center rounded-lg border border-transparent shadow-sm px-6 py-4 bg-black text-xl font-medium text-white hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors`}
                              >
                                {isSubmitting ? "Processing..." : "Complete Order"}
                              </button>
                              <button
                                type="button"
                                onClick={handleQueueOrder}
                                disabled={isSubmitting || isQueuingOrder}
                                className={`flex-1 inline-flex justify-center rounded-lg border-2 border-black px-6 py-4 bg-white text-lg font-medium text-black hover:bg-gray-50 disabled:bg-gray-100 disabled:border-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors`}
                              >
                                {isQueuingOrder ? "Processing..." : "Queue Order"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
