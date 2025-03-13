import { Order, POSPaymentMethod, POSPaymentStatus } from '@/types/order';

/**
 * Helper function to get a user-friendly payment method display
 * @param order The order object
 * @returns A string representation of the payment method
 */
export const getPaymentMethodDisplay = (order: Order) => {
  // If there are payments, use them to determine the payment method
  if (order.payments && order.payments.length > 0) {
    // Check for multiple payment methods
    const methods = new Set(order.payments.map(p => p.method));
    
    // If there's a partial payment
    if (order.payments.some(p => p.status === POSPaymentStatus.PARTIALLY_PAID)) {
      return 'Partial Payment';
    }
    
    // If there's a split payment
    if (methods.has('SPLIT') || order.payments.some(p => p.method === 'SPLIT')) {
      return 'Split Payment';
    }
    
    // If there are multiple different payment methods
    if (methods.size > 1) {
      return 'Multiple Methods';
    }
    
    // Return the first payment method
    const method = order.payments[0].method;
    switch (method) {
      case 'CASH': return 'Cash';
      case 'CARD': return 'Card';
      default: return method;
    }
  }
  
  // Fallback to the order's payment method
  if (order.paymentMethod) {
    switch (order.paymentMethod) {
      case 'CASH': return 'Cash';
      case 'CARD': return 'Card';
      case 'SPLIT': return 'Split Payment';
      case 'PARTIAL': return 'Partial Payment';
      default: return order.paymentMethod;
    }
  }
  
  return 'Unknown';
};
