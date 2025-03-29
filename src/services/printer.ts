import { format } from 'date-fns';

// Configuration for printer proxy
export const PRINTER_PROXY_CONFIG = {
  defaultUrl: 'http://localhost:3005', // Default URL for the printer proxy
  connectionTimeout: 5000, // 5 seconds timeout
};

// Printer configuration
export const PRINTER_CONFIG = {
  type: 'thermal' as const,
  width: 80, // mm
  characterWidth: 48,
  defaultFont: 'Courier New',
  fontSize: '12px',
  lineHeight: 1.2,
};

// Text formatting utilities
export const centerText = (text: string): string => {
  const padding = Math.max(0, Math.floor((PRINTER_CONFIG.characterWidth - text.length) / 2));
  return ' '.repeat(padding) + text;
};

export const formatLineItem = (description: string, amount: string): string => {
  const space = PRINTER_CONFIG.characterWidth - description.length - amount.length;
  if (space < 1) return description + amount;
  return description + ' '.repeat(space) + amount;
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED'
  }).format(amount);
};

export const generateReceiptLines = (order: Order): { text: string; alignment?: 'left' | 'center' | 'right'; bold?: boolean; size?: 'normal' | 'double' }[] => {
  const lines: { text: string; alignment?: 'left' | 'center' | 'right'; bold?: boolean; size?: 'normal' | 'double' }[] = [];

  // Header
  lines.push({ text: 'PINEWRAPS', alignment: 'center', bold: true, size: 'double' });
  lines.push({ text: 'Tax Invoice', alignment: 'center' });
  lines.push({ text: 'Dubai, UAE', alignment: 'center' });
  lines.push({ text: 'Phone: +971 544044864', alignment: 'center' });
  lines.push({ text: 'TRN: 100461426700003', alignment: 'center' });
  lines.push({ text: '-'.repeat(PRINTER_CONFIG.characterWidth), alignment: 'center' });

  // Order Info
  lines.push({ text: `Order #: ${order.orderNumber}`, bold: true });
  lines.push({ text: `Date: ${format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm')}` });
  lines.push({ text: `Customer: ${order.customerName || 'Walk-in Customer'}` });
  if (order.customerPhone) lines.push({ text: `Phone: ${order.customerPhone}` });
  if (order.customerEmail) lines.push({ text: `Email: ${order.customerEmail}` });
  lines.push({ text: `Status: ${order.status}` });

  // Delivery/Pickup Details
  lines.push({ text: '-'.repeat(PRINTER_CONFIG.characterWidth), alignment: 'center' });
  lines.push({ text: order.deliveryMethod === 'DELIVERY' ? 'Delivery Details' : 'Pickup Details', bold: true });
  
  if (order.deliveryMethod === 'DELIVERY') {
    if (order.deliveryDate) lines.push({ text: `Date: ${format(new Date(order.deliveryDate), 'dd/MM/yyyy')}` });
    if (order.deliveryTimeSlot) lines.push({ text: `Time: ${order.deliveryTimeSlot}` });
    if (order.streetAddress) lines.push({ text: `Address: ${order.streetAddress}` });
    if (order.apartment) lines.push({ text: `Apartment: ${order.apartment}` });
    if (order.city) lines.push({ text: `City: ${order.city}` });
    if (order.emirate) lines.push({ text: `Emirate: ${order.emirate}` });
    if (order.deliveryInstructions) lines.push({ text: `Instructions: ${order.deliveryInstructions}` });
  } else {
    if (order.pickupDate) lines.push({ text: `Date: ${format(new Date(order.pickupDate), 'dd/MM/yyyy')}` });
    if (order.pickupTimeSlot) lines.push({ text: `Time: ${order.pickupTimeSlot}` });
  }

  // Items
  lines.push({ text: '-'.repeat(PRINTER_CONFIG.characterWidth), alignment: 'center' });
  lines.push({ text: 'Item                  Qty    Price', bold: true });
  lines.push({ text: '-'.repeat(PRINTER_CONFIG.characterWidth), alignment: 'center' });

  order.items.forEach(item => {
    lines.push({ text: item.name });
    lines.push({ text: formatLineItem(`  x${item.quantity}`, formatCurrency(item.totalPrice)), alignment: 'right' });
    
    if (Array.isArray(item.variations)) {
      item.variations.forEach(variation => {
        const type = typeof variation === 'object' && variation !== null 
          ? (variation.type || variation.id || '').toString()
          : '';
        const value = typeof variation === 'object' && variation !== null 
          ? (variation.value || variation.id || '').toString()
          : '';
        
        if (type && value) {
          lines.push({ text: `  - ${type}: ${value}` });
        }
      });
    }
    
    if (item.notes) {
      lines.push({ text: `  Note: ${item.notes}` });
    }
  });

  // Totals
  lines.push({ text: '-'.repeat(PRINTER_CONFIG.characterWidth), alignment: 'center' });
  lines.push({ text: formatLineItem('Subtotal:', formatCurrency(order.subtotal || order.totalAmount)), alignment: 'right' });
  if (order.deliveryMethod === 'DELIVERY' && order.deliveryCharge) {
    lines.push({ text: formatLineItem('Delivery:', formatCurrency(order.deliveryCharge)), alignment: 'right' });
  }
  if (order.tax) {
    lines.push({ text: formatLineItem('Tax:', formatCurrency(order.tax)), alignment: 'right' });
  }
  if (order.discount) {
    lines.push({ text: formatLineItem('Discount:', formatCurrency(-order.discount)), alignment: 'right' });
  }
  lines.push({ text: formatLineItem('Total:', formatCurrency(order.totalAmount)), alignment: 'right', bold: true });

  // Payment Info
  lines.push({ text: '-'.repeat(PRINTER_CONFIG.characterWidth), alignment: 'center' });
  lines.push({ text: 'Payment Information:', bold: true });

  if (order.payments && order.payments.length > 0) {
    order.payments.forEach(payment => {
      lines.push({ text: formatLineItem(payment.method, formatCurrency(payment.amount)) });
      if (payment.status) lines.push({ text: `Status: ${payment.status}` });
      if (payment.reference) lines.push({ text: `Reference: ${payment.reference}` });
      if (payment.metadata?.cashAmount) lines.push({ text: formatLineItem('Cash Amount:', formatCurrency(payment.metadata.cashAmount)) });
      if (payment.metadata?.changeAmount) lines.push({ text: formatLineItem('Change:', formatCurrency(payment.metadata.changeAmount)) });
    });
  } else {
    lines.push({ text: `Payment Method: ${order.paymentMethod || 'Not specified'}` });
    lines.push({ text: formatLineItem('Amount Paid:', formatCurrency(order.paidAmount || 0)) });
    if (order.changeAmount) lines.push({ text: formatLineItem('Change:', formatCurrency(order.changeAmount)) });
  }

  // Gift Info
  if (order.isGift) {
    lines.push({ text: '-'.repeat(PRINTER_CONFIG.characterWidth), alignment: 'center' });
    lines.push({ text: 'Gift Information:', bold: true });
    if (order.giftRecipientName) lines.push({ text: `Recipient: ${order.giftRecipientName}` });
    if (order.giftRecipientPhone) lines.push({ text: `Recipient Phone: ${order.giftRecipientPhone}` });
    if (order.giftMessage) lines.push({ text: `Message: ${order.giftMessage}` });
    if (order.giftCashAmount) lines.push({ text: formatLineItem('Cash Amount:', formatCurrency(order.giftCashAmount)) });
  }

  // Notes
  if (order.notes || order.kitchenNotes || order.designNotes) {
    lines.push({ text: '-'.repeat(PRINTER_CONFIG.characterWidth), alignment: 'center' });
    if (order.notes) lines.push({ text: `Order Notes: ${order.notes}` });
    if (order.kitchenNotes) lines.push({ text: `Kitchen Notes: ${order.kitchenNotes}` });
    if (order.designNotes) lines.push({ text: `Design Notes: ${order.designNotes}` });
  }

  // Footer
  lines.push({ text: '-'.repeat(PRINTER_CONFIG.characterWidth), alignment: 'center' });
  lines.push({ text: 'Thank you for choosing Pinewraps!', alignment: 'center' });
  lines.push({ text: 'Visit us again soon', alignment: 'center' });
  lines.push({ text: 'www.pinewraps.com', alignment: 'center' });

  return lines;
};

// Function to detect and test connection to the printer proxy
export const detectPrinterProxy = async (): Promise<{ connected: boolean; url?: string; error?: string }> => {
  try {
    // Try to detect the printer proxy on localhost
    const url = PRINTER_PROXY_CONFIG.defaultUrl;
    console.log(`Attempting to connect to printer proxy at ${url}`);
    
    // Try the new endpoint first
    try {
      const response = await fetch(`${url}/api/printer/status`, { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(PRINTER_PROXY_CONFIG.connectionTimeout)
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Printer proxy status:', data);
        return { 
          connected: true, 
          url: url
        };
      }
    } catch (e) {
      console.log('New endpoint failed, trying fallback endpoint');
    }
    
    // Fallback to the old endpoint if the new one fails
    const fallbackResponse = await fetch(`${url}/status`, { 
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(PRINTER_PROXY_CONFIG.connectionTimeout)
    });
    
    if (fallbackResponse.ok) {
      const data = await fallbackResponse.json();
      console.log('Printer proxy status (fallback):', data);
      return { 
        connected: true, 
        url: url
      };
    } else {
      console.error('Failed to connect to printer proxy:', fallbackResponse.statusText);
      return { 
        connected: false, 
        error: `Failed to connect to printer proxy: ${fallbackResponse.statusText}`
      };
    }
  } catch (error: any) {
    console.error('Error detecting printer proxy:', error);
    return { 
      connected: false, 
      error: `Error connecting to printer proxy: ${error.message || 'Unknown error'}`
    };
  }
};

// Function to test connection to a specific printer through the proxy
export const testPrinterConnection = async (ip: string, port: number = 9100): Promise<{ connected: boolean; message: string }> => {
  try {
    // First check if we can connect to the proxy
    const proxyStatus = await detectPrinterProxy();
    if (!proxyStatus.connected) {
      return { 
        connected: false, 
        message: `Cannot connect to printer proxy: ${proxyStatus.error}` 
      };
    }
    
    // Now test connection to the specific printer
    const url = proxyStatus.url;
    console.log(`Testing printer connection at ${ip}:${port} via proxy ${url}`);
    
    // Use the new /api/printer/status endpoint with query parameters
    const response = await fetch(`${url}/api/printer/status?ip=${encodeURIComponent(ip)}&port=${port}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(PRINTER_PROXY_CONFIG.connectionTimeout)
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Printer connection test result:', data);
      
      if (data.success) {
        return { 
          connected: data.connected, 
          message: data.connected 
            ? `Successfully connected to printer at ${ip}:${port}` 
            : `Failed to connect to printer at ${ip}:${port}` 
        };
      } else {
        return { 
          connected: false, 
          message: data.message || `Failed to connect to printer at ${ip}:${port}` 
        };
      }
    } else {
      return { 
        connected: false, 
        message: `Error testing printer connection: ${response.statusText}` 
      };
    }
  } catch (error: any) {
    console.error('Error testing printer connection:', error);
    return { 
      connected: false, 
      message: `Error testing printer connection: ${error.message || 'Unknown error'}` 
    };
  }
};

// Base printer styles
export const getBasePrinterStyles = () => `
  @page {
    size: ${PRINTER_CONFIG.width}mm auto;
    margin: 0;
  }
  body {
    font-family: '${PRINTER_CONFIG.defaultFont}', monospace;
    margin: 0;
    padding: 10mm;
    color: black !important;
    background: white !important;
    font-size: ${PRINTER_CONFIG.fontSize};
    line-height: ${PRINTER_CONFIG.lineHeight};
    width: ${PRINTER_CONFIG.width}mm;
  }
  * {
    color: black !important;
    background: white !important;
    print-color-adjust: exact !important;
    -webkit-print-color-adjust: exact !important;
  }
  @media print {
    body {
      width: ${PRINTER_CONFIG.width}mm;
    }
    @page {
      size: ${PRINTER_CONFIG.width}mm auto;
      margin: 0;
    }
  }
`;

// Generic print function
export const printContent = async (
  content: string,
  title: string,
  additionalStyles: string = ''
): Promise<void> => {
  try {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      throw new Error('Could not open print window');
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            ${getBasePrinterStyles()}
            ${additionalStyles}
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 1000));

    printWindow.print();

    // Close window after printing
    setTimeout(() => {
      printWindow.close();
    }, 1000);
  } catch (error) {
    console.error('Error printing:', error);
    throw error;
  }
};

export const withErrorHandling = async (fn: () => Promise<any>) => {
  try {
    return await fn();
  } catch (error) {
    console.error('Printer error:', error);
    return false;
  }
};

interface OrderItem {
  name: string;
  quantity: number;
  totalPrice: number;
  variations?: any[];
  notes?: string;
}

interface Order {
  orderNumber: string;
  createdAt: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  status: string;
  deliveryMethod: 'DELIVERY' | 'PICKUP';
  deliveryDate?: string;
  deliveryTimeSlot?: string;
  streetAddress?: string;
  apartment?: string;
  city?: string;
  emirate?: string;
  deliveryInstructions?: string;
  pickupDate?: string;
  pickupTimeSlot?: string;
  items: OrderItem[];
  subtotal?: number;
  totalAmount: number;
  deliveryCharge?: number;
  tax?: number;
  discount?: number;
  payments?: any[];
  paymentMethod?: string;
  paidAmount?: number;
  changeAmount?: number;
  isGift?: boolean;
  giftRecipientName?: string;
  giftRecipientPhone?: string;
  giftMessage?: string;
  giftCashAmount?: number;
  notes?: string;
  kitchenNotes?: string;
  designNotes?: string;
}
