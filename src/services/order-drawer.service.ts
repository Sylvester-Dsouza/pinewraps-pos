import { api } from '@/lib/axios';
import { drawerService } from './drawer.service';
import { POSPaymentMethod } from '@/types/pos';

// Interface for payments
interface Payment {
  id: string;
  amount: number;
  method: POSPaymentMethod;
  reference?: string | null;
  status: string;
  isPartialPayment?: boolean;
  isSplitPayment?: boolean;
  cashPortion?: number;
  cardPortion?: number;
  remainingAmount?: number;
  futurePaymentMethod?: POSPaymentMethod;
  cashAmount?: number;
  changeAmount?: number;
}

export class OrderDrawerService {
  private static instance: OrderDrawerService;

  private constructor() {}

  public static getInstance(): OrderDrawerService {
    if (!OrderDrawerService.instance) {
      OrderDrawerService.instance = new OrderDrawerService();
    }
    return OrderDrawerService.instance;
  }

  /**
   * Handle cash drawer operations for an order
   * @param payments The payments for the order
   * @param orderNumber The order number
   */
  async handleOrderCashDrawer(payments: Payment[], orderNumber?: string): Promise<boolean> {
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
      
      if (!drawerResult.success) {
        console.error('Failed to open cash drawer:', drawerResult.error);
        // Continue even if drawer fails to open
      } else {
        console.log('Cash drawer opened successfully for cash payment');
      }
      
      // Record the cash sale in the drawer session
      if (totalCashAmount > 0) {
        await this.recordCashSale(totalCashAmount, orderNumber);
      }
      
      return true;
    } catch (error) {
      console.error('Error handling cash drawer operations:', error);
      // Don't block order completion if drawer fails to open
      return false;
    }
  }

  /**
   * Record a cash sale in the drawer session
   * @param amount The amount of the cash sale
   * @param orderNumber The order number
   */
  private async recordCashSale(amount: number, orderNumber?: string): Promise<any> {
    try {
      console.log('Recording cash sale transaction:', { amount, orderNumber });
      
      // Call the API to record the cash sale
      const response = await api.post('/api/pos/drawer-session/operation/sale', {
        amount,
        notes: `Cash payment received${orderNumber ? ` for order #${orderNumber}` : ''}`,
        orderNumber
      });
      
      console.log('Cash sale recorded in drawer session:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error recording cash sale:', error);
      if (error.response) {
        console.error('Response error data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      return null;
    }
  }
}

export const orderDrawerService = OrderDrawerService.getInstance();
