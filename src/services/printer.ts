interface PrinterConfig {
  type: 'thermal' | 'regular';
  width: number; // in mm
  characterWidth: number;
}

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
  private config: PrinterConfig;
  private defaultConfig: PrinterConfig = {
    type: 'thermal',
    width: 80,
    characterWidth: 48,
  };

  constructor(config?: Partial<PrinterConfig>) {
    this.config = { ...this.defaultConfig, ...config };
  }

  private centerText(text: string): string {
    const padding = Math.max(0, Math.floor((this.config.characterWidth - text.length) / 2));
    return ' '.repeat(padding) + text;
  }

  private formatCurrency(amount: number): string {
    return `$${amount.toFixed(2)}`;
  }

  private formatLineItem(description: string, amount: string): string {
    const space = this.config.characterWidth - description.length - amount.length;
    if (space < 1) return description + amount;
    return description + ' '.repeat(space) + amount;
  }

  private async sendToPrinter(content: string): Promise<void> {
    try {
      // Implementation will depend on the specific printer hardware and driver
      // This is a mock implementation
      if (window.navigator.printing) {
        // Use Web Printing API when available
        console.log('Sending to printer:', content);
      } else {
        // Fallback to showing print dialog
        const printWindow = window.open('', 'PRINT', 'height=600,width=800');
        if (printWindow) {
          printWindow.document.write(`
            <html>
              <head>
                <title>Receipt</title>
                <style>
                  body { font-family: monospace; white-space: pre; }
                </style>
              </head>
              <body>
                ${content}
              </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.focus();
          printWindow.print();
          printWindow.close();
        }
      }
    } catch (error) {
      console.error('Printing failed:', error);
      throw new Error('Failed to print receipt');
    }
  }

  public async printReceipt(order: Order): Promise<void> {
    const lines: string[] = [];
    const divider = '-'.repeat(this.config.characterWidth);

    // Header
    lines.push(this.centerText('PINEWRAPS'));
    lines.push(this.centerText('Modern Mediterranean Cuisine'));
    lines.push(divider);

    // Order info
    lines.push(`Order: ${order.orderNumber}`);
    lines.push(`Date: ${order.timestamp.toLocaleString()}`);
    if (order.table) lines.push(`Table: ${order.table}`);
    if (order.customerName) lines.push(`Customer: ${order.customerName}`);
    lines.push(divider);

    // Items
    order.items.forEach((item) => {
      const itemTotal = this.formatCurrency(item.price * item.quantity);
      lines.push(
        this.formatLineItem(
          `${item.quantity}x ${item.name}`,
          itemTotal
        )
      );
      
      if (item.modifiers?.length) {
        item.modifiers.forEach((modifier) => {
          lines.push(`  - ${modifier}`);
        });
      }
    });

    lines.push(divider);

    // Totals
    lines.push(this.formatLineItem('Subtotal:', this.formatCurrency(order.subtotal)));
    lines.push(this.formatLineItem('Tax:', this.formatCurrency(order.tax)));
    lines.push(this.formatLineItem('Total:', this.formatCurrency(order.total)));

    // Footer
    lines.push(divider);
    lines.push(this.centerText('Thank you for dining with us!'));
    lines.push(this.centerText('Please come again'));

    // Add some blank lines at the end for paper cutting
    lines.push('\n\n\n');

    const content = lines.join('\n');
    await this.sendToPrinter(content);
  }
}

export const printer = new ReceiptPrinter();
