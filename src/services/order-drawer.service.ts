import { api } from '@/lib/axios';
import { drawerService } from './drawer.service';
import { POSPaymentMethod } from '@/types/pos';
import { toast } from '@/lib/toast-utils';

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
   * Print receipt and open drawer for an order
   * @param orderId The order ID
   * @param paymentMethod The payment method
   */
  private async printAndOpenDrawer(orderId: string, paymentMethod: POSPaymentMethod): Promise<boolean> {
    try {
      console.log('Printing receipt and opening drawer for order:', orderId);
      
      // For cash or split payments, use print-and-open to open drawer
      if (paymentMethod === POSPaymentMethod.CASH || paymentMethod === POSPaymentMethod.SPLIT) {
        const response = await api.post('/api/pos/printer/print-and-open', { 
          orderId,
          type: 'receipt'
        });
        
        if (response.data?.success) {
          console.log('Receipt printed and drawer opened successfully');
          return true;
        }
      } else {
        // For card payments, only print receipt
        const response = await api.post('/api/pos/printer/print-only', { 
          orderId,
          type: 'receipt'
        });
        
        if (response.data?.success) {
          console.log('Receipt printed successfully');
          return true;
        }
      }
      
      console.error('Failed to handle printer operation');
      toast.error('Failed to print receipt');
      return false;
    } catch (error) {
      console.error('Error in printer operation:', error);
      toast.error('Error printing receipt');
      return false;
    }
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
        // For card-only payments, just print receipt
        console.log('No cash payments found, printing receipt only');
        await this.printAndOpenDrawer(orderNumber || '', POSPaymentMethod.CARD);
        return true;
      }
      
      // Calculate total cash amount from all payments
      let totalCashAmount = 0;
      
      for (const payment of payments) {
        if (payment.method === POSPaymentMethod.CASH) {
          totalCashAmount += payment.amount;
          // Print and open drawer for cash payment
          await this.printAndOpenDrawer(orderNumber || '', POSPaymentMethod.CASH);
        } else if (payment.isSplitPayment && payment.cashPortion) {
          totalCashAmount += payment.cashPortion;
          // Print split payment receipt and open drawer
          await api.post('/api/pos/printer/print-and-open', {
            type: 'split_payment',
            data: {
              amount: payment.cashPortion
            }
          });
        }
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
