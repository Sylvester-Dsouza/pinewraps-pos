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
  cashAmount?: number | string;
  changeAmount?: number | string;
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
        // If cashAmount is provided, use it (converting to number if it's a string)
        if (payment.cashAmount !== undefined) {
          const cashAmount = typeof payment.cashAmount === 'string' 
            ? parseFloat(payment.cashAmount) 
            : payment.cashAmount;
          
          if (!isNaN(cashAmount)) {
            totalCashAmount += cashAmount;
          } else {
            totalCashAmount += payment.amount;
          }
        } else {
          totalCashAmount += payment.amount;
        }
      } else if (payment.isSplitPayment && payment.cashPortion) {
        totalCashAmount += payment.cashPortion;
      }
    }
    
    console.log('Opening cash drawer for payment with total cash amount:', totalCashAmount);
    
    try {
      // First, check if there's an active drawer session
      const currentSession = await drawerService.getCurrentSession();
      if (!currentSession || !currentSession.data || currentSession.data.status !== 'OPEN') {
        console.error('No active drawer session found. Cannot record cash sale.');
        return false;
      }
      
      // Open the drawer for the cash transaction
      const drawerResult = await drawerService.openDrawer();
      console.log('Cash drawer open result:', drawerResult);
      
      // Record the cash sale in the drawer session
      if (totalCashAmount > 0) {
        const saleResult = await drawerService.recordCashSale(
          totalCashAmount, 
          `Cash payment for order ${orderNumber || 'unknown'}`,
          orderNumber
        );
        
        console.log('Cash sale recorded in drawer session:', saleResult);
        
        if (!saleResult) {
          console.error('Failed to record cash sale in drawer session');
        }
      }
      
      return true;
    } catch (drawerError) {
      console.error('Error in drawer operations:', drawerError);
      return false;
    }
  } catch (error) {
    console.error('Error handling cash drawer operations:', error);
    // Don't block order completion if drawer fails to open
    return false;
  }
}
