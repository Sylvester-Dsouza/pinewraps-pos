// Import necessary modules and components
import { Fragment, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { X, Minus, Plus, Trash, Search, ShoppingCart, Upload, Camera, User, MapPin, ListOrdered } from "lucide-react";
import { toast } from "@/lib/toast-utils";
import { apiMethods } from "@/services/api";
import { POSOrderStatus, POSPaymentMethod, POSPaymentStatus, DeliveryMethod, OrderPayment, POSOrderData, POSOrderItemData, ProductVariation, CheckoutDetails, ParkedOrderData } from "@/types/order";
import { Customer, CustomerAddress, CustomerDetails, DeliveryDetails, PickupDetails, GiftDetails } from "@/types/customer";
import { Payment } from "@/types/payment";
import { nanoid } from 'nanoid';
import Image from "next/image";
import ImageUpload from "./custom-images/image-upload";
import { useAuth } from "@/providers/auth-provider";
import debounce from 'lodash/debounce';
import { CartItem, CustomImage } from "@/types/cart";
import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';
import crypto from 'crypto';
import { drawerService } from '@/services/drawer.service';
import { uploadCustomImages } from '@/utils/firebase-storage';
import axios from 'axios';
import OrderReceipt, { generateReceiptContent } from '@/components/receipt/OrderReceipt';

// Define the CheckoutModalProps interface
interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  setCart: (cart: CartItem[]) => void;
  cartTotal: number;
  onCheckoutComplete?: (checkoutDetails: CheckoutDetails) => void;
  onSaveCheckoutDetails?: (checkoutDetails: CheckoutDetails) => void;
  customerDetails?: CustomerDetails;
  deliveryMethod?: DeliveryMethod;
  deliveryDetails?: DeliveryDetails;
  pickupDetails?: PickupDetails;
  giftDetails?: GiftDetails;
  payments?: Payment[];
  paymentMethod?: POSPaymentMethod;
  paymentReference?: string;
  orderName?: string; 
}

// Define the CheckoutModal component
export default function CheckoutModal({
  isOpen,
  onClose,
  cart,
  setCart,
  cartTotal,
  onCheckoutComplete,
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
  const [isParkingOrder, setIsParkingOrder] = useState(false);
  const [teamSelection, setTeamSelection] = useState<'KITCHEN' | 'DESIGN' | 'BOTH'>('KITCHEN');
  const [deliveryMethodState, setDeliveryMethodState] = useState<DeliveryMethod>(
    deliveryMethod && Object.values(DeliveryMethod).includes(deliveryMethod) 
      ? deliveryMethod 
      : DeliveryMethod.PICKUP
  );
  const [customerDetailsState, setCustomerDetailsState] = useState<CustomerDetails>({
    name: customerDetails?.name || "",
    email: customerDetails?.email || "",
    phone: customerDetails?.phone || "",
  });
  const [giftDetailsState, setGiftDetailsState] = useState<GiftDetails>({
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
  const [searchResults, setSearchResults] = useState<Array<Customer>>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef(null);
  const [deliveryDetailsState, setDeliveryDetailsState] = useState<DeliveryDetails>({
    date: deliveryDetails?.date || "",
    timeSlot: deliveryDetails?.timeSlot || "",
    instructions: deliveryDetails?.instructions || "",
    streetAddress: deliveryDetails?.streetAddress || "",
    apartment: deliveryDetails?.apartment || "",
    emirate: deliveryDetails?.emirate || "",
    city: deliveryDetails?.city || "",
    charge: deliveryDetails?.charge || 0,
  });
  const [pickupDetailsState, setPickupDetailsState] = useState<PickupDetails>({
    date: pickupDetails?.date || (new Date().toISOString().split('T')[0]),
    timeSlot: pickupDetails?.timeSlot || "",
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

  // Order routing state
  const [selectedRoute, setSelectedRoute] = useState<'KITCHEN' | 'DESIGN' | 'BOTH' | null>(null);
  
  // Payment state
  const [showRemainingPaymentModal, setShowRemainingPaymentModal] = useState(false);
  const [showSplitPaymentModal, setShowSplitPaymentModal] = useState(false);
  const [currentPaymentMethodState, setCurrentPaymentMethodState] = useState<POSPaymentMethod>(POSPaymentMethod.CASH);
  const [currentPaymentReferenceState, setCurrentPaymentReferenceState] = useState('');
  const [currentPaymentAmountState, setCurrentPaymentAmountState] = useState('');
  const [isPartialPaymentState, setIsPartialPaymentState] = useState(false);
  const [isSplitPaymentState, setIsSplitPaymentState] = useState(false);
  const [partialPaymentMethod, setPartialPaymentMethod] = useState<POSPaymentMethod>(POSPaymentMethod.CASH);
  const [splitCashAmount, setSplitCashAmount] = useState('');
  const [splitCardAmount, setSplitCardAmount] = useState('');
  const [splitCardReference, setSplitCardReference] = useState('');
  const [paymentsState, setPaymentsState] = useState<Payment[]>([]);

  // Get the payment method for API
  const getApiPaymentMethod = () => {
    // Check if there are any payments already made
    if (paymentsState.length > 0) {
      // Check for partial payments
      const hasPartialPayment = paymentsState.some(p => p.isPartialPayment || p.status === POSPaymentStatus.PARTIALLY_PAID);
      if (hasPartialPayment) {
        return POSPaymentMethod.PARTIAL;
      }
      
      // Check for split payments
      if (isSplitPaymentState || paymentsState.some(p => p.method === POSPaymentMethod.SPLIT)) {
        return POSPaymentMethod.SPLIT;
      }
      
      // If multiple payment methods are used
      const methods = new Set(paymentsState.map(p => p.method));
      if (methods.size > 1) {
        // Multiple different payment methods used - use SPLIT instead of 'MULTIPLE'
        return POSPaymentMethod.SPLIT;
      }
      
      // Return the payment method of the first payment
      return paymentsState[0].method;
    }
    
    // If split payment is active, always return SPLIT
    if (isSplitPaymentState) {
      return POSPaymentMethod.SPLIT;
    }
    
    // Otherwise use the current payment method
    return currentPaymentMethodState;
  };

  // Prepare order data for API
  const preparePOSOrderData = useCallback((processedCart = cart) => {
    const sanitizedCustomerDetails = sanitizeCustomerDetails();
    const totalWithDelivery = deliveryMethodState === DeliveryMethod.DELIVERY ? cartTotal + (deliveryDetailsState?.charge || 0) : cartTotal;

    // Create order items from cart
    const orderItems = processedCart.map(item => {
      // For custom products, use the product's basePrice directly (which was set to the custom price)
      // and ignore variation price adjustments
      if (item.product.allowCustomPrice) {
        const unitPrice = item.product.basePrice;
        
        const itemData: POSOrderItemData = {
          id: nanoid(),
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: unitPrice,
          totalPrice: unitPrice * item.quantity,
          sku: item.product.sku || '',
          requiresKitchen: item.product.requiresKitchen || false,
          requiresDesign: item.product.requiresDesign || false,
          variations: {
            variationsObj: (item.selectedVariations || []).reduce((acc, v) => ({
              ...acc,
              [v.type]: v.value
            }), {}),
            selectedVariations: (item.selectedVariations || []).map(v => ({
              id: nanoid(),
              type: v.type,
              value: v.value,
              priceAdjustment: v.price || 0
            }))
          },
          selectedVariations: (item.selectedVariations || []).map(v => ({
            id: nanoid(),
            type: v.type,
            value: v.value,
            priceAdjustment: v.price || 0
          })),
          // Add custom images if available
          customImages: item.customImages && item.customImages.length > 0 ? item.customImages.map(img => ({
            id: img.id || nanoid(),
            url: img.url || '',
            comment: img.comment || ''
          })) : undefined
        };

        return itemData;
      } else {
        // Calculate unit price including variations
        const variationPriceAdjustments = (item.selectedVariations || []).reduce(
          (total, variation) => total + (variation.price || variation.priceAdjustment || 0), 
          0
        );
        const unitPrice = item.product.basePrice + variationPriceAdjustments;
        
        const itemData: POSOrderItemData = {
          id: nanoid(),
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: unitPrice,
          totalPrice: unitPrice * item.quantity,
          sku: item.product.sku || '',
          requiresKitchen: item.product.requiresKitchen || false,
          requiresDesign: item.product.requiresDesign || false,
          variations: {
            variationsObj: (item.selectedVariations || []).reduce((acc, v) => ({
              ...acc,
              [v.type]: v.value
            }), {}),
            selectedVariations: (item.selectedVariations || []).map(v => ({
              id: nanoid(),
              type: v.type,
              value: v.value,
              priceAdjustment: v.price || v.priceAdjustment || 0
            }))
          },
          selectedVariations: (item.selectedVariations || []).map(v => ({
            id: nanoid(),
            type: v.type,
            value: v.value,
            priceAdjustment: v.price || v.priceAdjustment || 0
          })),
          // Add custom images if available
          customImages: item.customImages && item.customImages.length > 0 ? item.customImages.map(img => ({
            id: img.id || nanoid(),
            url: img.url || '',
            comment: img.comment || ''
          })) : undefined
        };

        return itemData;
      }
    });

    // Let the backend handle routing based on product categories
    const hasKitchenProducts = processedCart.some(item => item.product.requiresKitchen);
    const hasDesignProducts = processedCart.some(item => item.product.requiresDesign);
    const requiresKitchen = hasKitchenProducts;
    const requiresDesign = hasDesignProducts;
    const requiresSequentialProcessing = hasKitchenProducts && hasDesignProducts;
    
    // Default values for routing metadata - the backend will override these based on product categories
    let initialQueue = POSOrderStatus.PENDING;
    let assignedTeam = null;
    let processingFlow = [];

    // Ensure we have at least one payment in the payments array
    let payments = [...paymentsState];
    if (payments.length === 0 && currentPaymentMethodState) {
      // Create a default payment with the selected payment method
      const defaultPayment: Payment = {
        id: nanoid(),
        amount: totalWithDelivery,
        method: currentPaymentMethodState,
        reference: currentPaymentMethodState === POSPaymentMethod.CARD ? currentPaymentReferenceState || null : null,
        status: POSPaymentStatus.FULLY_PAID
      };
      
      // Add specific fields based on payment method
      if (currentPaymentMethodState === POSPaymentMethod.CASH) {
        defaultPayment.cashAmount = totalWithDelivery;
        defaultPayment.changeAmount = 0;
      } else if (currentPaymentMethodState === POSPaymentMethod.CARD) {
        defaultPayment.reference = currentPaymentReferenceState || null;
      } else if (currentPaymentMethodState === POSPaymentMethod.SPLIT) {
        defaultPayment.isSplitPayment = true;
        // Use the actual entered values instead of defaulting to 50/50
        const cashAmount = parseFloat(splitCashAmount) || 0;
        const cardAmount = parseFloat(splitCardAmount) || 0;
        
        // If both amounts are 0, then use the total amount (backward compatibility)
        if (cashAmount === 0 && cardAmount === 0) {
          defaultPayment.cashPortion = totalWithDelivery / 2;
          defaultPayment.cardPortion = totalWithDelivery / 2;
        } else {
          defaultPayment.cashPortion = cashAmount;
          defaultPayment.cardPortion = cardAmount;
        }
        defaultPayment.cardReference = splitCardReference || currentPaymentReferenceState || null;
      } else if (currentPaymentMethodState === POSPaymentMethod.PARTIAL) {
        defaultPayment.isPartialPayment = true;
        // Default to half now, half later
        defaultPayment.amount = totalWithDelivery / 2;
        defaultPayment.remainingAmount = totalWithDelivery / 2;
        defaultPayment.futurePaymentMethod = POSPaymentMethod.CARD
      }
      
      payments = [defaultPayment];
    }

    // Check if this is a partial payment order
    const hasPartialPayment = payments.some(p => p.isPartialPayment || p.status === POSPaymentStatus.PARTIALLY_PAID);
    const finalTotal = calculateFinalTotal();
    
    // Calculate the total amount actually being paid (important for partial payments)
    const totalPaidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);

    const orderData: POSOrderData = {
      // Order metadata
      status: POSOrderStatus.PENDING,

      // Items and Payments
      items: orderItems,
      payments: payments.map(p => {
        const paymentData: OrderPayment = {
          id: p.id,
          amount: p.amount,
          method: p.method,
          reference: p.reference || null,
          status: p.status || POSPaymentStatus.FULLY_PAID
        };

        // Add specific fields based on payment method
        if (p.method === POSPaymentMethod.CASH) {
          paymentData.cashAmount = typeof p.cashAmount === 'number' ? p.cashAmount : 
            parseFloat(p.cashAmount as unknown as string || p.amount.toString());
          paymentData.changeAmount = typeof p.changeAmount === 'number' ? p.changeAmount : 
            parseFloat(p.changeAmount as unknown as string || '0');
        } else if (p.method === POSPaymentMethod.SPLIT) {
          paymentData.isSplitPayment = true;
          // Use the actual cash and card portions from the payment object
          // Only use the 50/50 split as a fallback if no values are provided
          if (p.cashPortion !== undefined && p.cashPortion !== null) {
            paymentData.cashPortion = p.cashPortion;
          } else {
            // Fallback to entered values, but never default to 50/50 split
            const cashAmount = parseFloat(splitCashAmount) || 0;
            paymentData.cashPortion = cashAmount;
          }
          
          if (p.cardPortion !== undefined && p.cardPortion !== null) {
            paymentData.cardPortion = p.cardPortion;
          } else {
            // Fallback to entered values, but never default to 50/50 split
            const cardAmount = parseFloat(splitCardAmount) || 0;
            paymentData.cardPortion = cardAmount;
          }
          paymentData.cardReference = p.cardReference || splitCardReference || null;
        } else if (p.method === POSPaymentMethod.PARTIAL || p.isPartialPayment) {
          paymentData.isPartialPayment = true;
          paymentData.remainingAmount = finalTotal - p.amount;
          paymentData.futurePaymentMethod = p.futurePaymentMethod || POSPaymentMethod.CARD;
        }

        return paymentData;
      }),
      // Use the actual amount paid for the total when it's a partial payment
      // This ensures the backend validation passes (payment amount matches order total)
      total: hasPartialPayment ? totalPaidAmount : totalWithDelivery,
      subtotal: cartTotal,
      allowPartialPayment: hasPartialPayment, // Flag to tell backend this order allows partial payment
      // Store the real total for reference
      actualTotal: totalWithDelivery,
      
      // Payment details
      paymentMethod: getApiPaymentMethod(),
      paymentReference: currentPaymentReferenceState || '',

      // Customer details
      customerName: sanitizedCustomerDetails.name,
      customerEmail: sanitizedCustomerDetails.email || '',
      customerPhone: sanitizedCustomerDetails.phone,

      // Processing flags based on order flow
      requiresKitchen,
      requiresDesign,
      requiresFinalCheck: true,
      requiresSequentialProcessing,

      // Notes
      notes: orderNotes || '',
      designNotes: '',
      kitchenNotes: '',
      finalCheckNotes: '',

      // Delivery method
      deliveryMethod: deliveryMethodState,

      // Delivery details
      deliveryDate: deliveryMethodState === DeliveryMethod.DELIVERY ? deliveryDetailsState?.date : undefined,
      deliveryTimeSlot: deliveryMethodState === DeliveryMethod.DELIVERY ? deliveryDetailsState?.timeSlot : undefined,
      deliveryInstructions: deliveryMethodState === DeliveryMethod.DELIVERY ? deliveryDetailsState?.instructions?.trim() || '' : undefined,
      deliveryCharge: deliveryMethodState === DeliveryMethod.DELIVERY ? deliveryDetailsState?.charge : undefined,
      streetAddress: deliveryMethodState === DeliveryMethod.DELIVERY ? deliveryDetailsState?.streetAddress?.trim() || '' : undefined,
      apartment: deliveryMethodState === DeliveryMethod.DELIVERY ? deliveryDetailsState?.apartment?.trim() || '' : undefined,
      emirate: deliveryMethodState === DeliveryMethod.DELIVERY ? deliveryDetailsState?.emirate : undefined,
      city: deliveryMethodState === DeliveryMethod.DELIVERY ? deliveryDetailsState?.city : undefined,

      // Pickup details
      pickupDate: deliveryMethodState === DeliveryMethod.PICKUP ? pickupDetailsState?.date : undefined,
      pickupTimeSlot: deliveryMethodState === DeliveryMethod.PICKUP ? pickupDetailsState?.timeSlot : undefined,
      storeLocation: deliveryMethodState === DeliveryMethod.PICKUP ? 'Main Store' : undefined,

      // Gift details
      isGift: giftDetailsState?.isGift || false,
      giftRecipientName: giftDetailsState?.isGift ? giftDetailsState.recipientName?.trim() || '' : undefined,
      giftRecipientPhone: giftDetailsState?.isGift ? giftDetailsState.recipientPhone?.trim() || '' : undefined,
      giftMessage: giftDetailsState?.isGift ? giftDetailsState.message?.trim() || '' : undefined,
      giftCashAmount: giftDetailsState?.isGift && giftDetailsState.includeCash ? 
        giftDetailsState.cashAmount?.trim() || '0' : 
        undefined,

      // Additional metadata for routing
      metadata: {
        routing: {
          initialQueue,
          status: POSOrderStatus.PENDING,
          assignedTeam,
          processingFlow,
          currentStep: 0
        },
        qualityControl: {
          requiresFinalCheck: true,
          canReturnToKitchen: hasKitchenProducts,
          canReturnToDesign: hasDesignProducts,
          finalCheckNotes: ''
        }
      }
    };

    return orderData;
  }, [
    deliveryMethodState,
    deliveryDetailsState,
    pickupDetailsState,
    giftDetailsState,
    paymentsState,
    cartTotal,
    currentPaymentMethodState,
    currentPaymentReferenceState
  ]);

  // Validate order details before proceeding
  const validateOrderDetails = useCallback(() => {
    // Basic cart validation
    if (!cart || cart.length === 0) {
      throw new Error('Cart is empty');
    }

    // Validate customer details
    if (!customerDetailsState.name || !customerDetailsState.phone) {
      throw new Error('Customer name and phone are required');
    }

    // Validate delivery details
    if (deliveryMethodState === DeliveryMethod.DELIVERY) {
      if (!deliveryDetailsState?.date || !deliveryDetailsState?.timeSlot) {
        throw new Error('Delivery date and time slot are required');
      }
      if (!deliveryDetailsState?.streetAddress || !deliveryDetailsState?.emirate) {
        throw new Error('Delivery address details are required');
      }
    }

    // Validate pickup details
    if (deliveryMethodState === DeliveryMethod.PICKUP) {
      if (!pickupDetailsState?.date || !pickupDetailsState?.timeSlot) {
        throw new Error('Pickup date and time slot are required');
      }
    }

    // Validate gift details if it's a gift
    if (giftDetailsState.isGift) {
      if (!giftDetailsState.recipientName || !giftDetailsState.recipientPhone) {
        throw new Error('Gift recipient details are required');
      }
    }

    // Validate payment details
    if (!currentPaymentMethodState) {
      throw new Error('Payment method is required');
    }

    return true;
  }, [cart, customerDetailsState, deliveryMethodState, deliveryDetailsState, pickupDetailsState, giftDetailsState, currentPaymentMethodState]);

  // Sanitize functions for checkout details
  const sanitizeCustomerDetails = () => ({
    name: customerDetailsState.name?.trim() || '',
    email: customerDetailsState.email?.trim() || '',
    phone: customerDetailsState.phone?.trim() || ''
  });

  const sanitizeDeliveryDetails = () => ({
    date: deliveryDetailsState?.date || '',
    timeSlot: deliveryDetailsState?.timeSlot || '',
    instructions: deliveryDetailsState?.instructions?.trim() || '',
    streetAddress: deliveryDetailsState?.streetAddress?.trim() || '',
    apartment: deliveryDetailsState?.apartment?.trim() || '',
    emirate: deliveryDetailsState?.emirate || '',
    city: deliveryDetailsState?.city || '',
    charge: deliveryDetailsState?.charge || 0
  });

  const sanitizePickupDetails = () => ({
    date: pickupDetailsState?.date || '',
    timeSlot: pickupDetailsState?.timeSlot || ''
  });

  const sanitizeGiftDetails = () => ({
    isGift: giftDetailsState.isGift,
    recipientName: giftDetailsState.recipientName?.trim() || '',
    recipientPhone: giftDetailsState.recipientPhone?.trim() || '',
    message: giftDetailsState.message?.trim() || '',
    note: giftDetailsState.note?.trim() || '',
    cashAmount: giftDetailsState.cashAmount?.trim() || '0',
    includeCash: giftDetailsState.includeCash || false
  });

  // Calculate remaining amount
  const remainingAmountState = useMemo(() => {
    const totalPaid = paymentsState.reduce((sum, p) => sum + p.amount, 0);
    return Math.max(0, cartTotal - totalPaid);
  }, [cartTotal, paymentsState]);

  // Calculate cart total with delivery charge
  const cartTotalWithDelivery = useMemo(() => {
    let total = cartTotal;

    // Add delivery charge if delivery method is selected and emirate is chosen
    if (deliveryMethodState === DeliveryMethod.DELIVERY && deliveryDetailsState?.emirate) {
      total += deliveryDetailsState.charge || 0;
    }

    return Math.max(0, total); // Ensure total is not negative
  }, [cartTotal, deliveryMethodState, deliveryDetailsState]);

  // Get formatted checkout details for saving
  const getCheckoutDetails = useCallback((): CheckoutDetails => {
    const sanitizedCustomerDetails = sanitizeCustomerDetails();
    const sanitizedDeliveryDetails = sanitizeDeliveryDetails();
    const sanitizedPickupDetails = sanitizePickupDetails();
    const sanitizedGiftDetails = sanitizeGiftDetails();

    return {
      customerDetails: sanitizedCustomerDetails,
      deliveryMethod: deliveryMethodState,
      deliveryDetails: deliveryMethodState === DeliveryMethod.DELIVERY ? sanitizedDeliveryDetails : undefined,
      pickupDetails: deliveryMethodState === DeliveryMethod.PICKUP ? sanitizedPickupDetails : undefined,
      giftDetails: sanitizedGiftDetails,
      payments: paymentsState,
      paymentMethod: currentPaymentMethodState,
      paymentReference: currentPaymentReferenceState || '',
      cartItems: cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        variations: (item.selectedVariations || []).map((v: any): ProductVariation => ({
          id: nanoid(),
          type: v.type,
          value: v.value,
          priceAdjustment: v.price || 0
        }))
      })),
      orderSummary: {
        totalItems: cart.length,
        totalAmount: cartTotal,
        products: cart.map(item => ({
          id: item.product.id,
          productId: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.basePrice,
          unitPrice: item.product.basePrice,
          sku: item.product.sku || '',
          requiresKitchen: item.product.requiresKitchen || false,
          requiresDesign: item.product.requiresDesign || false,
          hasVariations: item.selectedVariations && item.selectedVariations.length > 0,
          hasCustomImages: item.customImages && item.customImages.length > 0,
          variations: (item.selectedVariations || []).map((v: any): ProductVariation => ({
            id: nanoid(),
            type: v.type,
            value: v.value,
            priceAdjustment: v.price || 0
          }))
        }))
      }
    };
  }, [
    sanitizeCustomerDetails,
    sanitizeDeliveryDetails,
    sanitizePickupDetails,
    sanitizeGiftDetails,
    deliveryMethodState,
    paymentsState,
    cart,
    cartTotal,
    currentPaymentMethodState,
    currentPaymentReferenceState
  ]);

  // Payment utility functions
  const calculateTotalPaid = useCallback(() => {
    return paymentsState.reduce((total, payment) => total + payment.amount, 0);
  }, [paymentsState]);

  // Calculate final total including discounts and delivery
  const calculateFinalTotal = useCallback(() => {
    let total = cartTotal;

    // Apply coupon discount if available
    if (appliedCoupon) {
      total -= appliedCoupon.discount;
    }

    // Add delivery charge if applicable
    if (deliveryMethodState === DeliveryMethod.DELIVERY && deliveryDetailsState?.emirate) {
      total += deliveryDetailsState.charge || 0;
    }

    return Math.max(0, total); // Ensure total is not negative
  }, [cartTotal, appliedCoupon, deliveryMethodState, deliveryDetailsState]);

  const calculateRemainingAmount = useCallback(() => {
    const totalPaid = calculateTotalPaid();
    const finalTotal = calculateFinalTotal();
    return Math.max(0, finalTotal - totalPaid);
  }, [calculateTotalPaid, calculateFinalTotal]);

  // Handle adding a payment
  const handleAddPayment = useCallback((payment: Payment) => {
    setPaymentsState(prev => [...prev, payment]);
  }, []);

  // Handle removing a payment
  const handleRemovePayment = useCallback((paymentId: string) => {
    setPaymentsState(prev => prev.filter(p => p.id !== paymentId));
  }, []);

  // Handle partial payment
  const handlePartialPayment = useCallback((amount: number, method: POSPaymentMethod, reference?: string) => {
    // Use the final total that includes delivery charges and discounts
    const finalTotal = calculateFinalTotal();
    
    const payment: Payment = {
      id: nanoid(),
      amount,
      method,
      reference: method === POSPaymentMethod.CARD ? reference || null : null,
      status: POSPaymentStatus.PARTIALLY_PAID,
      isPartialPayment: true,
      remainingAmount: finalTotal - amount,
      futurePaymentMethod: POSPaymentMethod.CARD
    };

    if (method === POSPaymentMethod.CASH) {
      payment.cashAmount = amount;
      payment.changeAmount = 0;
    }

    handleAddPayment(payment);
    setShowRemainingPaymentModal(true);
  }, [handleAddPayment, cartTotal]);

  // Handle create order
  const handleCreateOrder = useCallback(async () => {
    try {
      setIsSubmitting(true);
      
      // If current payment method is PARTIAL and amount is entered, add it as a payment first
      if (currentPaymentMethodState === POSPaymentMethod.PARTIAL && currentPaymentAmountState) {
        const amount = parseFloat(currentPaymentAmountState);
        if (amount && !isNaN(amount)) {
          const payment: Payment = {
            id: nanoid(),
            amount,
            method: partialPaymentMethod,
            reference: partialPaymentMethod === POSPaymentMethod.CARD ? currentPaymentReferenceState || null : null,
            status: POSPaymentStatus.PARTIALLY_PAID,
            isPartialPayment: true,
            remainingAmount: cartTotal - amount,
            futurePaymentMethod: POSPaymentMethod.CARD
          };
          
          if (partialPaymentMethod === POSPaymentMethod.CASH) {
            payment.cashAmount = amount;
            payment.changeAmount = 0;
          }
          
          handleAddPayment(payment);
        }
      }
      
      // Process custom images for each cart item
      const processedCart = await Promise.all(
        cart.map(async (item) => {
          if (item.customImages && item.customImages.length > 0) {
            try {
              // Create a temporary order ID for storage path
              const tempOrderId = nanoid();
              
              console.log(`Processing ${item.customImages.length} custom images for item ${item.id}`);
              
              // Add timeout to prevent hanging on image upload
              const uploadPromise = uploadCustomImages(item.customImages, tempOrderId);
              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Image upload timed out')), 10000);
              });
              
              // Race between upload and timeout
              const uploadedImages = await Promise.race([uploadPromise, timeoutPromise]) as CustomImage[];
              
              // Log the uploaded images
              console.log('Uploaded images for item:', item.id, uploadedImages.map(img => ({ id: img.id, url: img.url })));
              
              // Return updated cart item with uploaded image URLs
              return {
                ...item,
                customImages: uploadedImages.map(img => ({
                  ...img,
                  url: img.url || '' // Ensure URL is never undefined
                }))
              };
            } catch (error) {
              console.error('Error uploading images:', error);
              // Continue with order even if image upload fails
              return {
                ...item,
                customImages: item.customImages.map(img => ({
                  ...img,
                  url: img.url || '' // Ensure URL is never undefined
                }))
              };
            }
          }
          return item;
        })
      );

      // Update cart with processed images
      setCart(processedCart);

      // Validate order details
      validateOrderDetails();

      // Create or update customer first
      if (customerDetailsState.name && customerDetailsState.phone) {
        try {
          console.log('Creating or updating customer:', customerDetailsState);
          const customerCreated = await handleCreateCustomer();
          if (!customerCreated) {
            console.warn('Failed to create or update customer, but continuing with order');
          }
        } catch (customerError) {
          console.error('Error creating/updating customer:', customerError);
          // Don't block order completion if customer creation fails
          toast.warning('Error creating customer record, but continuing with order');
        }
      }

      // Prepare order data with processed cart
      const orderData = preparePOSOrderData(processedCart);

      console.log('Sending order data with processed images:', orderData);

      // Log detailed order data with custom images
      console.log('Sending order data with processed images:', JSON.stringify(
        orderData.items
          .filter(item => item.customImages && item.customImages.length > 0)
          .map(item => ({
            id: item.id,
            customImages: item.customImages
          }))
      ));

      // Log the final order data to verify custom image URLs are included
      console.log('Final order data being sent to API:', {
        items: orderData.items.map(item => ({
          id: item.id,
          productName: item.productName,
          customImages: item.customImages?.map(img => ({ id: img.id, url: img.url }))
        }))
      });

      // Create order
      const response = await apiMethods.pos.createOrder(orderData);

      console.log('Order creation response:', response);

      if (!response.success) {
        throw new Error(response.message || 'Failed to create order');
      }

      // Handle cash drawer operations for cash payments
      try {
        // Log all payments for debugging
        console.log('All payments:', JSON.stringify(paymentsState, null, 2));
        
        // Check if any payment involves cash with detailed logging
        // First check the paymentsState array
        let hasCashPayment = paymentsState.some(payment => {
          const isCashMethod = payment.method === POSPaymentMethod.CASH;
          const hasCashPortion = payment.isSplitPayment && payment.cashPortion && payment.cashPortion > 0;
          
          console.log(`Payment ${payment.id}:`, {
            method: payment.method,
            isCashMethod,
            isSplitPayment: payment.isSplitPayment,
            cashPortion: payment.cashPortion,
            hasCashPortion
          });
          
          return isCashMethod || hasCashPortion;
        });
        
        // If paymentsState is empty, check the current payment method
        if (paymentsState.length === 0) {
          const isCashMethod = currentPaymentMethodState === POSPaymentMethod.CASH;
          const hasCashPortion = currentPaymentMethodState === POSPaymentMethod.SPLIT && parseFloat(splitCashAmount) > 0;
          
          console.log('Current payment method:', {
            method: currentPaymentMethodState,
            isCashMethod,
            isSplitPayment: currentPaymentMethodState === POSPaymentMethod.SPLIT,
            cashPortion: splitCashAmount,
            hasCashPortion
          });
          
          // Update hasCashPayment based on current payment method
          hasCashPayment = isCashMethod || hasCashPortion;
        }
        
        console.log('Has cash payment detected:', hasCashPayment);
        
        // Get the printer proxy URL from environment variables
        const proxyUrl = process.env.NEXT_PUBLIC_PRINTER_PROXY_URL || 'http://localhost:3005';
        console.log('Using printer proxy URL:', proxyUrl);
        
        if (hasCashPayment) {
          console.log('Cash payment detected - printing receipt and opening drawer');
          
          try {
            console.log('Calling cash-order endpoint for receipt printing and drawer opening');
            
            // Create a payment object if paymentsState is empty
            let paymentData = paymentsState;
            if (paymentsState.length === 0 && currentPaymentMethodState) {
              // Create a default payment with the current payment method
              const defaultPayment: Payment = {
                id: nanoid(),
                amount: calculateFinalTotal(),
                method: currentPaymentMethodState,
                reference: currentPaymentMethodState === POSPaymentMethod.CARD ? currentPaymentReferenceState || null : null,
                status: POSPaymentStatus.FULLY_PAID
              };
              
              if (currentPaymentMethodState === POSPaymentMethod.CASH) {
                defaultPayment.cashAmount = calculateFinalTotal();
                defaultPayment.changeAmount = 0;
              } else if (currentPaymentMethodState === POSPaymentMethod.SPLIT && parseFloat(splitCashAmount) > 0) {
                defaultPayment.isSplitPayment = true;
                defaultPayment.cashPortion = parseFloat(splitCashAmount) || 0;
                defaultPayment.cardPortion = parseFloat(splitCardAmount) || 0;
                defaultPayment.cardReference = splitCardReference || null;
              }
              
              paymentData = [defaultPayment];
              console.log('Created default payment for cash-order:', paymentData);
            }
            
            // Using direct axios call to the cash-order endpoint
            const cashOrderResponse = await axios.post(`${proxyUrl}/cash-order`, {
              orderData: {
                orderNumber: response.data?.orderNumber,
                payments: paymentData,
                orderId: response.data?.id
              },
              skipConnectivityCheck: true
            });
            
            console.log('Cash order response received:', cashOrderResponse.data);
            
            if (cashOrderResponse.status !== 200) {
              console.warn('Cash order request unsuccessful:', cashOrderResponse.data?.message || 'Unknown error');
              toast.warning('Could not open cash drawer or print receipt. Please check printer connection.');
            }
          } catch (cashOrderError) {
            console.error('Error in cash order operation:', cashOrderError.message || 'fetch failed');
            toast.warning('Could not open cash drawer or print receipt. Please check printer connection.');
          }
        } else {
          console.log('Card payment detected - printing receipt only');
          
          try {
            // For card payments - call the print-order endpoint directly
            const printOrderResponse = await axios.post(`${proxyUrl}/print-order`, {
              order: {
                orderNumber: response.data?.orderNumber,
                payments: paymentsState,
                orderId: response.data?.id
              },
              skipConnectivityCheck: true
            });
            
            console.log('Print order response:', printOrderResponse.data);
            
            if (printOrderResponse.status !== 200) {
              console.warn('Print order request unsuccessful:', printOrderResponse.data?.message || 'Unknown error');
              toast.warning('Could not print receipt. Please check printer connection.');
            }
          } catch (printOrderError) {
            console.error('Error in print order operation:', printOrderError.message || 'fetch failed');
            toast.warning('Could not print receipt. Please check printer connection.');
          }
        }
      } catch (printerError) {
        console.error('Error handling printer operations:', printerError);
        // Don't block order completion if printing fails
        toast.warning('Error with printer operations. Please check printer connection.');
      }

      // Reset cart and state
      setCart([]);
      setCustomerDetailsState({
        name: '',
        email: '',
        phone: ''
      });
      setDeliveryDetailsState({
        date: '',
        timeSlot: '',
        instructions: '',
        streetAddress: '',
        apartment: '',
        emirate: '',
        city: '',
        charge: 0,
      });
      setPickupDetailsState({
        date: '',
        timeSlot: ''
      });
      setGiftDetailsState({
        isGift: false,
        recipientName: '',
        recipientPhone: '',
        message: '',
        note: '',
        cashAmount: '',
        includeCash: false
      });
      setPaymentsState([]);
      setCurrentPaymentMethodState(POSPaymentMethod.CASH);
      setCurrentPaymentReferenceState('');
      setCurrentPaymentAmountState('');
      setIsPartialPaymentState(false);
      setIsSplitPaymentState(false);
      setSplitCashAmount('');
      setSplitCardAmount('');
      setSplitCardReference('');
      setSelectedRoute(null);

      // Close modal
      onClose();

      // Show success message
      toast.success('Order created successfully');

      // Call onCheckoutComplete callback if provided
      if (onCheckoutComplete) {
        onCheckoutComplete(getCheckoutDetails());
      }
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error(error.message || 'Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    validateOrderDetails,
    preparePOSOrderData,
    apiMethods.pos,
    onClose,
    onCheckoutComplete,
    getCheckoutDetails,
    setCart,
    setCustomerDetailsState,
    setDeliveryDetailsState,
    setPickupDetailsState,
    setGiftDetailsState,
    setPaymentsState,
    setCurrentPaymentMethodState,
    setCurrentPaymentReferenceState,
    setCurrentPaymentAmountState,
    setIsPartialPaymentState,
    setIsSplitPaymentState,
    setSplitCashAmount,
    setSplitCardAmount,
    setSplitCardReference,
    currentPaymentMethodState,
    currentPaymentAmountState,
    partialPaymentMethod,
    currentPaymentReferenceState,
    cartTotal,
    handleAddPayment
  ]);

  // Handle park order
  const handleParkOrder = useCallback(async () => {
    try {
      setIsParkingOrder(true);
      
      // Validate customer details at minimum
      if (!customerDetailsState.name) {
        throw new Error('Customer name is required');
      }
      
      // Format dates to ISO DateTime strings
      const formatDateToISOString = (dateStr) => {
        if (!dateStr) return null;
        try {
          // Make sure the date is in the format YYYY-MM-DD
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            console.error('Invalid date format:', dateStr);
            return null;
          }
          
          // Convert YYYY-MM-DD to YYYY-MM-DDT00:00:00Z
          const date = new Date(`${dateStr}T00:00:00Z`);
          if (isNaN(date.getTime())) {
            console.error('Invalid date:', dateStr);
            return null;
          }
          return date.toISOString();
        } catch (error) {
          console.error('Error formatting date:', error);
          return null;
        }
      };
      
      // Prepare parked order data
      const parkedOrderData: ParkedOrderData = {
        name: orderName || `Order for ${customerDetailsState.name}`,
        customerName: customerDetailsState.name,
        customerPhone: customerDetailsState.phone,
        customerEmail: customerDetailsState.email,
        
        // Order items
        items: cart.map(item => ({
          productId: item.product.id,
          productName: item.product.name,
          unitPrice: item.product.basePrice,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
          selectedVariations: item.selectedVariations,
          notes: item.notes,
          customImages: item.customImages,
          requiresKitchen: item.product.requiresKitchen,
          requiresDesign: item.product.requiresDesign,
          sku: item.product.sku,
          categoryId: item.product.categoryId
        })),
        
        totalAmount: cartTotal,
        
        // Delivery information
        deliveryMethod: deliveryMethodState,

        // Delivery details if applicable
        ...(deliveryMethodState === DeliveryMethod.DELIVERY && {
          deliveryDate: deliveryDetailsState?.date ? formatDateToISOString(deliveryDetailsState.date) : null,
          deliveryTimeSlot: deliveryDetailsState?.timeSlot,
          deliveryInstructions: deliveryDetailsState?.instructions,
          deliveryCharge: deliveryDetailsState?.charge,
          streetAddress: deliveryDetailsState?.streetAddress,
          apartment: deliveryDetailsState?.apartment,
          emirate: deliveryDetailsState?.emirate,
          city: deliveryDetailsState?.city
        }),
        
        // Pickup details if applicable
        ...(deliveryMethodState === DeliveryMethod.PICKUP && {
          pickupDate: pickupDetailsState?.date ? formatDateToISOString(pickupDetailsState.date) : null,
          pickupTimeSlot: pickupDetailsState?.timeSlot
        }),
        
        // Gift details if applicable
        ...(giftDetailsState?.isGift && {
          isGift: giftDetailsState.isGift,
          giftRecipientName: giftDetailsState.recipientName,
          giftRecipientPhone: giftDetailsState.recipientPhone,
          giftMessage: giftDetailsState.message,
          giftCashAmount: giftDetailsState.cashAmount ? parseFloat(giftDetailsState.cashAmount) : 0,
          includeCash: giftDetailsState.includeCash || false
        }),
        
        notes: orderNotes
      };
      
      console.log('Parking order:', parkedOrderData);
      
      try {
        // Call the API to park the order
        const response = await apiMethods.pos.parkOrder(parkedOrderData);
        
        console.log('Park order response:', response);
        
        if (!response.success) {
          console.error('API returned error:', response);
          throw new Error(response.message || 'Failed to park order');
        }
        
        // Show success message
        toast.success('Order parked successfully');
        
        // Reset cart and state
        setCart([]);
        
        // Force close the modal directly
        onClose();
      } catch (error) {
        console.error('Error parking order:', error);
        
        let errorMessage = 'Failed to park order';
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'object' && error !== null) {
          errorMessage = JSON.stringify(error);
        }
        
        toast.error(errorMessage);
        throw error; // Re-throw to be caught by the outer catch block
      }
    } catch (error) {
      console.error('Error parking order:', error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to park order');
      }
    } finally {
      setIsParkingOrder(false);
    }
  }, [
    customerDetailsState,
    deliveryMethodState,
    deliveryDetailsState,
    pickupDetailsState,
    giftDetailsState,
    orderName,
    cart,
    cartTotal,
    orderNotes,
    apiMethods.pos,
    onClose,
    setCart
  ]);

  // Handle payment click
  const handlePaymentClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const amount = parseFloat(currentPaymentAmountState);
    if (!amount || isNaN(amount)) {
      toast.error('Please enter a valid amount');
      return;
    }

    // For card payments and other payment methods that require references, ensure reference is provided
    if ((currentPaymentMethodState === POSPaymentMethod.CARD || 
         currentPaymentMethodState === POSPaymentMethod.BANK_TRANSFER || 
         currentPaymentMethodState === POSPaymentMethod.PBL || 
         currentPaymentMethodState === POSPaymentMethod.TALABAT) && 
        !currentPaymentReferenceState.trim()) {
      toast.error('Please enter a payment reference');
      return;
    }

    const totalPaid = calculateTotalPaid();
    const finalTotal = calculateFinalTotal();
    const isComplete = Math.abs((totalPaid + amount) - finalTotal) < 0.01;

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
      status: POSPaymentStatus.FULLY_PAID
    };

    // Add method-specific fields
    if (currentPaymentMethodState === POSPaymentMethod.CASH) {
      payment.cashAmount = amount;
      payment.changeAmount = 0;
    }

    handleAddPayment(payment);

    // Reset form
    setCurrentPaymentAmountState('');
    setCurrentPaymentReferenceState('');

    // If payment is complete, proceed with checkout
    if (isComplete) {
      handleCreateOrder();
    }
  }, [currentPaymentAmountState, currentPaymentMethodState, currentPaymentReferenceState, calculateFinalTotal, calculateTotalPaid, handleCreateOrder, handleAddPayment, handlePartialPayment]);

  // This section was moved up before calculateRemainingAmount

  // Calculate delivery charge based on emirate
  const calculateDeliveryCharge = (emirate: string) => {
    return emirate === 'DUBAI' ? 30 : 50;
  };

  // Time slots based on emirate, current time, and delivery method
  const getTimeSlots = (emirate: string, forDate?: string) => {
    // Generate time slots based on delivery method
    let defaultSlots = [];
    
    // For pickup: 30-minute intervals from 9 AM to 9 PM
    if (deliveryMethodState === DeliveryMethod.PICKUP) {
      defaultSlots = [
        "9:00 AM",
        "9:30 AM",
        "10:00 AM",
        "10:30 AM",
        "11:00 AM",
        "11:30 AM",
        "12:00 PM",
        "12:30 PM",
        "1:00 PM",
        "1:30 PM",
        "2:00 PM",
        "2:30 PM",
        "3:00 PM",
        "3:30 PM",
        "4:00 PM",
        "4:30 PM",
        "5:00 PM",
        "5:30 PM",
        "6:00 PM",
        "6:30 PM",
        "7:00 PM",
        "7:30 PM",
        "8:00 PM",
        "8:30 PM",
        "9:00 PM"
      ];
    } 
    // For delivery: 1-hour intervals from 9 AM to 9 PM
    else {
      defaultSlots = [
        "9:00 AM",
        "10:00 AM",
        "11:00 AM",
        "12:00 PM",
        "1:00 PM",
        "2:00 PM",
        "3:00 PM",
        "4:00 PM",
        "5:00 PM",
        "6:00 PM",
        "7:00 PM",
        "8:00 PM",
        "9:00 PM"
      ];
    }
    
    // Return all time slots without any buffer restriction
    return defaultSlots;
  };

  // Get available dates based on emirate and delivery method
  const getAvailableDates = (emirate: string) => {
    const dates = [];
    const today = new Date();
    
    // For pickup, include today and next 7 days
    // For delivery - Dubai: Next day delivery, Other emirates: 2 days advance delivery
    const startDays = deliveryMethodState === DeliveryMethod.PICKUP ? 0 : 
                      (emirate === 'DUBAI' ? 1 : 2);
    
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
  const handleCreateCustomer = useCallback(async () => {
    try {
      if (!customerDetailsState.name || !customerDetailsState.phone) {
        toast.error('Customer name and phone are required');
        return false;
      }

      // Make sure phone is properly formatted
      const sanitizedPhone = customerDetailsState.phone?.trim() || '';
      if (!sanitizedPhone) {
        toast.error('Valid phone number is required');
        return false;
      }

      const customerData = {
        customerName: customerDetailsState.name?.trim() || '',
        customerPhone: sanitizedPhone,
        customerEmail: customerDetailsState.email?.trim() || '',
      };

      console.log('Sending customer data to API:', customerData);
      const response = await apiMethods.pos.createOrUpdateCustomer(customerData);
      
      // The API response structure is { success: boolean, data: { customer: {...}, credentials?: {...} } }
      if (response.success && response.data?.customer) {
        console.log('Customer created/updated successfully:', response.data.customer);
        return true;
      } else {
        console.error('Failed to create/update customer:', response);
        return false;
      }
    } catch (error) {
      console.error('Error creating/updating customer:', error);
      return false;
    }
  }, [customerDetailsState]);

  const handleCustomerSearch = useCallback(async (searchTerm: string) => {
    try {
      setIsSearching(true);
      setSearchResults([]);
      
      const response = await apiMethods.pos.searchCustomers(searchTerm);
      if (response.data) {
        const customers: Customer[] = response.data.map(customer => ({
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          addresses: [], // The addresses property doesn't exist in the searchCustomers API response
          reward: {
            points: customer.reward?.points || 0
          }
        }));
        setSearchResults(customers);
        setShowSearchResults(true);
        return customers;
      }
      setSearchResults([]);
      return [];
    } catch (error) {
      console.error('Error searching customers:', error);
      toast.error('Failed to search customers');
      setSearchResults([]);
      return [];
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Create a debounced search function
  const debouncedSearch = useCallback(
    debounce(async (searchTerm: string) => {
      if (searchTerm.trim() !== '') {
        handleCustomerSearch(searchTerm);
      }
    }, 300),
    [handleCustomerSearch]
  );

  // Update search results when customer name changes
  useEffect(() => {
    if (customerDetailsState.name.trim() !== '') {
      debouncedSearch(customerDetailsState.name);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
    
    // Cleanup function to cancel any pending debounced calls
    return () => {
      debouncedSearch.cancel();
    };
  }, [customerDetailsState.name, debouncedSearch]);

  // Add a click outside handler to close the search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !(searchRef.current as any).contains(event.target)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [searchRef]);

  // Handle customer selection
  const handleCustomerSelect = useCallback((customer: Customer) => {
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
  }, []);

  // Handle customer create
  const handleCustomerCreate = useCallback(async (customer: Omit<Customer, 'id' | 'addresses' | 'reward'>) => {
    try {
      if (!customerDetailsState.name || !customerDetailsState.phone) {
        toast.error('Customer name and phone are required');
        return;
      }

      const customerData = {
        customerName: `${customer.firstName} ${customer.lastName}`.trim(),
        customerPhone: customer.phone,
        customerEmail: customer.email,
      };
      
      const response = await apiMethods.pos.createOrUpdateCustomer(customerData);
      if (response.data && response.data.customer) {
        // Extract customer data from the response
        const customerResponse = response.data.customer;
        
        // Map the API response to the Customer type
        const newCustomer: Customer = {
          id: customerResponse.id,
          firstName: customerResponse.firstName,
          lastName: customerResponse.lastName,
          email: customerResponse.email,
          phone: customerResponse.phone,
          addresses: customerResponse.addresses || [],
          reward: customerResponse.reward || { points: 0 }
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
    if (calculateTotalPaid() >= calculateFinalTotal()) {
      handleCreateOrder();
    }
  }, [calculateFinalTotal, calculateTotalPaid, handleCreateOrder]);

  const handlePaymentMethodSelect = (method: POSPaymentMethod) => {
    if (method === POSPaymentMethod.SPLIT) {
      setIsSplitPaymentState(true);
      setCurrentPaymentMethodState(method);
      
      // If split amounts are not already set, initialize with reasonable defaults
      if (!splitCashAmount && !splitCardAmount) {
        const total = calculateFinalTotal();
        // Initialize with the full amount as cash by default
        setSplitCashAmount(total.toString());
        setSplitCardAmount('0');
      }
    } else {
      setIsSplitPaymentState(false);
      setCurrentPaymentMethodState(method);
      setPaymentMethodState(method);
    }
  };

  const setPaymentMethodState = (method: POSPaymentMethod) => {
    setCurrentPaymentMethodState(method);
  };

  function handleSplitPayment(event: React.MouseEvent<HTMLButtonElement>): void {
    event.preventDefault();
    
    // Parse the cash and card amounts
    const cashAmount = parseFloat(splitCashAmount) || 0;
    const cardAmount = parseFloat(splitCardAmount) || 0;
    
    // Validate that the total matches the cart total
    const totalSplitAmount = cashAmount + cardAmount;
    const expectedTotal = deliveryMethodState === DeliveryMethod.DELIVERY 
      ? cartTotal + (deliveryDetailsState?.charge || 0) 
      : cartTotal;
    
    // Check if the total split amount matches the expected total
    if (Math.abs(totalSplitAmount - expectedTotal) > 0.01) {
      toast.error(`The total split amount (${totalSplitAmount.toFixed(2)}) must match the order total (${expectedTotal.toFixed(2)})`);
      return;
    }
    
    // Create a split payment
    const payment: Payment = {
      id: nanoid(),
      amount: expectedTotal,
      method: POSPaymentMethod.SPLIT,
      reference: null,
      status: POSPaymentStatus.FULLY_PAID,
      isSplitPayment: true,
      cashPortion: cashAmount,
      cardPortion: cardAmount,
      cardReference: splitCardReference || null
    };
    
    // Add the payment to the state
    handleAddPayment(payment);
    
    // Reset the split payment form
    setSplitCashAmount('');
    setSplitCardAmount('');
    setSplitCardReference('');
    
    // Show success message
    toast.success('Split payment applied successfully');
  }

  // Ensure custom images have IDs
  const ensureCustomImagesHaveIds = (images: CustomImage[] = []): CustomImage[] => {
    return images.map(image => {
      if (!image.id) {
        return { ...image, id: nanoid() };
      }
      return image;
    });
  };

  // Update state when props change
  useEffect(() => {
    console.log('Checkout modal props updated:', {
      customerDetails,
      deliveryMethod,
      deliveryDetails,
      pickupDetails,
      giftDetails
    });
    
    // Update customer details
    if (customerDetails) {
      setCustomerDetailsState({
        name: customerDetails.name || '',
        email: customerDetails.email || '',
        phone: customerDetails.phone || '',
      });
    }
    
    // Update delivery method
    if (deliveryMethod) {
      setDeliveryMethodState(deliveryMethod);
    }
    
    // Update delivery details
    if (deliveryDetails) {
      setDeliveryDetailsState({
        date: deliveryDetails.date || '',
        timeSlot: deliveryDetails.timeSlot || '',
        instructions: deliveryDetails.instructions || '',
        streetAddress: deliveryDetails.streetAddress || '',
        apartment: deliveryDetails.apartment || '',
        emirate: deliveryDetails.emirate || '',
        city: deliveryDetails.city || '',
        charge: deliveryDetails.charge || 0,
      });
    }
    
    // Update pickup details
    if (pickupDetails) {
      setPickupDetailsState({
        date: pickupDetails.date || '',
        timeSlot: pickupDetails.timeSlot || '',
      });
    }
    
    // Update gift details
    if (giftDetails) {
      setGiftDetailsState({
        isGift: giftDetails.isGift || false,
        recipientName: giftDetails.recipientName || '',
        recipientPhone: giftDetails.recipientPhone || '',
        message: giftDetails.message || '',
        note: giftDetails.note || '',
        cashAmount: giftDetails.cashAmount?.toString() || '0',
        includeCash: giftDetails.includeCash || false
      });
    }
    
    // Update order name
    if (orderName) {
      setOrderNameState(orderName);
    }
  }, [customerDetails, deliveryMethod, deliveryDetails, pickupDetails, giftDetails, orderName]);

  useEffect(() => {
    console.log('============ ENVIRONMENT CHECK ============');
    console.log('NEXT_PUBLIC_PRINTER_PROXY_URL:', process.env.NEXT_PUBLIC_PRINTER_PROXY_URL);
    console.log('============================================');
  }, []);

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
                                onChange={(e) => {
                                  const value = e.target.value || '';
                                  setCustomerDetailsState(prev => ({
                                    ...prev,
                                    name: value
                                  }));
                                  if (value.trim() !== '') {
                                    handleCustomerSearch(value);
                                  } else {
                                    setShowSearchResults(false);
                                    setSearchResults([]);
                                  }
                                }}
                                className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4 pl-12"
                                placeholder="Customer Name or Phone *"
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
                                      const customerWithAddresses: Customer = {
                                        ...firstResult,
                                        addresses: [] // Always provide an empty array for addresses
                                      };
                                      handleCustomerSelect(customerWithAddresses);
                                    } else if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      const firstResult = searchResults[0];
                                      const customerWithAddresses: Customer = {
                                        ...firstResult,
                                        addresses: [] // Always provide an empty array for addresses
                                      };
                                      handleCustomerSelect(customerWithAddresses);
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
                                    {searchResults.map((customer, index) => {
                                      // Ensure customer has addresses property to satisfy Customer interface
                                      const customerWithAddresses: Customer = {
                                        ...customer,
                                        addresses: [] // Always provide an empty array for addresses
                                      };
                                      
                                      return (
                                        <li
                                          key={customerWithAddresses.id}
                                          className="p-4 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                                          onClick={() => handleCustomerSelect(customerWithAddresses)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                              e.preventDefault();
                                              handleCustomerSelect(customerWithAddresses);
                                            }
                                          }}
                                          role="option"
                                          aria-selected={index === 0}
                                          tabIndex={0}
                                        >
                                          <div className="font-medium">
                                            {customerWithAddresses.firstName} {customerWithAddresses.lastName}
                                          </div>
                                          <div className="text-sm text-gray-500">
                                            {customerWithAddresses.phone}
                                            {customerWithAddresses.email && ` • ${customerWithAddresses.email}`}
                                          </div>
                                        </li>
                                      );
                                    })}
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
                            <div className="mb-4">
                              <label htmlFor="customerPhone" className="block text-lg font-medium text-gray-700">
                                Phone Number *
                              </label>
                              <input
                                type="tel"
                                id="customerPhone"
                                value={customerDetailsState.phone}
                                onChange={(e) => setCustomerDetailsState((prev) => ({ ...prev, phone: e.target.value || '' }))}
                                className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                placeholder="Phone Number *"
                                required
                              />
                            </div>
                            <div className="mb-4">
                              <label htmlFor="customerEmail" className="block text-lg font-medium text-gray-700">
                                Email Address (Optional)
                              </label>
                              <input
                                type="email"
                                id="customerEmail"
                                value={customerDetailsState.email}
                                onChange={(e) => setCustomerDetailsState((prev) => ({ ...prev, email: e.target.value || '' }))}
                                className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                placeholder="Email Address"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Delivery/Pickup Selection */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">Delivery/Pickup:</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div
                              onClick={() => setDeliveryMethodState(DeliveryMethod.PICKUP)}
                              className={`flex items-center p-4 cursor-pointer rounded-lg hover:bg-blue-50 transition-colors ${
                                deliveryMethodState === DeliveryMethod.PICKUP
                                  ? "bg-blue-50 border-blue-500"
                                  : "border-gray-200 hover:border-blue-300"
                              }`}
                              role="button"
                              tabIndex={0}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  setDeliveryMethodState(DeliveryMethod.PICKUP);
                                }
                              }}
                            >
                              <div className={`w-6 h-6 border-2 rounded-full mr-3 flex items-center justify-center transition-colors ${
                                deliveryMethodState === DeliveryMethod.PICKUP
                                  ? "border-blue-500 bg-blue-500"
                                  : "border-gray-300"
                              }`}>
                                {deliveryMethodState === DeliveryMethod.PICKUP && (
                                  <div className="w-2 h-2 bg-white rounded-full" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="font-medium">Pickup</div>
                                <div className="text-sm text-gray-500">
                                  Pick up your order from our store
                                </div>
                              </div>
                            </div>

                            <div
                              onClick={() => setDeliveryMethodState(DeliveryMethod.DELIVERY)}
                              className={`flex items-center p-4 cursor-pointer rounded-lg hover:bg-blue-50 transition-colors ${
                                deliveryMethodState === DeliveryMethod.DELIVERY
                                  ? "bg-blue-50 border-blue-500"
                                  : "border-gray-200 hover:border-blue-300"
                              }`}
                              role="button"
                              tabIndex={0}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  setDeliveryMethodState(DeliveryMethod.DELIVERY);
                                }
                              }}
                            >
                              <div className={`w-6 h-6 border-2 rounded-full mr-3 flex items-center justify-center transition-colors ${
                                deliveryMethodState === DeliveryMethod.DELIVERY
                                  ? "border-blue-500 bg-blue-500"
                                  : "border-gray-300"
                              }`}>
                                {deliveryMethodState === DeliveryMethod.DELIVERY && (
                                  <div className="w-2 h-2 bg-white rounded-full" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="font-medium">Delivery</div>
                                <div className="text-sm text-gray-500">
                                  Get your order delivered to your address
                                </div>
                              </div>
                            </div>
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
                              onChange={(e) => setPickupDetailsState((prev) => ({ ...prev, date: e.target.value, timeSlot: '' }))}
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
                              disabled={!pickupDetailsState.date}
                            >
                              <option value="">Select Pickup Time *</option>
                              {pickupDetailsState.date && getTimeSlots('DUBAI', pickupDetailsState.date).map((slot) => (
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
                                      className="w-full h-14 text-2xl font-medium border-2 border-gray-300 rounded-lg px-16 py-3 focus:border-black focus:outline-none text-right"
                                      placeholder="0"
                                      min="0"
                                      step="1"
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
                            {cart.map((item, index) => {
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
                                      AED {((item.totalPrice || 0) / (item.quantity || 1)).toFixed(2)} × {item.quantity || 0}
                                    </p>
                                    {selectedVariations.length > 0 && (
                                      <div className="mt-2 bg-blue-50 p-2 rounded-md">
                                        <p className="text-sm font-medium text-blue-700 mb-1">Selected Options:</p>
                                        {selectedVariations.map((variation, i) => {
                                          // Ensure variation has the correct structure
                                          const type = typeof variation === 'object' && variation !== null 
                                            ? (variation.type || variation.id || '').toString()
                                            : '';
                                          const value = typeof variation === 'object' && variation !== null 
                                            ? (variation.value || variation.id || '').toString()
                                            : '';
                                          // Handle price property for variations
                                          const priceAdjustment = typeof variation === 'object' && variation !== null 
                                            ? Number((variation as any).price || 0)
                                            : 0;
                                          
                                          return (
                                            <p
                                              key={`${item.id}-var-${i}`}
                                              className="text-sm text-blue-700 flex justify-between"
                                            >
                                              <span>{type}: {value}</span>
                                              {priceAdjustment > 0 && <span>+AED {priceAdjustment.toFixed(2)}</span>}
                                            </p>
                                          );
                                        })}
                                      </div>
                                    )}
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
                                        <label className="text-sm font-medium text-gray-800">
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
                                              ? { ...cartItem, customImages: ensureCustomImagesHaveIds(images) }
                                              : cartItem
                                          );
                                          setCart(updatedCart);
                                        }}
                                        value={ensureCustomImagesHaveIds(customImages)}
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
                            }).filter(Boolean)}
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
                                    {appliedCoupon.type === 'PERCENTAGE' 
                                      ? ` (${appliedCoupon.value}%)`
                                      : `AED ${appliedCoupon.value} off`
                                    }
                                  </p>
                                  <button
                                    onClick={() => {
                                      setAppliedCoupon(null);
                                      setCouponCode('');
                                    }}
                                    className="ml-2 text-red-500 hover:text-red-700"
                                  >
                                    <X className="h-5 w-5" />
                                  </button>
                                </div>
                                <p className="text-xl text-green-600">-AED {appliedCoupon.discount.toFixed(2)}</p>
                              </div>
                            )}
                            
                            {deliveryMethodState === DeliveryMethod.DELIVERY && deliveryDetailsState?.emirate && (
                              <div className="flex justify-between items-center font-medium">
                                <p className="text-xl">Delivery Charge ({deliveryDetailsState.emirate.replace('_', ' ')})</p>
                                <div className="flex items-center">
                                  <span className="text-xl mr-2">AED</span>
                                  <input
                                    type="number"
                                    value={deliveryDetailsState.charge}
                                    onChange={(e) => setDeliveryDetailsState(prev => ({
                                      ...prev,
                                      charge: parseFloat(e.target.value) || 0
                                    }))}
                                    className="w-20 text-xl text-right border border-gray-300 rounded p-1"
                                    min="0"
                                    step="5"
                                  />
                                </div>
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
                            <div className="space-y-3">
                              <div className="flex space-x-3">
                                <button
                                  type="button"
                                  onClick={() => handlePaymentMethodSelect(POSPaymentMethod.CASH)}
                                  className={`flex-1 py-3 px-2 text-base font-medium rounded-xl border-2 transition-all ${
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
                                  className={`flex-1 py-3 px-2 text-base font-medium rounded-xl border-2 transition-all ${
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
                                  className={`flex-1 py-3 px-2 text-base font-medium rounded-xl border-2 transition-all ${
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
                                  className={`flex-1 py-3 px-2 text-base font-medium rounded-xl border-2 transition-all ${
                                    currentPaymentMethodState === POSPaymentMethod.PARTIAL
                                      ? "bg-black text-white"
                                      : "bg-gray-100 text-gray-700"
                                  }`}
                                >
                                  Partial
                                </button>
                              </div>
                              
                              {/* New Payment Methods Row */}
                              <div className="flex space-x-3 mt-3">
                                <button
                                  type="button"
                                  onClick={() => handlePaymentMethodSelect(POSPaymentMethod.BANK_TRANSFER)}
                                  className={`flex-1 py-3 px-2 text-base font-medium rounded-xl border-2 transition-all ${
                                    currentPaymentMethodState === POSPaymentMethod.BANK_TRANSFER
                                      ? "bg-black text-white"
                                      : "bg-gray-100 text-gray-700"
                                  }`}
                                >
                                  Bank Transfer
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePaymentMethodSelect(POSPaymentMethod.PBL)}
                                  className={`flex-1 py-3 px-2 text-base font-medium rounded-xl border-2 transition-all ${
                                    currentPaymentMethodState === POSPaymentMethod.PBL
                                      ? "bg-black text-white"
                                      : "bg-gray-100 text-gray-700"
                                  }`}
                                >
                                  Pay by Link
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePaymentMethodSelect(POSPaymentMethod.TALABAT)}
                                  className={`flex-1 py-3 px-2 text-base font-medium rounded-xl border-2 transition-all ${
                                    currentPaymentMethodState === POSPaymentMethod.TALABAT
                                      ? "bg-black text-white"
                                      : "bg-gray-100 text-gray-700"
                                  }`}
                                >
                                  Talabat
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePaymentMethodSelect(POSPaymentMethod.COD)}
                                  className={`flex-1 py-3 px-2 text-base font-medium rounded-xl border-2 transition-all ${
                                    currentPaymentMethodState === POSPaymentMethod.COD
                                      ? "bg-black text-white"
                                      : "bg-gray-100 text-gray-700"
                                  }`}
                                >
                                  Cash on Delivery
                                </button>
                              </div>

                              {/* Card Payment Reference Field */}
                              {(currentPaymentMethodState === POSPaymentMethod.CARD || 
                                currentPaymentMethodState === POSPaymentMethod.BANK_TRANSFER || 
                                currentPaymentMethodState === POSPaymentMethod.PBL || 
                                currentPaymentMethodState === POSPaymentMethod.TALABAT) && (
                                <div className="mt-6">
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {currentPaymentMethodState === POSPaymentMethod.CARD ? 'Card Reference' : 'Payment Reference'}
                                  </label>
                                  <input
                                    type="text"
                                    value={currentPaymentReferenceState}
                                    onChange={(e) => setCurrentPaymentReferenceState(e.target.value)}
                                    className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                    placeholder="Enter card reference"
                                  />
                                </div>
                              )}

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
                                 
                                </div>
                              )}

                              {/* Partial Payment Form */}
                              {currentPaymentMethodState === POSPaymentMethod.PARTIAL && (
                                <div className="mt-6 space-y-6">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Partial Payment Amount</label>
                                    <input
                                      type="number"
                                      value={currentPaymentAmountState}
                                      onChange={(e) => setCurrentPaymentAmountState(e.target.value)}
                                      className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                      placeholder="Enter amount to pay now"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method for Partial Amount</label>
                                    <div className="grid grid-cols-2 gap-4">
                                      <button
                                        type="button"
                                        onClick={() => setPartialPaymentMethod(POSPaymentMethod.CASH)}
                                        className={`p-4 text-lg font-medium rounded-xl border-2 transition-all ${
                                          partialPaymentMethod === POSPaymentMethod.CASH
                                            ? "bg-black text-white"
                                            : "bg-gray-100 text-gray-700"
                                        }`}
                                      >
                                        Cash
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setPartialPaymentMethod(POSPaymentMethod.CARD)}
                                        className={`p-4 text-lg font-medium rounded-xl border-2 transition-all ${
                                          partialPaymentMethod === POSPaymentMethod.CARD
                                            ? "bg-black text-white"
                                            : "bg-gray-100 text-gray-700"
                                        }`}
                                      >
                                        Card
                                      </button>
                                    </div>
                                  </div>
                                  {partialPaymentMethod === POSPaymentMethod.CARD && (
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">Card Reference</label>
                                      <input
                                        type="text"
                                        value={currentPaymentReferenceState}
                                        onChange={(e) => setCurrentPaymentReferenceState(e.target.value)}
                                        className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                        placeholder="Enter card reference"
                                      />
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl">
                                    <div className="space-y-1">
                                      <div className="text-sm font-medium text-gray-900">
                                        Total: AED {cartTotal.toFixed(2)}
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        Paying Now: AED {(parseFloat(currentPaymentAmountState) || 0).toFixed(2)}
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        Remaining: AED {(cartTotal - (parseFloat(currentPaymentAmountState) || 0)).toFixed(2)}
                                      </div>
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
                            {/* Action Buttons */}
                            <div className="flex gap-4">
                              <button
                                type="button"
                                onClick={handleCreateOrder}
                                disabled={isSubmitting || isParkingOrder}
                                className={`flex-[2] inline-flex justify-center rounded-lg border border-transparent shadow-sm px-6 py-4 bg-black text-xl font-medium text-white hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors`}
                              >
                                {isSubmitting ? "Processing..." : "Complete Order"}
                              </button>
                              <button
                                type="button"
                                onClick={handleParkOrder}
                                disabled={isSubmitting || isParkingOrder}
                                className={`flex-1 inline-flex justify-center rounded-lg border-2 border-black px-6 py-4 bg-white text-lg font-medium text-black hover:bg-gray-50 disabled:bg-gray-100 disabled:border-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors`}
                              >
                                {isParkingOrder ? "Processing..." : "Hold Order"}
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
