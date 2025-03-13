import { POSPaymentMethod } from '@/types/order';
import { drawerService } from '@/services/drawer.service';

/**
 * Interface representing a payment for cash drawer operations
 */
interface Payment {
  id?: string;
  amount: number;
  method: POSPaymentMethod;
  reference?: string | null;
  status?: string;
  isPartialPayment?: boolean;
  isSplitPayment?: boolean;
  cashPortion?: number;
  cardPortion?: number;
  remainingAmount?: number;
  futurePaymentMethod?: POSPaymentMethod;
  cashAmount?: number;
  changeAmount?: number;
}

/**
 * Handles cash drawer operations for an order
 * @param payments Array of payments for the order
 * @param orderNumber Optional order number for reference
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function handleCashDrawerForOrder(
  payments: Payment[],
  orderNumber?: string
): Promise<boolean> {
  try {
    // Check if any payment involves cash
    const hasCashPayment = payments.some(payment => 
      payment.method === POSPaymentMethod.CASH || 
      (payment.isSplitPayment && payment.cashPortion && payment.cashPortion > 0)
    );
    
    if (!hasCashPayment) {
      console.log('No cash payments found, skipping cash drawer operations');
      return true;
    }
    
    // Calculate total cash amount from all payments
    let totalCashAmount = 0;
    
    for (const payment of payments) {
      if (payment.method === POSPaymentMethod.CASH) {
        totalCashAmount += payment.amount;
      } else if (payment.isSplitPayment && payment.cashPortion) {
        totalCashAmount += payment.cashPortion;
      }
    }
    
    console.log('Opening cash drawer for payment with total cash amount:', totalCashAmount);
    
    // Open the drawer for the cash transaction
    const drawerResult = await drawerService.openDrawer();
    console.log('Cash drawer open result:', drawerResult);
    
    // Record the cash sale in the drawer session
    if (totalCashAmount > 0) {
      await drawerService.recordCashSale(
        totalCashAmount, 
        `Cash payment for order ${orderNumber || 'unknown'}`,
        orderNumber
      );
      console.log('Cash sale recorded in drawer session');
    }
    
    return true;
  } catch (error) {
    console.error('Error handling cash drawer operations:', error);
    // Don't block order completion if drawer fails to open
    return false;
  }
}
