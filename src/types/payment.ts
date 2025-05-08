/**
 * Payment Domain Types
 * Contains all payment-related interfaces and types
 */
import { POSPaymentMethod, POSPaymentStatus } from './order';

/**
 * Payment interface for handling all payment types
 */
export interface Payment {
  id: string;
  amount: number;
  method: POSPaymentMethod;
  reference: string | null;
  status: POSPaymentStatus;
  
  // Cash payment specific fields
  cashAmount?: number | string;
  changeAmount?: number | string;
  
  // Split payment specific fields
  isSplitPayment?: boolean;
  cashPortion?: number;
  cardPortion?: number;
  cardReference?: string;
  
  // Split payment fields
  splitFirstMethod?: POSPaymentMethod;
  splitSecondMethod?: POSPaymentMethod;
  splitFirstAmount?: number;
  splitSecondAmount?: number;
  splitFirstReference?: string | null;
  splitSecondReference?: string | null;
  
  // Partial payment specific fields
  isPartialPayment?: boolean;
  remainingAmount?: number;
  futurePaymentMethod?: POSPaymentMethod;
}

/**
 * Cash payment interface
 */
export interface CashPayment extends Payment {
  method: POSPaymentMethod.CASH;
  cashAmount: number | string;
  changeAmount: number | string;
}

/**
 * Card payment interface
 */
export interface CardPayment extends Payment {
  method: POSPaymentMethod.CARD;
  reference: string;
}

/**
 * Split payment interface
 */
export interface SplitPayment extends Payment {
  method: POSPaymentMethod.SPLIT;
  isSplitPayment: true;
  splitFirstMethod: POSPaymentMethod;
  splitFirstAmount: number;
  splitFirstReference: string | null;
  splitSecondMethod: POSPaymentMethod;
  splitSecondAmount: number;
  splitSecondReference: string | null;
}

/**
 * Partial payment interface
 */
export interface PartialPayment extends Payment {
  isPartialPayment: true;
  remainingAmount: number;
  futurePaymentMethod: POSPaymentMethod;
}

/**
 * Payment validation result
 */
export interface PaymentValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Payment processing result
 */
export interface PaymentProcessingResult {
  success: boolean;
  transactionId?: string;
  message?: string;
  receipt?: string;
  error?: string;
}
