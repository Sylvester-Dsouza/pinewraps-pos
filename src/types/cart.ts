/**
 * Defines the structure of a custom image in the POS system
 */
export interface CustomImage {
  id?: string;
  file?: File;
  url?: string;
  previewUrl?: string;
  comment?: string;
  createdAt?: string;
}

/**
 * Defines the structure of a cart item in the POS system
 */
export interface CartItem {
  id: string;
  product: {
    id: string;
    name: string;
    basePrice: number;
    status?: string;
    images?: any[];
    allowCustomPrice?: boolean;
    requiresDesign?: boolean;
    requiresKitchen?: boolean;
    allowCustomImages?: boolean;
    categoryId?: string;
    description?: string;
    sku?: string;
    barcode?: string;
    variations?: any[];
  };
  quantity: number;
  selectedVariations: Array<{
    id: string;
    type: string;
    value: string;
    priceAdjustment: number;
  }>;
  totalPrice: number;
  notes?: string;
  customImages?: CustomImage[];
  metadata?: {
    paymentMethod?: string;
    paymentReference?: string;
    requiresKitchen?: boolean;
    requiresDesign?: boolean;
    [key: string]: any;
  };
}

/**
 * Defines the structure of the checkout details
 */
export interface CheckoutDetails {
  customerDetails: {
    name: string;
    email: string;
    phone: string;
  };
  deliveryMethod: 'PICKUP' | 'DELIVERY';
  deliveryDetails: {
    date: string;
    timeSlot: string;
    instructions: string;
    streetAddress: string;
    apartment: string;
    emirate: string;
    city: string;
    charge: number;
  };
  pickupDetails: {
    date: string;
    timeSlot: string;
  };
  giftDetails: {
    isGift: boolean;
    recipientName: string;
    recipientPhone: string;
    message: string;
    note: string;
    cashAmount: number;
    includeCash: boolean;
  };
  paymentMethod: 'CASH' | 'CARD';
  paymentReference: string;
  orderSummary?: {
    products: Array<{
      productName: string;
      quantity: number;
      price: number;
    }>;
    totalAmount: number;
  };
}
