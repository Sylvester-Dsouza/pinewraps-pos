import { CustomImage } from './cart';
import { CustomerDetails, DeliveryDetails, PickupDetails, GiftDetails } from './customer';
import { Payment } from './payment';

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  variations?: {
    variationsObj?: Record<string, any>;
    selectedVariations?: ProductVariation[];
  };
  selectedVariations?: ProductVariation[];
  notes?: string;
  customImages?: Array<{
    url: string;
    comment?: string;
    previewUrl?: string;
    createdAt?: string;
    file?: File;
  }>;
  requiresKitchen?: boolean;
  requiresDesign?: boolean;
  sku?: string;
  categoryId?: string;
}

export enum POSPaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  SPLIT = 'SPLIT',
  PARTIAL = 'PARTIAL',
  BANK_TRANSFER = 'BANK_TRANSFER',
  PBL = 'PBL',
  TALABAT = 'TALABAT',
  COD = 'COD',
  PAY_LATER = 'PAY_LATER'
}

export enum POSPaymentStatus {
  FULLY_PAID = 'FULLY_PAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PENDING = 'PENDING'
}

export enum POSOrderStatus {
  PENDING = 'PENDING',
  DESIGN_QUEUE = 'DESIGN_QUEUE',
  DESIGN_PROCESSING = 'DESIGN_PROCESSING',
  DESIGN_READY = 'DESIGN_READY',
  KITCHEN_QUEUE = 'KITCHEN_QUEUE',
  KITCHEN_PROCESSING = 'KITCHEN_PROCESSING',
  KITCHEN_READY = 'KITCHEN_READY',
  FINAL_CHECK_QUEUE = 'FINAL_CHECK_QUEUE',
  FINAL_CHECK_PROCESSING = 'FINAL_CHECK_PROCESSING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  PENDING_PAYMENT = 'PENDING_PAYMENT'
}

export enum DeliveryMethod {
  DELIVERY = 'DELIVERY',
  PICKUP = 'PICKUP'
}

export interface ProductVariation {
  id?: string;
  type: string;
  value: string;
  price?: number;
  priceAdjustment?: number;
  customText?: string; // Custom text for addon options
}

export interface OrderPayment {
  id?: string;
  amount: number;
  method: POSPaymentMethod;
  reference?: string | null;
  status?: POSPaymentStatus;
  
  // Cash payment specific fields
  cashAmount?: number;
  changeAmount?: number;
  
  // Split payment specific fields
  isSplitPayment?: boolean;
  cashPortion?: number;
  cardPortion?: number;
  cardReference?: string;
  
  // Partial payment specific fields
  isPartialPayment?: boolean;
  remainingAmount?: number;
  futurePaymentMethod?: POSPaymentMethod;

  // Payment metadata
  metadata?: {
    source?: string;
    cashAmount?: string;
    [key: string]: any;
  };
}

export interface POSOrderItemData {
  id?: string;
  productId: string;
  productName: string;
  unitPrice: number;
  totalPrice: number;
  quantity: number;
  variations?: {
    variationsObj?: Record<string, any>;
    selectedVariations?: ProductVariation[];
  };
  selectedVariations?: ProductVariation[];
  notes?: string;
  customImages?: CustomImage[];
  requiresKitchen?: boolean;
  requiresDesign?: boolean;
  sku?: string;
  categoryId?: string;
}

export interface POSOrderData {
  // Order metadata
  id?: string;
  orderNumber?: string;
  status?: POSOrderStatus;
  name?: string;
  notes?: string;

  // Items and Payments
  items: POSOrderItemData[];
  payments: OrderPayment[];
  total: number;
  subtotal?: number;
  couponCode?: string;
  couponDiscount?: number;
  allowPartialPayment?: boolean; // Flag to indicate if this order allows partial payments
  actualTotal?: number; // The real total amount when using partial payments

  // Customer details
  customerName: string;
  customerEmail: string;
  customerPhone: string;

  // Processing flags based on order flow
  requiresKitchen?: boolean;
  requiresDesign?: boolean;
  requiresFinalCheck?: boolean;
  requiresSequentialProcessing?: boolean; // For Sets category that needs both Design and Kitchen

  // Team notes
  designNotes?: string;
  kitchenNotes?: string;
  finalCheckNotes?: string;

  // Delivery method
  deliveryMethod: DeliveryMethod;

  // Delivery details
  deliveryDate?: string;
  deliveryTimeSlot?: string;
  deliveryInstructions?: string;
  deliveryCharge?: number;
  streetAddress?: string;
  apartment?: string;
  emirate?: string;
  city?: string;

  // Pickup details
  pickupDate?: string;
  pickupTimeSlot?: string;
  storeLocation?: string;

  // Gift details
  isGift?: boolean;
  giftRecipientName?: string;
  giftRecipientPhone?: string;
  giftMessage?: string;
  giftCashAmount?: number;

  // Payment details
  paymentMethod?: POSPaymentMethod;
  paymentReference?: string;
  
  // Refund details
  partialRefundAmount?: number;
  
  // Order routing and processing metadata
  metadata?: {
    routing: {
      initialQueue: POSOrderStatus;
      status: POSOrderStatus;
      assignedTeam: 'KITCHEN' | 'DESIGN';
      processingFlow: POSOrderStatus[];
      currentStep: number;
    };
    qualityControl: {
      requiresFinalCheck: boolean;
      canReturnToKitchen: boolean;
      canReturnToDesign: boolean;
      finalCheckNotes: string;
    };
    coupon?: {
      code: string;
      type: string;
      value: number;
      discount: number;
    };
    discount?: number;
  };
}

/**
 * Defines the structure of the checkout details used in the checkout process
 */
export interface CheckoutDetails {
  customerDetails: CustomerDetails;
  deliveryMethod: DeliveryMethod;
  deliveryDetails?: DeliveryDetails;
  pickupDetails?: PickupDetails;
  giftDetails?: GiftDetails;
  payments: Payment[];
  paymentMethod: POSPaymentMethod;
  paymentReference: string;
  route?: 'KITCHEN' | 'DESIGN' | 'BOTH' | null;
  cartItems?: any[]; 
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
      variations: ProductVariation[];
    }[];
  };
}

export interface Order {
  // Order metadata
  id: string;
  orderNumber: string;
  status: POSOrderStatus;
  createdAt: string;
  updatedAt: string;

  // Customer Information
  customerName: string;
  customerPhone: string;
  customerEmail: string;

  // Order Items and Amounts
  items: OrderItem[];
  totalAmount: number;
  subtotal?: number;
  couponCode?: string;
  couponDiscount?: number;

  // Processing flags based on order flow
  requiresKitchen?: boolean;
  requiresDesign?: boolean;
  requiresFinalCheck?: boolean;
  requiresSequentialProcessing?: boolean; // For Sets category that needs both Design and Kitchen

  // Team notes
  designNotes?: string;
  kitchenNotes?: string;
  finalCheckNotes?: string;

  // Payment Information
  paymentMethod: POSPaymentMethod;
  paymentReference?: string;
  payments: OrderPayment[];
  paidAmount: number;
  changeAmount?: number;

  // Delivery Information
  deliveryMethod: DeliveryMethod;
  deliveryDate?: string;
  deliveryTimeSlot?: string;
  deliveryCharge?: number;
  deliveryInstructions?: string;

  // Address Information
  streetAddress?: string;
  apartment?: string;
  emirate?: string;
  city?: string;

  // Pickup Information
  pickupDate?: string;
  pickupTimeSlot?: string;
  storeLocation?: string;

  // Gift Information
  isGift?: boolean;
  giftRecipientName?: string;
  giftRecipientPhone?: string;
  giftMessage?: string;
  giftCashAmount?: number;

  // General notes
  notes?: string;
  
  // Refund details
  partialRefundAmount?: number;
}

/**
 * Parked Order interface - represents a temporary order saved for later completion
 */
export interface ParkedOrder {
  id: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
  
  // Customer Information
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  
  // Order Items and Amounts
  items: OrderItem[];
  totalAmount: number;
  
  // Delivery Information
  deliveryMethod?: DeliveryMethod;
  deliveryDate?: string;
  deliveryTimeSlot?: string;
  deliveryInstructions?: string;
  deliveryCharge?: number;
  
  // Address Information
  streetAddress?: string;
  apartment?: string;
  emirate?: string;
  city?: string;
  
  // Pickup Information
  pickupDate?: string;
  pickupTimeSlot?: string;
  
  // Gift Information
  isGift?: boolean;
  giftRecipientName?: string;
  giftRecipientPhone?: string;
  giftMessage?: string;
  giftCashAmount?: number;
  includeCash?: boolean;
  
  // General notes
  notes?: string;
  
  // Created by information
  createdBy?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    name?: string;
  };
}

/**
 * Parked Order Data interface - used for creating a parked order
 */
export interface ParkedOrderData {
  name?: string;
  
  // Customer Information
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  
  // Order Items
  items: Array<{
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    totalPrice: number;
    selectedVariations?: any;
    notes?: string;
    customImages?: any;
    requiresKitchen?: boolean;
    requiresDesign?: boolean;
    sku?: string;
    categoryId?: string;
  }>;
  
  // Order Amount
  totalAmount: number;
  
  // Delivery Information
  deliveryMethod?: DeliveryMethod;
  deliveryDate?: string;
  deliveryTimeSlot?: string;
  deliveryInstructions?: string;
  deliveryCharge?: number;
  
  // Address Information
  streetAddress?: string;
  apartment?: string;
  emirate?: string;
  city?: string;
  
  // Pickup Information
  pickupDate?: string;
  pickupTimeSlot?: string;
  
  // Gift Information
  isGift?: boolean;
  giftRecipientName?: string;
  giftRecipientPhone?: string;
  giftMessage?: string;
  giftCashAmount?: number;
  includeCash?: boolean;
  
  // General notes
  notes?: string;
}
