export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  variations?: Record<string, any>;
  selectedVariations?: Array<{
    type: string;
    value: string;
    price?: number;
  }>;
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
  PARTIAL = 'PARTIAL'
}

export enum POSPaymentStatus {
  FULLY_PAID = 'FULLY_PAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID'
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
  PENDING_PAYMENT = 'PENDING_PAYMENT'
}

export enum DeliveryMethod {
  DELIVERY = 'DELIVERY',
  PICKUP = 'PICKUP'
}

export interface OrderPayment {
  id?: string;
  amount: number;
  method: POSPaymentMethod;
  reference?: string | null;
  status?: POSPaymentStatus;
  metadata?: {
    source: 'POS';
    futurePaymentMethod?: POSPaymentMethod;
    cashAmount?: string;
    changeAmount?: string;
  };
}

export interface POSOrderItemData {
  id?: string;
  productId: string;
  productName: string;
  unitPrice: number;
  totalPrice: number;
  quantity: number;
  variations?: Record<string, any>;
  selectedVariations?: Array<{
    type: string;
    value: string;
    price?: number;
  }>;
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

export interface POSOrderData {
  // Order metadata
  id?: string;
  orderNumber?: string;
  status?: POSOrderStatus;

  // Items and Payments
  items: POSOrderItemData[];
  payments: OrderPayment[];
  totalAmount: number;
  subtotal?: number;

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
  giftCashAmount?: string;

  // Payment details
  paymentMethod: POSPaymentMethod;
  paymentReference?: string;
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
  giftCashAmount?: string;

  // General notes
  notes?: string;
}
