// Import necessary modules and components
import { Fragment, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { X, Minus, Plus, Trash, Search, ShoppingCart, Upload, Camera, User, MapPin, ListOrdered, Calendar } from "lucide-react";
import { toast } from "@/lib/toast-utils";
import { apiMethods } from "@/services/api";
import { POSOrderStatus, POSPaymentMethod, POSPaymentStatus, DeliveryMethod, OrderPayment, POSOrderData, POSOrderItemData, ProductVariation, CheckoutDetails, ParkedOrderData } from "@/types/order";
import { Customer, CustomerAddress, CustomerDetails, DeliveryDetails, PickupDetails, GiftDetails } from "@/types/customer";
import { Payment } from "@/types/payment";
import { nanoid } from 'nanoid';
import { orderDrawerService } from '@/services/order-drawer.service';
import { DatePicker } from "@/components/ui/date-picker";
import { formatDate, dateToISOString } from "@/lib/utils";

// Function to get printer configuration
async function getPrinterConfig() {
  const proxyUrl = process.env.NEXT_PUBLIC_PRINTER_PROXY_URL || 'http://localhost:3005';
  try {
    // Try to get printer config from the printer proxy
    console.log('Fetching printer config from printer proxy');
    const response = await fetch(`${proxyUrl}/api/printer/config`);
    const data = await response.json();

    if (data && data.success && data.printer) {
      console.log('Using printer config from proxy:', data.printer);
      return {
        ip: data.printer.ipAddress,
        port: data.printer.port,
        skipConnectivityCheck: true
      };
    }

    // Fallback to default values
    return {
      skipConnectivityCheck: true
    };
  } catch (error) {
    console.error('Error fetching printer config:', error);
    // Return default values if there's an error
    return {
      skipConnectivityCheck: true
    };
  }
}

import Image from "next/image";
import ImageUpload from "./custom-images/image-upload";
import { useAuth } from "@/providers/auth-provider";
import debounce from 'lodash/debounce';
import { CartItem, CustomImage } from "@/types/cart";
import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';
import crypto from 'crypto';
import { drawerService } from '@/services/drawer.service';
import { uploadCustomImages, uploadCustomImage } from '@/utils/firebase-storage';
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
  const [currentPaymentMethodState, setCurrentPaymentMethodState] = useState<POSPaymentMethod | null>(
    paymentMethod || null
  );
  const [currentPaymentReferenceState, setCurrentPaymentReferenceState] = useState('');
  const [currentPaymentAmountState, setCurrentPaymentAmountState] = useState('');
  const [isPartialPaymentState, setIsPartialPaymentState] = useState(false);
  const [isSplitPaymentState, setIsSplitPaymentState] = useState(false);
  const [partialPaymentMethod, setPartialPaymentMethod] = useState<POSPaymentMethod>(POSPaymentMethod.CASH);

  // Loading state for image uploads and order processing
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');

  // Updated split payment state variables
  const [splitMethod1, setSplitMethod1] = useState<POSPaymentMethod>(POSPaymentMethod.CASH);
  const [splitMethod2, setSplitMethod2] = useState<POSPaymentMethod>(POSPaymentMethod.CARD);
  const [splitAmount1, setSplitAmount1] = useState('');
  const [splitAmount2, setSplitAmount2] = useState('');
  const [splitReference1, setSplitReference1] = useState('');
  const [splitReference2, setSplitReference2] = useState('');

  // Legacy variables for backward compatibility
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
    
    // Calculate cart total without rounding yet
    const rawCartTotal = processedCart.reduce((total, item) => {
      const unitPrice = item.product.allowCustomPrice
        ? Number(item.product.basePrice)
        : Number(item.product.basePrice) + (item.selectedVariations || []).reduce(
            (vTotal, v) => vTotal + (Number(v.price) || Number(v.priceAdjustment) || 0),
            0
          );
      return total + (unitPrice * item.quantity);
    }, 0);
    
    // Use the same final total calculation as calculateFinalTotal
    let finalTotal = rawCartTotal;
    
    // Calculate coupon discount if available
    const couponDiscount = appliedCoupon ? Number(appliedCoupon.discount.toFixed(2)) : 0;
    
    // Apply coupon discount if available
    if (appliedCoupon) {
      finalTotal = finalTotal - couponDiscount;
    }

    // Add delivery charge if applicable
    if (deliveryMethodState === DeliveryMethod.DELIVERY && deliveryDetailsState?.emirate) {
      finalTotal = finalTotal + (deliveryDetailsState.charge || 0);
    }

    // Round only at the end
    finalTotal = Number(finalTotal.toFixed(2));
    const totalWithDelivery = finalTotal;

    // Create order items from cart
    const orderItems = processedCart.map(item => {
      // For custom products, use the product's basePrice directly (which was set to the custom price)
      // and ignore variation price adjustments
      if (item.product.allowCustomPrice) {
        // Ensure unitPrice is properly rounded to avoid floating point issues
        const unitPrice = Number(item.product.basePrice.toFixed(2));

        // For PBL orders, ensure we use the correct total
        if (currentPaymentMethodState === POSPaymentMethod.PBL) {
          finalTotal = Number(finalTotal.toFixed(2));
        }

        const itemData: POSOrderItemData = {
          id: nanoid(),
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: unitPrice,
          totalPrice: Number((unitPrice * item.quantity).toFixed(2)),
          sku: item.product.sku || '',
          requiresKitchen: item.product.requiresKitchen || false,
          requiresDesign: item.product.requiresDesign || false,
          variations: {
            variationsObj: (item.selectedVariations || []).reduce((acc, v) => ({
              ...acc,
              [v.type]: v.customText ? `${v.value} (${v.customText})` : v.value
            }), {}),
            selectedVariations: (item.selectedVariations || []).map(v => ({
              id: nanoid(),
              type: v.type,
              value: v.value,
              priceAdjustment: v.price || 0,
              customText: v.customText
            }))
          },
          selectedVariations: (item.selectedVariations || []).map(v => ({
            id: nanoid(),
            type: v.type,
            value: v.value,
            priceAdjustment: v.price || 0,
            customText: v.customText
          })),
          // Add custom images if available
          customImages: item.customImages && item.customImages.length > 0 ? item.customImages.map(img => ({
            id: img.id || nanoid(),
            url: img.url || '',
            comment: img.comment || ''
          })) : undefined,
          notes: item.notes
        };

        return itemData;
      } else {
        // Calculate unit price including variations with proper rounding
        const variationPriceAdjustments = (item.selectedVariations || []).reduce(
          (total, variation) => {
            const adjustmentAmount = variation.price || variation.priceAdjustment || 0;
            return Number((total + adjustmentAmount).toFixed(2));
          },
          0
        );
        const unitPrice = Number((item.product.basePrice + variationPriceAdjustments).toFixed(2));

        const itemData: POSOrderItemData = {
          id: nanoid(),
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: unitPrice,
          totalPrice: Number((unitPrice * item.quantity).toFixed(2)),
          sku: item.product.sku || '',
          requiresKitchen: item.product.requiresKitchen || false,
          requiresDesign: item.product.requiresDesign || false,
          variations: {
            variationsObj: (item.selectedVariations || []).reduce((acc, v) => ({
              ...acc,
              [v.type]: v.customText ? `${v.value} (${v.customText})` : v.value
            }), {}),
            selectedVariations: (item.selectedVariations || []).map(v => ({
              id: nanoid(),
              type: v.type,
              value: v.value,
              priceAdjustment: v.price || v.priceAdjustment || 0,
              customText: v.customText
            }))
          },
          selectedVariations: (item.selectedVariations || []).map(v => ({
            id: nanoid(),
            type: v.type,
            value: v.value,
            priceAdjustment: v.price || v.priceAdjustment || 0,
            customText: v.customText
          })),
          // Add custom images if available
          customImages: item.customImages && item.customImages.length > 0 ? item.customImages.map(img => ({
            id: img.id || nanoid(),
            url: img.url || '',
            comment: img.comment || ''
          })) : undefined,
          notes: item.notes
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
    
    // Round the total to 2 decimal places to avoid floating point precision issues
    const roundedTotal = Number(totalWithDelivery.toFixed(2));
    console.log('Preparing order with final total:', roundedTotal);
    
    // For debugging - log the cart items and their prices
    console.log('Cart items for order:', processedCart.map(item => ({
      name: item.product.name,
      basePrice: item.product.basePrice,
      quantity: item.quantity,
      totalPrice: item.totalPrice,
      variations: item.selectedVariations?.length || 0,
      isCustomPrice: item.product.allowCustomPrice
    })));

    // Log coupon information if applied
    if (appliedCoupon) {
      console.log('Applied coupon:', {
        code: appliedCoupon.code,
        type: appliedCoupon.type,
        value: appliedCoupon.value,
        discount: appliedCoupon.discount
      });
    }
    
    if (payments.length === 0 && currentPaymentMethodState) {
      // Create a default payment with the selected payment method
      const finalTotal = calculateFinalTotal();
      const defaultPayment: Payment = {
        id: nanoid(),
        amount: finalTotal, // Always use final total for consistency
        method: currentPaymentMethodState,
        reference: (currentPaymentMethodState === POSPaymentMethod.CARD ||
                   currentPaymentMethodState === POSPaymentMethod.BANK_TRANSFER ||
                   currentPaymentMethodState === POSPaymentMethod.PBL ||
                   currentPaymentMethodState === POSPaymentMethod.TALABAT ||
                   currentPaymentMethodState === POSPaymentMethod.PAY_LATER) ? currentPaymentReferenceState || null : null,
        status: currentPaymentMethodState === POSPaymentMethod.PAY_LATER ? POSPaymentStatus.PENDING : POSPaymentStatus.FULLY_PAID
      };

      // Add specific fields based on payment method
      if (currentPaymentMethodState === POSPaymentMethod.CASH) {
        defaultPayment.cashAmount = roundedTotal;
        defaultPayment.changeAmount = 0;
      } else if (currentPaymentMethodState === POSPaymentMethod.CARD) {
        defaultPayment.reference = currentPaymentReferenceState || null;
      } else if (currentPaymentMethodState === POSPaymentMethod.SPLIT) {
        defaultPayment.isSplitPayment = true;

        // Get the amounts for both payment methods and ensure they're properly rounded
        const amount1 = Number(parseFloat(splitAmount1 || '0').toFixed(2));
        const amount2 = Number(parseFloat(splitAmount2 || '0').toFixed(2));
        
        // Ensure the total of split payments matches the rounded total
        const splitTotal = Number((amount1 + amount2).toFixed(2));
        
        if (splitTotal !== roundedTotal) {
          console.warn(`Split payment total (${splitTotal}) doesn't match order total (${roundedTotal}). Adjusting amount2.`);
          // Adjust amount2 to make the total match
          const adjustedAmount2 = Number((roundedTotal - amount1).toFixed(2));
          defaultPayment.splitFirstAmount = amount1;
          defaultPayment.splitSecondAmount = adjustedAmount2;
        } else {
          defaultPayment.splitFirstAmount = amount1;
          defaultPayment.splitSecondAmount = amount2;
        }

        // Store payment method information
        defaultPayment.splitFirstMethod = splitMethod1;
        defaultPayment.splitSecondMethod = splitMethod2;
        defaultPayment.splitFirstReference = splitReference1 || null;
        defaultPayment.splitSecondReference = splitReference2 || null;

        // For backward compatibility
        if (splitMethod1 === POSPaymentMethod.CASH || splitMethod2 === POSPaymentMethod.CASH) {
          defaultPayment.cashPortion = splitMethod1 === POSPaymentMethod.CASH ? 
            defaultPayment.splitFirstAmount : defaultPayment.splitSecondAmount;
        } else {
          defaultPayment.cashPortion = 0;
        }

        if (splitMethod1 === POSPaymentMethod.CARD || splitMethod2 === POSPaymentMethod.CARD) {
          defaultPayment.cardPortion = splitMethod1 === POSPaymentMethod.CARD ? 
            defaultPayment.splitFirstAmount : defaultPayment.splitSecondAmount;
          defaultPayment.cardReference = splitMethod1 === POSPaymentMethod.CARD ? 
            splitReference1 : splitReference2;
        } else {
          defaultPayment.cardPortion = 0;
          defaultPayment.cardReference = null;
        }
      } else if (currentPaymentMethodState === POSPaymentMethod.PARTIAL) {
        defaultPayment.isPartialPayment = true;
        const finalTotal = calculateFinalTotal();
        const paymentAmount = currentPaymentAmountState ? Number(currentPaymentAmountState) : 0;
        defaultPayment.amount = paymentAmount;
        defaultPayment.remainingAmount = Number((finalTotal - paymentAmount).toFixed(2));
        defaultPayment.futurePaymentMethod = POSPaymentMethod.CARD;
      }

      payments = [defaultPayment];
    }

    // Calculate the final total including all discounts
    const finalOrderTotal = calculateFinalTotal();
    
    // For PBL and pay later orders, always use the final total as the payment amount
    if (currentPaymentMethodState === POSPaymentMethod.PBL || currentPaymentMethodState === POSPaymentMethod.PAY_LATER) {
      if (payments.length > 0) {
        payments[0].amount = finalOrderTotal;
        // For PBL orders, ensure no remaining amount
        payments[0].remainingAmount = 0;
      }
    }
    
    // Check if this is a partial payment order
    const hasPartialPayment = currentPaymentMethodState === POSPaymentMethod.PARTIAL || 
      payments.some(p => p.isPartialPayment || p.status === POSPaymentStatus.PARTIALLY_PAID);
    
    // Calculate the total amount actually being paid (important for partial payments)
    const totalPaidAmount = payments.reduce((sum, payment) => {
      return Number((sum + Number(payment.amount.toFixed(2))).toFixed(2));
    }, 0);
    
    // Log the payment validation data for debugging
    console.log('Payment validation:', {
      finalOrderTotal,
      totalPaidAmount: Number(totalPaidAmount.toFixed(2)),
      hasPartialPayment,
      difference: Math.abs(totalPaidAmount - finalOrderTotal),
      payments: payments.map(p => ({ method: p.method, amount: p.amount, isPartialPayment: p.isPartialPayment }))
    });
    
    // For non-partial payments, verify that payment amounts match the order total
    // For partial payments, only verify that amount doesn't exceed total and is greater than 0
    if (hasPartialPayment) {
      if (totalPaidAmount >= finalOrderTotal) {
        throw new Error(`Partial payment (${totalPaidAmount}) must be less than the total (${finalOrderTotal})`);
      } else if (totalPaidAmount <= 0) {
        throw new Error(`Partial payment amount must be greater than 0`);
      }
    } else if (![
      POSPaymentMethod.PBL,
      POSPaymentMethod.PAY_LATER
    ].includes(currentPaymentMethodState) && Math.abs(totalPaidAmount - finalOrderTotal) > 0.01) {
      throw new Error(`Total payment amount (${totalPaidAmount}) does not match order total (${finalOrderTotal})`);
    }

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
          // Add split payment details using new schema
          if (p.splitFirstMethod && p.splitFirstAmount) {
            paymentData.splitFirstMethod = p.splitFirstMethod;
            paymentData.splitFirstAmount = Number(p.splitFirstAmount);
            paymentData.splitFirstReference = p.splitFirstReference || null;
          }
          
          if (p.splitSecondMethod && p.splitSecondAmount) {
            paymentData.splitSecondMethod = p.splitSecondMethod;
            paymentData.splitSecondAmount = Number(p.splitSecondAmount);
            paymentData.splitSecondReference = p.splitSecondReference || null;
          }

          // For backward compatibility with old split payments
          if (!p.splitFirstMethod && !p.splitSecondMethod) {
            // Convert old cash/card split to new format
            if (p.cashPortion) {
              paymentData.splitFirstMethod = POSPaymentMethod.CASH;
              paymentData.splitFirstAmount = Number(p.cashPortion);
            }
            if (p.cardPortion) {
              paymentData.splitSecondMethod = POSPaymentMethod.CARD;
              paymentData.splitSecondAmount = Number(p.cardPortion);
              paymentData.splitSecondReference = p.cardReference || null;
            }
          }
        } else if (p.method === POSPaymentMethod.PARTIAL || p.isPartialPayment) {
          paymentData.isPartialPayment = true;
          // Use finalOrderTotal which already includes coupon discounts
          paymentData.remainingAmount = Number((finalOrderTotal - p.amount).toFixed(2));
          paymentData.futurePaymentMethod = p.futurePaymentMethod || POSPaymentMethod.CARD;
        }

        return paymentData;
      }),
      // Use the final order total that includes coupon discounts
      total: finalTotal, // This should be the discounted total
      actualTotal: cartTotal, // This should be the original total before discount
      subtotal: cartTotal,
      // Always include coupon information
      couponCode: appliedCoupon ? appliedCoupon.code : null,
      couponDiscount: couponDiscount,
      couponType: appliedCoupon ? appliedCoupon.type : null,
      couponValue: appliedCoupon ? appliedCoupon.value : null,
      // For partial payments, include the paid and remaining amounts
      paidAmount: currentPaymentMethodState === POSPaymentMethod.PBL ? finalTotal : 
                 hasPartialPayment ? Number(totalPaidAmount.toFixed(2)) : finalTotal,
      remainingAmount: hasPartialPayment ? Number((finalTotal - totalPaidAmount).toFixed(2)) : 0,
      // Total amount to be paid (after coupon discount)
      amountToPay: finalTotal,
      allowPartialPayment: hasPartialPayment, // Flag to tell backend this order allows partial payment

      // Payment details
      paymentMethod: getApiPaymentMethod(),
      paymentReference: currentPaymentReferenceState || '',

      // Customer details
      customerName: sanitizedCustomerDetails.name || 'Walk-in Customer',
      customerEmail: sanitizedCustomerDetails.email || '',
      customerPhone: sanitizedCustomerDetails.phone || '',

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
        Number(giftDetailsState.cashAmount?.trim() || '0') :
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
        },
        // Include coupon information in metadata
        coupon: appliedCoupon ? {
          code: appliedCoupon.code,
          type: appliedCoupon.type,
          value: appliedCoupon.value,
          discount: couponDiscount,
          appliedTotal: finalTotal // Include the total after coupon discount
        } : null
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
    name: customerDetailsState.name?.trim() || 'Walk-in Customer',
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

  // Calculate final total including discounts and delivery with proper rounding
  const calculateFinalTotal = useCallback(() => {
    // Start with cart total without rounding yet
    let total = cartTotal;

    // Apply coupon discount if available
    if (appliedCoupon) {
      total = total - appliedCoupon.discount;
    }

    // Add delivery charge if applicable
    if (deliveryMethodState === DeliveryMethod.DELIVERY && deliveryDetailsState?.emirate) {
      total = total + (deliveryDetailsState.charge || 0);
    }

    // Round only at the end to minimize floating point errors
    total = Number(total.toFixed(2));

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

    // Validate that the partial payment amount is greater than 0 and less than the total
    if (amount <= 0) {
      toast.error('Partial payment amount must be greater than 0');
      return;
    }

    if (amount >= finalTotal) {
      toast.error('Partial payment amount must be less than the total amount');
      return;
    }

    const payment: Payment = {
      id: nanoid(),
      amount,
      method,
      reference: (method === POSPaymentMethod.CARD ||
                 method === POSPaymentMethod.BANK_TRANSFER ||
                 method === POSPaymentMethod.PBL ||
                 method === POSPaymentMethod.TALABAT) ? reference || null : null,
      status: POSPaymentStatus.PARTIALLY_PAID,
      isPartialPayment: true,
      remainingAmount: finalTotal - amount,
      futurePaymentMethod: method // Set future payment method to the same as current method
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
        const finalTotal = calculateFinalTotal();
        if (amount && !isNaN(amount) && amount > 0 && amount < finalTotal) {
          const payment: Payment = {
            id: nanoid(),
            amount,
            method: partialPaymentMethod,
            reference: (partialPaymentMethod === POSPaymentMethod.CARD ||
                      partialPaymentMethod === POSPaymentMethod.BANK_TRANSFER ||
                      partialPaymentMethod === POSPaymentMethod.PBL ||
                      partialPaymentMethod === POSPaymentMethod.TALABAT) ? currentPaymentReferenceState || null : null,
            status: POSPaymentStatus.PARTIALLY_PAID,
            isPartialPayment: true,
            remainingAmount: finalTotal - amount,
            futurePaymentMethod: partialPaymentMethod // Use the same payment method for future payment
          };

          if (partialPaymentMethod === POSPaymentMethod.CASH) {
            payment.cashAmount = amount;
            payment.changeAmount = 0;
          }

          handleAddPayment(payment);
        }
      }

      // Set loading state during image upload process
      setIsLoading(true);
      setLoadingMessage('Uploading images... This may take a moment');

      // Check if any items have custom images that need to be uploaded
      const hasCustomImages = cart.some(item => 
        item.customImages && 
        item.customImages.length > 0 && 
        item.customImages.some(img => img.file && (!img.url || !img.url.startsWith('http')))
      );

      if (hasCustomImages) {
        console.log('Custom images detected, starting upload process before order creation');
      } else {
        console.log('No custom images to upload, proceeding with order creation');
      }

      // Process custom images for each cart item
      const processedCart = await Promise.all(
        cart.map(async (item) => {
          if (item.customImages && item.customImages.length > 0) {
            try {
              // Create a temporary order ID for storage path
              const tempOrderId = nanoid();

              console.log(`Processing ${item.customImages.length} custom images for item ${item.id}`);
              
              // Process each image individually with retry logic
              const processedImages = await Promise.all(
                item.customImages.map(async (image, index) => {
                  // Skip if already has valid URL
                  if (image.url && image.url.startsWith('http')) {
                    console.log(`Image ${index} already has valid URL: ${image.url}`);
                    return image;
                  }
                  
                  // Try uploading with retries
                  let attempts = 0;
                  const maxAttempts = 3;
                  let uploadedImage = { ...image };
                  
                  while (attempts < maxAttempts) {
                    try {
                      attempts++;
                      setLoadingMessage(`Uploading image ${index+1} for ${item.product.name} (Attempt ${attempts}/${maxAttempts})`);
                      console.log(`Uploading image ${index} for item ${item.id}, attempt ${attempts}`);
                      
                      if (!image.file) {
                        console.warn(`No file for image ${index}, skipping upload`);
                        break;
                      }
                      
                      // Upload single image with longer timeout
                      const downloadURL = await uploadCustomImage(image.file, tempOrderId, index);
                      
                      if (downloadURL && downloadURL.startsWith('http')) {
                        console.log(`Successfully uploaded image ${index}, got URL: ${downloadURL}`);
                        uploadedImage.url = downloadURL;
                        break; // Success, exit retry loop
                      } else {
                        console.warn(`Failed to get valid URL for image ${index}, attempt ${attempts}`);
                        // Will retry if attempts < maxAttempts
                        if (attempts < maxAttempts) {
                          // Add a small delay before retry
                          await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                      }
                    } catch (err) {
                      console.error(`Error uploading image ${index}, attempt ${attempts}:`, err);
                      // Will retry if attempts < maxAttempts
                      if (attempts < maxAttempts) {
                        // Add a small delay before retry
                        await new Promise(resolve => setTimeout(resolve, 1000));
                      }
                    }
                  }
                  
                  return uploadedImage;
                })
              );

              // Log the uploaded images
              console.log('Processed images for item:', item.id, processedImages.map(img => ({ id: img.id, url: img.url })));
              
              // Verify all images have valid URLs
              const validImages = processedImages.filter(img => img.url && img.url.startsWith('http'));
              console.log(`${validImages.length} of ${processedImages.length} images have valid URLs`);

              // Check if any required images failed to upload
              if (validImages.length < processedImages.length) {
                const failedCount = processedImages.length - validImages.length;
                console.warn(`${failedCount} images failed to upload for item ${item.id}`);
                
                // If all uploads failed, throw an error to trigger the catch block
                if (validImages.length === 0 && processedImages.length > 0) {
                  throw new Error(`All ${processedImages.length} image uploads failed for item ${item.id}`);
                }
              }

              // Return updated cart item with uploaded image URLs
              return {
                ...item,
                customImages: processedImages
              };
            } catch (error) {
              console.error('Error processing images for item:', item.id, error);
              
              // Show error to user
              toast.error(`Failed to upload images for ${item.product.name}. Please try again.`);
              
              // Stop the checkout process if image upload fails
              setIsLoading(false);
              throw new Error(`Image upload failed for item ${item.id}: ${error.message}`);
            }
          }
          return item;
        })
      ).catch(error => {
        console.error('Failed to process cart images:', error);
        setIsLoading(false);
        throw error; // Re-throw to stop the checkout process
      });

      // Verify all items with custom images have at least one valid image URL
      const itemsWithMissingImages = processedCart.filter(item => 
        item.customImages && 
        item.customImages.length > 0 && 
        !item.customImages.some(img => img.url && img.url.startsWith('http'))
      );

      if (itemsWithMissingImages.length > 0) {
        const itemNames = itemsWithMissingImages.map(item => item.product.name).join(', ');
        const errorMessage = `Failed to upload images for: ${itemNames}. Please try again.`;
        console.error(errorMessage);
        toast.error(errorMessage);
        setIsLoading(false);
        throw new Error(errorMessage);
      }

      // Update cart with processed images
      setCart(processedCart);
      setLoadingMessage('Images uploaded successfully. Creating order...');

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
          customImages: item.customImages?.map(img => ({ id: img.id, url: img.url, comment: img.comment }))
        }))
      });

      // Log the final order data with totals before sending to API
      console.log('Final order data with totals:', {
        total: orderData.total,
        actualTotal: orderData.actualTotal,
        subtotal: orderData.subtotal,
        paymentTotal: orderData.payments.reduce((sum, p) => sum + p.amount, 0)
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
                status: currentPaymentMethodState === POSPaymentMethod.PAY_LATER ? POSPaymentStatus.PENDING : POSPaymentStatus.FULLY_PAID
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

            // Using direct axios call to the cash-order endpoint with timeout and retry logic
            let cashOrderResponse;
            let retryCount = 0;
            const maxRetries = 2;

            while (retryCount <= maxRetries) {
              try {
                console.log(`Attempt ${retryCount + 1} to call cash-order endpoint`);
                // Get printer configuration from the environment or use default
                const printerConfig = await getPrinterConfig();

                // Prepare the request data - use the same format as the printer test page and order drawer service
                const requestData = {
                  // Include printer configuration
                  ip: printerConfig.ip,
                  port: printerConfig.port,
                  skipConnectivityCheck: true,
                  // Include order type
                  type: 'order',
                  // Include order ID
                  orderId: response.data?.id,
                  // Include complete order data
                  order: {
                    // Basic order info
                    orderNumber: response.data?.orderNumber,
                    id: response.data?.id,
                    // Include payments
                    payments: paymentData,
                    // Include order items
                    items: cart.map(item => ({
                      productId: item.product.id,
                      productName: item.product.name,
                      quantity: item.quantity,
                      // Use product's basePrice as unitPrice
                      unitPrice: item.product.basePrice,
                      totalPrice: item.totalPrice,
                      selectedVariations: (item.selectedVariations || []).map(v => ({
                        ...v,
                        value: v.customText ? `${v.value} (${v.customText})` : v.value
                      })),
                      notes: item.notes || ''
                    })),
                    // Include customer details
                    customerName: customerDetailsState.name || 'Walk-in Customer',
                    customerEmail: customerDetailsState.email || '',
                    customerPhone: customerDetailsState.phone || '',
                    // Include totals
                    subtotal: cartTotal, // Use cartTotal from props instead of calculateSubtotal
                    total: calculateFinalTotal(),
                    // Include delivery/pickup details
                    deliveryMethod: deliveryMethodState,
                    deliveryDate: deliveryMethodState === 'DELIVERY' ? deliveryDetailsState?.date : pickupDetailsState?.date,
                    deliveryTimeSlot: deliveryMethodState === 'DELIVERY' ? deliveryDetailsState?.timeSlot : pickupDetailsState?.timeSlot,
                    // Include gift details if applicable
                    isGift: giftDetailsState?.isGift || false,
                    giftMessage: giftDetailsState?.message,
                    giftRecipientName: giftDetailsState?.recipientName,
                    giftRecipientPhone: giftDetailsState?.recipientPhone
                  }
                };

                console.log('Sending cash-order request with data:', JSON.stringify(requestData, null, 2));

                // Use fetch with retry logic for better reliability
                let fetchResponse;
                let responseData;
                let retryAttempt = 0;
                const maxRetries = 2; // Try up to 3 times (initial + 2 retries)
                let success = false;
                
                while (!success && retryAttempt <= maxRetries) {
                  try {
                    if (retryAttempt > 0) {
                      console.log(`Retry attempt ${retryAttempt} for cash-order request...`);
                    }
                    
                    fetchResponse = await fetch(`${proxyUrl}/cash-order`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify(requestData)
                    });
                    
                    console.log(`Cash order response status:`, fetchResponse.status);
                    responseData = await fetchResponse.json();
                    console.log(`Cash order response data:`, responseData);
                    
                    if (fetchResponse.status === 200 && responseData.success) {
                      console.log('Cash order request successful');
                      success = true;
                      break;
                    } else {
                      console.error('Cash order request failed:', responseData.error || 'Unknown error');
                      retryAttempt++;
                      
                      if (retryAttempt <= maxRetries) {
                        // Wait a bit before retrying
                        console.log(`Waiting before retry ${retryAttempt}...`);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                      }
                    }
                  } catch (error) {
                    console.error('Error sending cash-order request:', error);
                    retryAttempt++;
                    
                    if (retryAttempt <= maxRetries) {
                      // Wait a bit before retrying
                      console.log(`Waiting before retry ${retryAttempt} after error...`);
                      await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                  }
                }
                
                if (!success) {
                  console.warn('Failed to complete cash-order request after multiple attempts');
                  // Fallback to just opening the drawer as last resort
                  try {
                    console.log('Attempting fallback to just open cash drawer...');
                    await fetch(`${proxyUrl}/open-drawer`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        ip: printerConfig.ip,
                        port: printerConfig.port,
                        skipConnectivityCheck: true
                      })
                    });
                  } catch (fallbackError) {
                    console.error('Fallback drawer open also failed:', fallbackError);
                  }
                }

                // Create a response object that matches the axios format for compatibility
                cashOrderResponse = {
                  status: fetchResponse ? fetchResponse.status : 500,
                  data: responseData || { success: false, error: 'Failed to complete cash-order request' }
                };

                console.log('Cash order response received:', cashOrderResponse.data);

                if (success) {
                  console.log('Cash order request successful');

                  // Record cash transaction in the till
                  try {
                    // Calculate total cash amount from all payments
                    const totalCashAmount = paymentData.reduce((total, payment) => {
                      if (payment.method === POSPaymentMethod.CASH) {
                        return total + parseFloat(payment.amount.toString());
                      } else if (payment.isSplitPayment && payment.cashPortion) {
                        return total + parseFloat(payment.cashPortion.toString());
                      }
                      return total;
                    }, 0);

                    console.log('Recording cash sale in till for amount:', totalCashAmount);
                    const recordResult = await orderDrawerService.recordCashSale(
                      totalCashAmount,
                      response.data?.orderNumber
                    );

                    if (recordResult) {
                      console.log('Successfully recorded cash sale in till');
                    } else {
                      console.error('Failed to record cash sale in till');
                    }
                  } catch (recordError) {
                    console.error('Error recording cash sale in till:', recordError);
                  }

                  break; // Success, exit the retry loop
                } else {
                  console.warn('Cash order request unsuccessful:', cashOrderResponse.data?.message || 'Unknown error');
                  retryCount++;
                }
              } catch (retryError) {
                console.error(`Attempt ${retryCount + 1} failed:`, retryError.message);
                retryCount++;

                if (retryCount <= maxRetries) {
                  console.log(`Retrying in 1 second... (${retryCount}/${maxRetries})`);
                  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
                }
              }
            }

            if (!cashOrderResponse || cashOrderResponse.status !== 200) {
              console.warn('All cash order attempts failed');
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
            console.log('Calling print-order endpoint for receipt printing');

            // Get printer configuration
            const printerConfig = await getPrinterConfig();

            // Prepare the request data - use the same format as till-management.tsx
            const requestData = {
              // Include printer configuration
              ip: printerConfig.ip,
              port: printerConfig.port,
              // Include complete order data
              order: {
                // Basic order info
                orderNumber: response.data?.orderNumber,
                id: response.data?.id,
                orderId: response.data?.id,
                // Include payment method explicitly
                paymentMethod: currentPaymentMethodState,
                // Include payments
                payments: paymentsState,
                // Include order items
                items: cart.map(item => ({
                  productId: item.product.id,
                  productName: item.product.name,
                  quantity: item.quantity,
                  // Use product's basePrice as unitPrice
                  unitPrice: item.product.basePrice,
                  totalPrice: item.totalPrice,
                  selectedVariations: (item.selectedVariations || []).map(v => ({
                    ...v,
                    value: v.customText ? `${v.value} (${v.customText})` : v.value
                  })),
                  notes: item.notes || ''
                })),
                // Include customer details
                customerName: customerDetailsState.name || 'Walk-in Customer',
                customerEmail: customerDetailsState.email || '',
                customerPhone: customerDetailsState.phone || '',
                // Include totals
                subtotal: cartTotal,
                total: calculateFinalTotal(),
                // Include delivery/pickup details
                deliveryMethod: deliveryMethodState,
                deliveryDate: deliveryMethodState === 'DELIVERY' ? deliveryDetailsState?.date : pickupDetailsState?.date,
                deliveryTimeSlot: deliveryMethodState === 'DELIVERY' ? deliveryDetailsState?.timeSlot : pickupDetailsState?.timeSlot,
                // Include gift details if applicable
                isGift: giftDetailsState?.isGift || false,
                giftMessage: giftDetailsState?.message,
                giftRecipientName: giftDetailsState?.recipientName,
                giftRecipientPhone: giftDetailsState?.recipientPhone
              },
              skipConnectivityCheck: true
            };

            console.log('Sending print-order request with data:', JSON.stringify(requestData, null, 2));

            // Use fetch instead of axios to match the till-management implementation
            const fetchResponse = await fetch(`${proxyUrl}/print-order`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(requestData)
            });

            console.log(`Print order response status:`, fetchResponse.status);
            const responseData = await fetchResponse.json();

            if (fetchResponse.status !== 200) {
              console.warn('Print order request unsuccessful:', responseData?.message || 'Unknown error');
              toast.warning('Could not print receipt. Please check printer connection.');
            } else {
              console.log('Print order successful:', responseData);
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
      // Reset all split payment fields
      setSplitMethod1(POSPaymentMethod.CASH);
      setSplitMethod2(POSPaymentMethod.CARD);
      setSplitAmount1('');
      setSplitAmount2('');
      setSplitReference1('');
      setSplitReference2('');

      // Reset legacy variables
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

  // Ensure all custom images have valid Firebase Storage URLs
  const ensureCustomImagesHaveUrls = async (cartItems) => {
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return cartItems;
    }

    console.log('Ensuring custom images have valid URLs before parking order...');

    // Create a temporary order ID for storage path
    const tempOrderId = nanoid();

    // Process each cart item
    const processedItems = await Promise.all(
      cartItems.map(async (item) => {
        // Skip items without custom images
        if (!item.customImages || !Array.isArray(item.customImages) || item.customImages.length === 0) {
          return item;
        }

        try {
          console.log(`Processing ${item.customImages.length} custom images for item ${item.id}`);

          // Upload images to Firebase Storage
          const uploadedImages = await uploadCustomImages(item.customImages, tempOrderId);

          console.log('Uploaded images:', uploadedImages.map(img => ({ id: img.id, url: img.url })));

          // Return updated item with uploaded image URLs
          return {
            ...item,
            customImages: uploadedImages.map(img => ({
              ...img,
              url: img.url || '/placeholder.jpg' // Ensure URL is never undefined
            }))
          };
        } catch (error) {
          console.error('Error uploading images for item:', item.id, error);
          // Return original item if upload fails
          return item;
        }
      })
    );

    return processedItems;
  };

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

      // Process cart items to ensure all custom images have valid Firebase Storage URLs
      const processedCart = await ensureCustomImagesHaveUrls(cart);

      // Prepare parked order data
      const parkedOrderData: ParkedOrderData = {
        name: orderName || `Order for ${customerDetailsState.name}`,
        customerName: customerDetailsState.name,
        customerPhone: customerDetailsState.phone,
        customerEmail: customerDetailsState.email,

        // Order items with processed custom images
        items: processedCart.map(item => ({
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
      reference: (currentPaymentMethodState === POSPaymentMethod.CARD ||
                 currentPaymentMethodState === POSPaymentMethod.BANK_TRANSFER ||
                 currentPaymentMethodState === POSPaymentMethod.PBL ||
                 currentPaymentMethodState === POSPaymentMethod.TALABAT) ? currentPaymentReferenceState : null,
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
  // We no longer need to restrict the maximum date
  // This function is kept for backward compatibility but returns null
  const getMaxDate = () => {
    return null; // No maximum date restriction
  };

  // Function to handle date selection for pickup
  const handlePickupDateSelect = (date: Date | undefined) => {
    if (date) {
      // Log the selected date for debugging
      console.log('Pickup date selected:', date);
      console.log('Formatted date:', dateToISOString(date));

      setPickupDetailsState(prev => ({
        ...prev,
        date: dateToISOString(date),
        timeSlot: '' // Reset time slot when date changes
      }));
    }
  };

  // Function to handle date selection for delivery
  const handleDeliveryDateSelect = (date: Date | undefined) => {
    if (date) {
      // Log the selected date for debugging
      console.log('Delivery date selected:', date);
      console.log('Formatted date:', dateToISOString(date));

      setDeliveryDetailsState(prev => ({
        ...prev,
        date: dateToISOString(date)
      }));
    }
  };

  // Emirates list
  const emirates = [
    "DUBAI",
    "ABU_DHABI",
    "SHARJAH",
    "AJMAN",
    "UMM_AL_QUWAIN",
    "RAS_AL_KHAIMAH",
    "FUJAIRAH",
    "AL_AIN"
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
      // Trim the coupon code to remove any whitespace
      const trimmedCouponCode = couponCode.trim();
      console.log('Validating coupon code:', trimmedCouponCode);
      
      const response = await apiMethods.pos.validateCoupon(trimmedCouponCode, cartTotal);
      console.log('Coupon Response:', response);

      // Check if the API returned an error
      if (!response.success) {
        // The API returns error messages in different formats depending on the endpoint
        // Use type assertion to access possible error message properties
        const responseAny = response as any;
        const errorMessage = responseAny.message || responseAny.error || 'Invalid coupon code';
        setCouponError(errorMessage);
        setAppliedCoupon(null);
        return;
      }
      
      // Check if the API returned valid data
      if (!response.data || !response.data.code) {
        setCouponError('Invalid coupon code');
        setAppliedCoupon(null);
        return;
      }

      // Parse numeric values and validate
      let parsedValue = response.data.value;
      
      // Ensure we have a valid numeric value
      if (typeof parsedValue === 'string') {
        // Remove any non-numeric characters except decimal point
        parsedValue = parseFloat(String(parsedValue).replace(/[^\d.]/g, ''));
      } else if (typeof parsedValue === 'number') {
        // If it's already a number, we're good
        parsedValue = parsedValue;
      } else {
        // If it's neither string nor number, default to 0
        parsedValue = 0;
      }
      
      console.log('Parsed coupon value:', parsedValue, 'Type:', response.data.type);
      
      // Validate the coupon value
      if (isNaN(parsedValue) || parsedValue <= 0) {
        setCouponError('Invalid coupon value');
        setAppliedCoupon(null);
        return;
      }
      
      // Additional validation for percentage coupons
      if (response.data.type === 'PERCENTAGE' && parsedValue > 100) {
        console.warn(`Percentage coupon with value > 100%: ${parsedValue}%`);
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
        if (response.data.maxDiscount) {
          // The API now returns numeric values directly
          const maxDiscount = response.data.maxDiscount;
          
          if (discount > maxDiscount) {
            discount = maxDiscount;
          }
        }
      } else { // FIXED_AMOUNT
        // For fixed amount, make sure we don't discount more than the cart total
        discount = Math.min(parsedValue, cartTotal);
      }
      
      console.log('Calculated discount:', discount);

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

      // Initialize the split payment methods if they haven't been set yet
      if (!splitAmount1 && !splitAmount2) {
        // Set default payment methods
        setSplitMethod1(POSPaymentMethod.CASH);
        setSplitMethod2(POSPaymentMethod.CARD);

        // Don't set default amounts - let the user enter them
        setSplitAmount1('');
        setSplitAmount2('');
        setSplitReference1('');
        setSplitReference2('');

        // Update legacy variables for backward compatibility
        setSplitCashAmount('');
        setSplitCardAmount('');
        setSplitCardReference('');
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

  // Ensure custom images have IDs and proper URL handling
  const ensureCustomImagesHaveIds = (images: CustomImage[] = []): CustomImage[] => {
    return images.map(image => {
      // Generate ID if missing
      const withId = !image.id ? { ...image, id: nanoid() } : image;

      // Handle Firebase Storage URLs
      if (withId.url && withId.url.includes('firebasestorage.googleapis.com')) {
        console.log('Processing Firebase Storage URL:', withId.url);
        // Use our proxy API for Firebase Storage URLs
        return {
          ...withId,
          url: `/api/proxy/image?url=${encodeURIComponent(withId.url)}`,
          originalUrl: withId.url // Keep the original URL for reference
        };
      }

      // Handle blob URLs - they need special treatment
      if (withId.url && withId.url.startsWith('blob:')) {
        console.log('Found blob URL, replacing with placeholder:', withId.url);
        return { ...withId, url: '/placeholder.jpg', isBlobUrl: true };
      }

      return withId;
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
                                  <DatePicker
                                    date={deliveryDetailsState.date ? new Date(deliveryDetailsState.date) : undefined}
                                    onSelect={handleDeliveryDateSelect}
                                    placeholder="Select Delivery Date *"
                                    fromDate={new Date()}
                                    // No maximum date restriction
                                  />

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
                            <DatePicker
                              date={pickupDetailsState.date ? new Date(pickupDetailsState.date) : undefined}
                              onSelect={handlePickupDateSelect}
                              placeholder="Select Pickup Date *"
                              fromDate={new Date()}
                              // No maximum date restriction
                            />

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
                                         price: Number(v.price) || 0,
                                         customText: v.customText || ''
                                       };
                                    }
                                    return {
                                       id: '',
                                       type: '',
                                       value: '',
                                       price: 0,
                                       customText: ''
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
                                              <span>{type}: {value}{variation.customText ? ` (${variation.customText})` : ''}</span>
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
                                    AED {item.totalPrice.toFixed(2)}
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
                                      : ` (AED ${appliedCoupon.value.toFixed(2)} off)`
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

                            {/* VAT calculation using the formula: total / 1.05 = amount before VAT, then VAT = total - amountBeforeVAT */}
                            <div className="flex justify-between items-center font-medium">
                              <p className="text-xl">Includes VAT (5%)</p>
                              <p className="text-xl">
                                {(() => {
                                  // Calculate the discounted subtotal
                                  const discountedTotal = appliedCoupon ? cartTotal - appliedCoupon.discount : cartTotal;
                                  // Calculate amount before VAT and VAT amount using improved rounding
                                  const amountBeforeVAT = Math.round((discountedTotal / 1.05) * 100) / 100;
                                  const vatAmount = Math.round((discountedTotal - amountBeforeVAT) * 100) / 100;
                                  return `AED ${vatAmount.toFixed(2)}`;
                                })()}
                              </p>
                            </div>

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

                              {/* Pay Later Row */}
                              <div className="flex mt-3">
                                <button
                                  type="button"
                                  onClick={() => handlePaymentMethodSelect(POSPaymentMethod.PAY_LATER)}
                                  className={`flex-1 py-3 px-2 text-base font-medium rounded-xl border-2 transition-all ${
                                    currentPaymentMethodState === POSPaymentMethod.PAY_LATER
                                      ? "bg-black text-white"
                                      : "bg-gray-100 text-gray-700"
                                  }`}
                                >
                                  Pay Later
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
                                  {/* First Payment (Method and Amount in one row) */}
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">First Payment</label>
                                    <div className="grid grid-cols-2 gap-4">
                                      <select
                                        value={splitMethod1}
                                        onChange={(e) => setSplitMethod1(e.target.value as POSPaymentMethod)}
                                        className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                      >
                                        <option value={POSPaymentMethod.CASH}>Cash</option>
                                        <option value={POSPaymentMethod.CARD}>Card</option>
                                        <option value={POSPaymentMethod.BANK_TRANSFER}>Bank Transfer</option>
                                        <option value={POSPaymentMethod.PBL}>Pay by Link</option>
                                        <option value={POSPaymentMethod.TALABAT}>Talabat</option>
                                        <option value={POSPaymentMethod.COD}>Cash on Delivery</option>
                                      </select>
                                      <input
                                        type="number"
                                        value={splitAmount1}
                                        onChange={(e) => {
                                          setSplitAmount1(e.target.value);
                                          // Update legacy variables for backward compatibility
                                          if (splitMethod1 === POSPaymentMethod.CASH) {
                                            setSplitCashAmount(e.target.value);
                                          } else if (splitMethod1 === POSPaymentMethod.CARD) {
                                            setSplitCardAmount(e.target.value);
                                          }
                                        }}
                                        className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                        placeholder="Amount"
                                      />
                                    </div>
                                  </div>

                                  {/* First Payment Reference (if needed) */}
                                  {(splitMethod1 === POSPaymentMethod.CARD ||
                                    splitMethod1 === POSPaymentMethod.BANK_TRANSFER ||
                                    splitMethod1 === POSPaymentMethod.PBL ||
                                    splitMethod1 === POSPaymentMethod.TALABAT) && (
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">Reference</label>
                                      <input
                                        type="text"
                                        value={splitReference1}
                                        onChange={(e) => {
                                          setSplitReference1(e.target.value);
                                          // Update legacy variable for backward compatibility
                                          if (splitMethod1 === POSPaymentMethod.CARD) {
                                            setSplitCardReference(e.target.value);
                                          }
                                        }}
                                        className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                        placeholder="Enter payment reference"
                                      />
                                    </div>
                                  )}

                                  <div className="border-t pt-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Second Payment</label>
                                    <div className="grid grid-cols-2 gap-4">
                                      <select
                                        value={splitMethod2}
                                        onChange={(e) => setSplitMethod2(e.target.value as POSPaymentMethod)}
                                        className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                      >
                                        {/* Filter out the first payment method from options */}
                                        {Object.values(POSPaymentMethod)
                                          .filter(method =>
                                            method !== splitMethod1 &&
                                            method !== POSPaymentMethod.PARTIAL &&
                                            method !== POSPaymentMethod.SPLIT
                                          )
                                          .map(method => (
                                            <option key={method} value={method}>
                                              {method === POSPaymentMethod.CASH && 'Cash'}
                                              {method === POSPaymentMethod.CARD && 'Card'}
                                              {method === POSPaymentMethod.BANK_TRANSFER && 'Bank Transfer'}
                                              {method === POSPaymentMethod.PBL && 'Pay by Link'}
                                              {method === POSPaymentMethod.TALABAT && 'Talabat'}
                                              {method === POSPaymentMethod.COD && 'Cash on Delivery'}
                                            </option>
                                          ))
                                        }
                                      </select>
                                      <input
                                        type="number"
                                        value={splitAmount2}
                                        onChange={(e) => {
                                          setSplitAmount2(e.target.value);
                                          // Update legacy variables for backward compatibility
                                          if (splitMethod2 === POSPaymentMethod.CASH) {
                                            setSplitCashAmount(e.target.value);
                                          } else if (splitMethod2 === POSPaymentMethod.CARD) {
                                            setSplitCardAmount(e.target.value);
                                          }
                                        }}
                                        className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                        placeholder="Amount"
                                      />
                                    </div>
                                  </div>

                                  {/* Second Payment Reference (if needed) */}
                                  {(splitMethod2 === POSPaymentMethod.CARD ||
                                    splitMethod2 === POSPaymentMethod.BANK_TRANSFER ||
                                    splitMethod2 === POSPaymentMethod.PBL ||
                                    splitMethod2 === POSPaymentMethod.TALABAT) && (
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">Reference</label>
                                      <input
                                        type="text"
                                        value={splitReference2}
                                        onChange={(e) => {
                                          setSplitReference2(e.target.value);
                                          // Update legacy variable for backward compatibility
                                          if (splitMethod2 === POSPaymentMethod.CARD) {
                                            setSplitCardReference(e.target.value);
                                          }
                                        }}
                                        className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                        placeholder="Enter payment reference"
                                      />
                                    </div>
                                  )}

                                  {/* Payment Summary */}
                                  <div className="bg-gray-50 p-4 rounded-xl">
                                    <div className="text-sm font-medium text-gray-900">
                                      Total: AED {calculateFinalTotal().toFixed(2)}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      First Payment: AED {(parseFloat(splitAmount1) || 0).toFixed(2)} ({splitMethod1})
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      Second Payment: AED {(parseFloat(splitAmount2) || 0).toFixed(2)} ({splitMethod2})
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      Remaining: AED {(calculateFinalTotal() - (parseFloat(splitAmount1) || 0) - (parseFloat(splitAmount2) || 0)).toFixed(2)}
                                    </div>
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
                                    {/* First row of payment methods */}
                                    <div className="grid grid-cols-3 gap-3 mb-3">
                                      <button
                                        type="button"
                                        onClick={() => setPartialPaymentMethod(POSPaymentMethod.CASH)}
                                        className={`p-3 text-base font-medium rounded-xl border-2 transition-all ${
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
                                        className={`p-3 text-base font-medium rounded-xl border-2 transition-all ${
                                          partialPaymentMethod === POSPaymentMethod.CARD
                                            ? "bg-black text-white"
                                            : "bg-gray-100 text-gray-700"
                                        }`}
                                      >
                                        Card
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setPartialPaymentMethod(POSPaymentMethod.BANK_TRANSFER)}
                                        className={`p-3 text-base font-medium rounded-xl border-2 transition-all ${
                                          partialPaymentMethod === POSPaymentMethod.BANK_TRANSFER
                                            ? "bg-black text-white"
                                            : "bg-gray-100 text-gray-700"
                                        }`}
                                      >
                                        Bank Transfer
                                      </button>
                                    </div>
                                    {/* Second row of payment methods */}
                                    <div className="grid grid-cols-3 gap-3">
                                      <button
                                        type="button"
                                        onClick={() => setPartialPaymentMethod(POSPaymentMethod.PBL)}
                                        className={`p-3 text-base font-medium rounded-xl border-2 transition-all ${
                                          partialPaymentMethod === POSPaymentMethod.PBL
                                            ? "bg-black text-white"
                                            : "bg-gray-100 text-gray-700"
                                        }`}
                                      >
                                        Pay by Link
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setPartialPaymentMethod(POSPaymentMethod.TALABAT)}
                                        className={`p-3 text-base font-medium rounded-xl border-2 transition-all ${
                                          partialPaymentMethod === POSPaymentMethod.TALABAT
                                            ? "bg-black text-white"
                                            : "bg-gray-100 text-gray-700"
                                        }`}
                                      >
                                        Talabat
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setPartialPaymentMethod(POSPaymentMethod.COD)}
                                        className={`p-3 text-base font-medium rounded-xl border-2 transition-all ${
                                          partialPaymentMethod === POSPaymentMethod.COD
                                            ? "bg-black text-white"
                                            : "bg-gray-100 text-gray-700"
                                        }`}
                                      >
                                        COD
                                      </button>
                                    </div>
                                  </div>
                                  {(partialPaymentMethod === POSPaymentMethod.CARD ||
                                    partialPaymentMethod === POSPaymentMethod.BANK_TRANSFER ||
                                    partialPaymentMethod === POSPaymentMethod.PBL ||
                                    partialPaymentMethod === POSPaymentMethod.TALABAT) && (
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">Payment Reference</label>
                                      <input
                                        type="text"
                                        value={currentPaymentReferenceState}
                                        onChange={(e) => setCurrentPaymentReferenceState(e.target.value)}
                                        className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                        placeholder="Enter payment reference"
                                      />
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl">
                                    <div className="space-y-1">
                                      <div className="text-sm font-medium text-gray-900">
                                        Total: AED {calculateFinalTotal().toFixed(2)}
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        Paying Now: AED {(parseFloat(currentPaymentAmountState) || 0).toFixed(2)}
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        Remaining: AED {(calculateFinalTotal() - (parseFloat(currentPaymentAmountState) || 0)).toFixed(2)}
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
                                <div className="flex flex-col items-center justify-center">
                                  <span>{isSubmitting ? "Processing..." : "Complete Order"}</span>
                                  <span className="text-sm mt-1">
                                    {currentPaymentMethodState === POSPaymentMethod.PARTIAL && currentPaymentAmountState
                                      ? `Pay Now: AED ${Number(currentPaymentAmountState).toFixed(2)}`
                                      : `AED ${calculateFinalTotal().toFixed(2)}`
                                    }
                                  </span>
                                </div>
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
