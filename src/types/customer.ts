/**
 * Customer Domain Types
 * Contains all customer-related interfaces and types
 */

/**
 * Customer address interface
 */
export interface CustomerAddress {
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

/**
 * Customer reward interface
 */
export interface CustomerReward {
  points: number;
  tier?: string;
  expiryDate?: string;
}

/**
 * Customer interface
 */
export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addresses: CustomerAddress[];
  reward: CustomerReward;
}

/**
 * Customer details for checkout
 */
export interface CustomerDetails {
  name: string;
  email: string;
  phone: string;
}

/**
 * Gift details interface
 */
export interface GiftDetails {
  isGift: boolean;
  recipientName: string;
  recipientPhone: string;
  message: string;
  note: string;
  cashAmount: string;
  includeCash: boolean;
}

/**
 * Delivery details interface
 */
export interface DeliveryDetails {
  date: string;
  timeSlot: string;
  instructions: string;
  streetAddress: string;
  apartment: string;
  emirate: string;
  city: string;
  charge: number;
}

/**
 * Pickup details interface
 */
export interface PickupDetails {
  date: string;
  timeSlot: string;
}

/**
 * Customer search result interface
 */
export interface CustomerSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  reward: {
    points: number;
  };
}

/**
 * Customer create/update request interface
 */
export interface CustomerCreateUpdateRequest {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
}

/**
 * Customer create/update response interface
 */
export interface CustomerCreateUpdateResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addresses: CustomerAddress[];
  reward: CustomerReward;
  credentials?: {
    username: string;
    password: string;
  };
}
