/**
 * Cart Domain Types
 * Contains all cart-related interfaces and types
 */

/**
 * Defines the structure of a custom image in the POS system
 */
export interface CustomImage {
  id: string;
  url: string;
  previewUrl?: string;
  type?: string;
  notes?: string;
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
 * Defines the structure of a product in the cart
 */
export interface CartProduct {
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
}

/**
 * Defines the structure of a cart item in the POS system
 */
export interface CartItem {
  id: string;
  product: CartProduct;
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
 * Defines the structure of a cart
 */
export interface Cart {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  metadata?: {
    createdAt?: string;
    updatedAt?: string;
    sessionId?: string;
    userId?: string;
    [key: string]: any;
  };
}

/**
 * Defines cart calculation functions
 */
export interface CartCalculations {
  calculateItemTotal: (item: CartItem) => number;
  calculateCartTotal: (items: CartItem[]) => number;
  calculateTax: (total: number, taxRate: number) => number;
  calculateDiscount: (total: number, discountRate: number) => number;
}
