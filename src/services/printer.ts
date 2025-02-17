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
      throw new Error('Failed to open print window');
    }

    printWindow.document.write(`
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

    // Wait for content to load then print
    await new Promise((resolve) => setTimeout(resolve, 250));

    try {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    } catch (error) {
      console.error('Print operation failed:', error);
      throw error;
    }
  } catch (error) {
    console.error('Printing failed:', error);
    throw error;
  }
};

// Error handling wrapper
export const withErrorHandling = async <T>(
  operation: () => Promise<T>,
  errorMessage: string
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    console.error(errorMessage, error);
    throw new Error(errorMessage);
  }
};

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  modifiers?: string[];
}

interface Order {
  orderNumber: string;
  timestamp: Date;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  table?: string;
  customerName?: string;
}

class ReceiptPrinter {
  private config: typeof PRINTER_CONFIG;

  constructor() {
    this.config = PRINTER_CONFIG;
  }

  public async printReceipt(order: Order): Promise<void> {
    const lines: string[] = [];
    const divider = '-'.repeat(this.config.characterWidth);

    // Header
    lines.push(centerText('PINEWRAPS'));
    lines.push(centerText('Modern Mediterranean Cuisine'));
    lines.push(centerText('Tel: +971 123456789'));
    lines.push(centerText('Dubai, UAE'));
    lines.push(divider);

    // Order info
    lines.push(`Order: #${order.orderNumber}`);
    lines.push(`Date: ${order.timestamp.toLocaleString()}`);
    if (order.table) lines.push(`Table: ${order.table}`);
    if (order.customerName) lines.push(`Customer: ${order.customerName}`);
    lines.push(divider);

    // Items
    lines.push('ITEMS');
    order.items.forEach(item => {
      lines.push(formatLineItem(
        `${item.quantity}x ${item.name}`,
        formatCurrency(item.price * item.quantity)
      ));
      if (item.modifiers?.length) {
        item.modifiers.forEach(mod => {
          lines.push(`  - ${mod}`);
        });
      }
    });
    lines.push(divider);

    // Totals
    lines.push(formatLineItem('Subtotal:', formatCurrency(order.subtotal)));
    if (order.tax) {
      lines.push(formatLineItem('Tax:', formatCurrency(order.tax)));
    }
    lines.push(formatLineItem('Total:', formatCurrency(order.total)));
    lines.push(divider);

    // Footer
    lines.push(centerText('Thank you for dining with us!'));
    lines.push(centerText('Please visit us again'));
    lines.push(centerText('www.pinewraps.com'));

    await printContent(lines.join('\n'), 'Receipt');
  }
}

export const printer = new ReceiptPrinter();
