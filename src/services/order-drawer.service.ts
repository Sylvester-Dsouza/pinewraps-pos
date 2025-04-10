import { api } from '@/lib/axios';
import { drawerService } from './drawer.service';
import { POSPaymentMethod } from '@/types/order';
import { toast } from 'react-hot-toast';
import { Payment } from '@/types/payment';
import axios from 'axios';

// Use the same printer proxy URL as till-management.tsx
const PRINTER_PROXY_URL = process.env.NEXT_PUBLIC_PRINTER_PROXY_URL || 'http://localhost:3005';
console.log('PRINTER_PROXY_URL in order-drawer.service:', PRINTER_PROXY_URL);

// Function to get printer configuration directly from the printer proxy
async function getPrinterConfig() {
  try {
    // Fetch the printer configuration directly from the printer proxy
    // instead of going through the API on Render
    console.log('Fetching printer config from printer proxy:', `${PRINTER_PROXY_URL}/api/printer/config`);
    const response = await fetch(`${PRINTER_PROXY_URL}/api/printer/config`);
    const data = await response.json();
    
    if (data && data.success && data.printer) {
      console.log('Printer config from printer proxy:', data.printer);
      // Return with the parameter names that the printer proxy expects
      return { 
        ip: data.printer.ipAddress,
        port: data.printer.port,
        skipConnectivityCheck: true // Always skip connectivity check for operations
      };
    }
    
    // Try to get the printer from the database through the printer proxy
    console.log('Trying to get printer from database through printer proxy');
    try {
      const dbResponse = await fetch(`${PRINTER_PROXY_URL}/api/printer/db-config`);
      const dbData = await dbResponse.json();
      
      if (dbData && dbData.success && dbData.printer) {
        console.log('Printer config from printer proxy DB:', dbData.printer);
        return { 
          ip: dbData.printer.ipAddress,
          port: dbData.printer.port || 9100,
          skipConnectivityCheck: true 
        };
      }
    } catch (dbError) {
      console.error('Error fetching printer config from DB:', dbError);
    }
    
    // If no printer configuration is found, use default values
    console.warn('No printer configuration found, using default values');
    return { 
      ip: '192.168.1.14', // Default printer IP - using a more likely network address
      port: 9100,         // Default printer port
      skipConnectivityCheck: true 
    };
  } catch (error) {
    console.error('Error fetching printer config:', error);
    // If there's an error, use default values
    return { 
      ip: '192.168.1.14', // Default printer IP - using a more likely network address
      port: 9100,         // Default printer port
      skipConnectivityCheck: true 
    };
  }
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
   * Handles opening the cash drawer and printing receipt for an order
   * @param orderId The order ID
   * @param paymentMethod The payment method used
   * @returns Promise resolving to true if successful, false otherwise
   */
  private async printAndOpenDrawer(orderId: string, paymentMethod: POSPaymentMethod): Promise<boolean> {
    console.log(`Printing receipt and opening drawer for order ID: ${orderId}, payment method: ${paymentMethod}`);
    
    // Get the printer configuration
    const printerConfig = await getPrinterConfig();
    
    try {
      // First, fetch the complete order data to ensure we have all details
      console.log('Fetching complete order data for receipt printing...');
      let completeOrderData = null;
      
      try {
        const orderResponse = await api.get(`/api/pos/orders/${orderId}`);
        if (orderResponse.data && orderResponse.data.id) {
          completeOrderData = orderResponse.data;
          console.log('Successfully fetched complete order data:', completeOrderData);
        } else {
          console.warn('Order data response was empty or invalid');
        }
      } catch (orderError) {
        console.error('Error fetching order data:', orderError);
        // Continue with the print process even if we can't fetch the order data
      }
      
      // Choose the appropriate endpoint based on payment method
      let endpoint = '/print-order'; // Default for non-cash payments
      
      if (paymentMethod === POSPaymentMethod.CASH) {
        endpoint = '/cash-order'; // For cash payments, use cash-order endpoint
        console.log('Cash payment detected - using cash-order endpoint');
      } else {
        console.log('Non-cash payment detected - using print-order endpoint');
      }
      
      console.log(`Attempting to print receipt${paymentMethod === POSPaymentMethod.CASH ? ' and open drawer' : ''} using printer proxy`);
      
      // Prepare the request data with complete order information
      const requestData = {
        // Include printer configuration
        ip: printerConfig.ip,
        port: printerConfig.port,
        skipConnectivityCheck: true,
        // Include order metadata
        type: 'order',
        orderId,
        paymentMethod,
        // Always include the order object with customer details
        order: {
          ...completeOrderData,
          // Ensure customer details are explicitly included
          customerName: completeOrderData?.customerName || 'Walk-in Customer',
          customerEmail: completeOrderData?.customerEmail || '',
          customerPhone: completeOrderData?.customerPhone || '',
          // Ensure delivery details are included
          deliveryMethod: completeOrderData?.deliveryMethod || 'PICKUP',
          deliveryDate: completeOrderData?.deliveryDate || completeOrderData?.date || new Date().toISOString(),
          deliveryTimeSlot: completeOrderData?.deliveryTimeSlot || completeOrderData?.timeSlot || '',
          // Include order ID even if we couldn't fetch complete data
          id: orderId
        }
      };
      
      console.log(`Sending ${endpoint} request with data:`, JSON.stringify(requestData, null, 2));
      
      // Use fetch instead of axios for better reliability
      const fetchResponse = await fetch(`${PRINTER_PROXY_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      console.log(`Print-and-open response status:`, fetchResponse.status);
      const responseData = await fetchResponse.json();
      
      if (responseData.success) {
        console.log('Successfully printed receipt and opened drawer via printer proxy');
        return true;
      } else {
        console.warn('Printer proxy returned unsuccessful response:', responseData.error || 'Unknown error');
        toast.error('Could not open cash drawer or print receipt. Please check printer connection.');
        
        // If it's a cash payment, still try just opening the drawer as a fallback
        if (paymentMethod === POSPaymentMethod.CASH) {
          return this.tryOpenDrawerOnly(printerConfig);
        }
        
        return false;
      }
    } catch (error) {
      console.error('Error using printer proxy for order printing:', error.message || 'fetch failed');
      toast.error('Could not open cash drawer or print receipt. Please check printer connection.');
      
      // If it's a cash payment, still try just opening the drawer as a fallback
      if (paymentMethod === POSPaymentMethod.CASH) {
        return this.tryOpenDrawerOnly(printerConfig);
      }
      
      return false;
    }
  }
  
  /**
   * Fallback method to just try opening the drawer without printing
   * @param printerConfig The printer configuration
   * @returns Promise resolving to true if successful, false otherwise
   */
  private async tryOpenDrawerOnly(printerConfig: any): Promise<boolean> {
    try {
      console.log('Attempting to open drawer directly as last resort');
      
      const requestData = {
        ip: printerConfig.ip,
        port: printerConfig.port,
        skipConnectivityCheck: true
      };
      
      console.log('Sending open-drawer request with data:', JSON.stringify(requestData, null, 2));
      
      // Use fetch instead of axios for better reliability
      const fetchResponse = await fetch(`${PRINTER_PROXY_URL}/open-drawer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      console.log(`Open drawer response status:`, fetchResponse.status);
      const responseData = await fetchResponse.json();
      
      if (responseData.success) {
        console.log('Successfully opened drawer directly');
        return true;
      } else {
        console.warn('Open drawer request unsuccessful:', responseData.error || 'Unknown error');
        return false;
      }
    } catch (drawerError) {
      console.error('Error opening drawer directly:', drawerError.message || 'fetch failed');
      return false;
    }
  }

  /**
   * Get printer configuration
   * @returns Promise resolving to printer configuration or null if not found
   */
  private async getPrinterConfig(): Promise<any> {
    try {
      // We don't need to fetch the printer configuration anymore
      // The printer proxy will use its default printer
      console.log('Using printer proxy default printer configuration');
      return {
        skipConnectivityCheck: true
      };
    } catch (error) {
      console.error('Error getting printer configuration:', error);
      return null;
    }
  }

  /**
   * Handle cash drawer operations for an order
   * @param payments Array of payments for the order
   * @param orderNumber Optional order number for reference
   * @param orderId Optional order ID for fetching complete order data
   * @param orderData Optional complete order data
   * @returns Promise resolving to true if successful, false otherwise
   */
  public async handleOrderCashDrawer(payments: Payment[], orderNumber?: string, orderId?: string, orderData?: any): Promise<boolean> {
    try {
      console.log('Handling cash drawer operations for payments:', JSON.stringify(payments, null, 2));
      
      // Check if any payment involves cash with detailed logging
      const hasCashPayment = payments.some(payment => {
        const isCashMethod = payment.method === POSPaymentMethod.CASH;
        const hasCashPortion = payment.isSplitPayment && payment.cashPortion && payment.cashPortion > 0;
        
        console.log(`Payment ${payment.id || 'unknown'}:`, {
          method: payment.method,
          isCashMethod,
          isSplitPayment: payment.isSplitPayment,
          cashPortion: payment.cashPortion,
          hasCashPortion
        });
        
        return isCashMethod || hasCashPortion;
      });
      
      console.log('Has cash payment detected in OrderDrawerService:', hasCashPayment);
      
      if (hasCashPayment) {
        console.log('Cash payment detected - printing receipt and opening drawer using printer proxy');
        
        try {
          // Get printer configuration
          const printerConfig = await getPrinterConfig();
          
          // Use fetch instead of axios to match the till-management implementation
          // This endpoint should both open the drawer and print the receipt
          const requestData = {
            // Include printer configuration
            ip: printerConfig.ip,
            port: printerConfig.port,
            skipConnectivityCheck: true,
            // Include complete order data in the expected format
            orderData: {
              orderNumber: orderNumber || 'ORDER-DRAWER',
              id: orderId,
              orderId: orderId,
              payments: payments,
              // Always include customer details, with defaults if not provided
              items: orderData?.items || [],
              customerName: orderData?.customerName || 'Walk-in Customer',
              customerEmail: orderData?.customerEmail || '',
              customerPhone: orderData?.customerPhone || '',
              subtotal: orderData?.subtotal || 0,
              total: orderData?.total || 0,
              deliveryMethod: orderData?.deliveryMethod || 'PICKUP',
              deliveryDate: orderData?.deliveryDate || orderData?.date || new Date().toISOString(),
              deliveryTimeSlot: orderData?.deliveryTimeSlot || orderData?.timeSlot || '',
              isGift: orderData?.isGift || false,
              giftMessage: orderData?.giftMessage || '',
              giftRecipientName: orderData?.giftRecipientName || '',
              giftRecipientPhone: orderData?.giftRecipientPhone || ''
            }
          };
          
          console.log('Sending request to cash-order endpoint with data:', JSON.stringify(requestData, null, 2));
          
          const fetchResponse = await fetch(`${PRINTER_PROXY_URL}/cash-order`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
          });
          
          console.log(`Cash order response status:`, fetchResponse.status);
          const responseData = await fetchResponse.json();
          
          // Create a response object that matches the axios format for compatibility
          const response = {
            status: fetchResponse.status,
            data: responseData
          };
          
          console.log('Cash order response:', response.data);
          
          if (response.data.success) {
            toast.success('Cash drawer opened successfully');
            return true;
          } else {
            toast.error(`Failed to open cash drawer: ${response.data.error || 'Unknown error'}`);
            console.warn('Printer proxy error:', response.data.error);
            return false;
          }
        } catch (error) {
          console.error('Error opening cash drawer:', error);
          toast.error(`Error opening cash drawer: ${(error as Error).message}`);
          return false;
        }
      } else {
        console.log('No cash payment found - skipping cash drawer operations');
        // No cash payment, just return success
        return true;
      }
    } catch (error) {
      console.error('Error in handleOrderCashDrawer:', error);
      toast.error(`Error handling cash drawer: ${(error as Error).message}`);
      return false;
    }
  }
  
  /**
   * Handle card payment operations for an order (print only, no drawer opening)
   * @param payments Array of payments for the order
   * @param orderNumber Optional order number for reference
   * @param orderId Optional order ID for fetching complete order data
   * @param orderData Optional complete order data
   * @returns Promise resolving to true if successful, false otherwise
   */
  public async handleOrderCardPayment(payments: Payment[], orderNumber?: string, orderId?: string, orderData?: any): Promise<boolean> {
    try {
      console.log('Handling card payment operations for order:', orderNumber);
      
      try {
        // Get printer configuration
        const printerConfig = await getPrinterConfig();
        
        // Use fetch instead of axios to match the till-management implementation
        // This endpoint should only print the receipt without opening the drawer
        const requestData = {
          // Include printer configuration
          ip: printerConfig.ip,
          port: printerConfig.port,
          skipConnectivityCheck: true,
          // Include complete order data in the expected format
          orderData: {
            orderNumber: orderNumber || 'ORDER-CARD',
            id: orderId,
            orderId: orderId,
            payments: payments,
            // Always include customer details, with defaults if not provided
            items: orderData?.items || [],
            customerName: orderData?.customerName || 'Walk-in Customer',
            customerEmail: orderData?.customerEmail || '',
            customerPhone: orderData?.customerPhone || '',
            subtotal: orderData?.subtotal || 0,
            total: orderData?.total || 0,
            deliveryMethod: orderData?.deliveryMethod || 'PICKUP',
            deliveryDate: orderData?.deliveryDate || orderData?.date || new Date().toISOString(),
            deliveryTimeSlot: orderData?.deliveryTimeSlot || orderData?.timeSlot || '',
            isGift: orderData?.isGift || false,
            giftMessage: orderData?.giftMessage || '',
            giftRecipientName: orderData?.giftRecipientName || '',
            giftRecipientPhone: orderData?.giftRecipientPhone || ''
          }
        };
        
        console.log('Sending request to print-only endpoint with data:', JSON.stringify(requestData, null, 2));
        
        const fetchResponse = await fetch(`${PRINTER_PROXY_URL}/print-order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData)
        });
        
        console.log(`Print-order response status:`, fetchResponse.status);
        const responseData = await fetchResponse.json();
        
        // Create a response object that matches the axios format for compatibility
        const response = {
          status: fetchResponse.status,
          data: responseData
        };
        
        console.log('Card order print response:', response.data);
        
        if (response.data.success) {
          toast.success('Receipt printed successfully');
          return true;
        } else {
          toast.error(`Failed to print receipt: ${response.data.error || 'Unknown error'}`);
          console.warn('Printer proxy error:', response.data.error);
          return false;
        }
      } catch (error) {
        console.error('Error printing receipt for card payment:', error);
        toast.error(`Error printing receipt: ${(error as Error).message}`);
        return false;
      }
    } catch (error) {
      console.error('Error in handleOrderCardPayment:', error);
      toast.error(`Error handling card payment: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Record a cash sale in the current drawer session
   * @param amount Amount of the cash sale
   * @param orderNumber Optional order number for reference
   * @returns Promise resolving to the API response
   */
  public async recordCashSale(amount: number, orderNumber?: string): Promise<any> {
    try {
      console.log('Recording cash sale transaction:', { amount, orderNumber });
      
      // Call the API to record the cash sale
      try {
        const response = await api.post('/api/pos/drawer-session/operation/sale', {
          amount: amount.toString(),
          notes: `Cash payment received${orderNumber ? ` for order #${orderNumber}` : ''}`,
          orderNumber
        });
        
        console.log('Cash sale recording response:', response.data);
        
        if (response.data.success) {
          console.log(`Successfully recorded cash transaction of ${amount} in drawer session ${response.data.drawerSessionId}`);
          return true;
        } else {
          console.error('Failed to record cash sale:', response.data.error || 'Unknown error');
          return false;
        }
      } catch (error) {
        console.error('Error recording cash sale:', error.message || 'fetch failed');
        return false;
      }
    } catch (error) {
      console.error('Error recording cash sale:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
      }
      throw error;
    }
  }
}

export const orderDrawerService = OrderDrawerService.getInstance();