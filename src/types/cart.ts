/**
 * Defines the structure of a custom image in the POS system
 */
export interface CustomImage {
  id: string;
  url: string;
  previewUrl?: string;
  comment?: string;
  createdAt?: string;
  file?: File; // Only used during upload, not stored in database
}

/**
 * Defines the structure of a selected variation in the POS system
 */
export interface SelectedVariation {
  id: string;
  type: string;
  value: string;
  priceAdjustment?: number; // Frontend uses priceAdjustment
  price?: number; // Backend uses price
}

/**
 * Defines the structure of a cart item in the POS system
 */
export interface CartItem {
  [x: string]: any;
  unitPrice: any;
  price: any;
  name: any;
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
    category?: any;
    description?: string;
    sku?: string;
    barcode?: string;
    variants?: any[];
    options?: any[];
    visibility?: string;
    stock?: number;
    trackInventory?: boolean;
  };
  quantity: number;
  selectedVariations: SelectedVariation[];
  totalPrice: number;
  notes?: string;
  customImages?: CustomImage[];
  metadata?: {
    paymentMethod?: string;
    paymentReference?: string;
    requiresKitchen?: boolean;
    requiresDesign?: boolean;
    allowCustomImages?: boolean;
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
    cashAmount: number;
    includeCash: boolean;
  };
  addressDetails?: {
    streetAddress: string;
    apartment: string;
    emirate: string;
    city: string;
  };
  paymentMethod: 'CASH' | 'CARD';
  paymentReference: string;
  orderSummary?: {
    totalItems?: number;
    products: Array<{
      id?: string;
      productId?: string;
      name: string;
      quantity: number;
      price: number;
      unitPrice?: number;
      sku?: string;
      barcode?: string;
      categoryId?: string;
      requiresKitchen?: boolean;
      requiresDesign?: boolean;
      hasVariations?: boolean;
      hasCustomImages?: boolean;
    }>;
    totalAmount: number;
  };
  cartItems?: any[];
}
