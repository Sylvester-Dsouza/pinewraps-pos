import { type CustomImage } from '@/types/cart';
import { POSOrderItemData, POSOrderStatus, DeliveryMethod, OrderPayment } from '@/types/order';

// Re-export types from order
export type { POSOrderItemData, POSOrderStatus, CustomImage };

// POS-specific types that aren't used by the API
export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: Category;
  image?: string;
  variations?: Array<{
    id: string;
    name: string;
    price: number;
  }>;
  allowCustomText?: boolean;
  allowNotes?: boolean;
  allowCustomImages?: boolean;
  requiresKitchen?: boolean;
  requiresDesign?: boolean;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  selectedVariations: Array<{
    id: string;
    name: string;
    price: number;
  }>;
  customText?: string;
  notes?: string;
  customImages?: CustomImage[];
}

export interface Order {
  id: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: POSOrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface POSOrderData {
  id?: string;
  orderNumber?: string;
  status?: POSOrderStatus;
  items: POSOrderItemData[];
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
    cashAmount: number;
    includeCash: boolean;
  };
  payments: OrderPayment[];
  totalAmount: number;
  requiresKitchen?: boolean;
  requiresDesign?: boolean;
  requiresFinalCheck?: boolean;
  notes?: string;
}
