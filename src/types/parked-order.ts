/**
 * Types related to parked orders in the POS system
 */

import { DeliveryMethod, OrderItem } from './order';

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