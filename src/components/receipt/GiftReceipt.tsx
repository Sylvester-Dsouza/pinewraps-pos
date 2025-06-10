import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Printer, X } from 'lucide-react';
import {
  PRINTER_CONFIG,
  centerText,
  formatLineItem,
  formatCurrency,
  previewContent,
  withErrorHandling
} from '@/services/printer';
import { Order, OrderItem } from '@/types/order';

// Receipt-specific styles
const receiptStyles = `
  .receipt {
    width: 100%;
    max-width: ${PRINTER_CONFIG.width}mm;
  }
  .header {
    text-align: center;
    margin-bottom: 10px;
  }
  .divider {
    border-top: 1px solid black;
    margin: 5px 0;
  }
  .item {
    margin: 5px 0;
  }
  .right {
    text-align: right;
  }
  .center {
    text-align: center;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th, td {
    text-align: left;
    padding: 2px;
  }
  .variation {
    padding-left: 10px;
    font-size: 10px;
  }
  .notes {
    font-style: italic;
    font-size: 10px;
  }
`;

export const generateGiftReceiptContent = (order: Order): string => `
  <div class="receipt">
    <div class="header">
      <h1 style="font-size: 16px; margin: 0;">${centerText('PINEWRAPS')}</h1>
      <p style="margin: 5px 0;">${centerText('Gift Receipt')}</p>
      <p style="margin: 5px 0;">${centerText('Dubai, UAE')}</p>
      <p style="margin: 5px 0;">${centerText('Phone: +971 544044864')}</p>
      <p style="margin: 5px 0; font-size: 10px;">${centerText('TRN: 100461426700003')}</p>
    </div>
    
    <div class="divider"></div>
    
    <div style="margin: 10px 0;">
      <p style="margin: 2px 0;">${formatLineItem('Order #:', order.orderNumber)}</p>
      <p style="margin: 2px 0;">${formatLineItem('Date:', format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm'))}</p>
      <p style="margin: 2px 0;">${formatLineItem('Status:', order.status)}</p>
      
      <div class="divider"></div>
      
      <div style="margin: 10px 0;">
        <p style="margin: 2px 0; font-weight: bold;">Gift Recipient:</p>
        ${order.giftRecipientName ? `<p style="margin: 2px 0;">${formatLineItem('Name:', order.giftRecipientName)}</p>` : ''}
        ${order.giftRecipientPhone ? `<p style="margin: 2px 0;">${formatLineItem('Phone:', order.giftRecipientPhone)}</p>` : ''}
        ${order.giftMessage ? `<p style="margin: 2px 0;">${formatLineItem('Message:', order.giftMessage)}</p>` : ''}
      </div>
      
      <div class="divider"></div>
      
      <div style="margin: 10px 0;">
        <p style="margin: 2px 0; font-weight: bold;">${order.deliveryMethod === 'DELIVERY' ? 'Delivery Details' : 'Pickup Details'}</p>
        ${order.deliveryMethod === 'DELIVERY' ? `
          ${order.deliveryDate ? `<p style="margin: 2px 0;">${formatLineItem('Date:', format(new Date(order.deliveryDate), 'dd/MM/yyyy'))}</p>` : ''}
          ${order.deliveryTimeSlot ? `<p style="margin: 2px 0;">${formatLineItem('Time:', order.deliveryTimeSlot)}</p>` : ''}
          ${order.streetAddress ? `<p style="margin: 2px 0;">${formatLineItem('Address:', order.streetAddress)}</p>` : ''}
          ${order.apartment ? `<p style="margin: 2px 0;">${formatLineItem('Apartment:', order.apartment)}</p>` : ''}
          ${order.city ? `<p style="margin: 2px 0;">${formatLineItem('City:', order.city)}</p>` : ''}
          ${order.emirate ? `<p style="margin: 2px 0;">${formatLineItem('Emirate:', order.emirate)}</p>` : ''}
          ${order.deliveryInstructions ? `<p style="margin: 2px 0;">${formatLineItem('Instructions:', order.deliveryInstructions)}</p>` : ''}
        ` : `
          ${order.pickupDate ? `<p style="margin: 2px 0;">${formatLineItem('Date:', format(new Date(order.pickupDate), 'dd/MM/yyyy'))}</p>` : ''}
          ${order.pickupTimeSlot ? `<p style="margin: 2px 0;">${formatLineItem('Time:', order.pickupTimeSlot)}</p>` : ''}
          ${order.storeLocation ? `<p style="margin: 2px 0;">${formatLineItem('Store:', order.storeLocation)}</p>` : ''}
        `}
      </div>
    </div>
    
    <div class="divider"></div>
    
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align: center;">Qty</th>
        </tr>
      </thead>
      <tbody>
        ${order.items.map((item) => `
          <tr>
            <td>${item.productName}</td>
            <td style="text-align: center;">${item.quantity}</td>
          </tr>
          ${item.notes ? `
            <tr>
              <td colspan="2" class="notes">Note: ${item.notes}</td>
            </tr>
          ` : ''}
        `).join('')}
      </tbody>
    </table>
    
    <div class="divider"></div>
    
    ${order.isGift ? `
      <div style="margin: 10px 0;">
        <p style="margin: 2px 0; font-weight: bold;">Gift Information:</p>
        ${order.giftRecipientName ? `<p style="margin: 2px 0;">${formatLineItem('Recipient:', order.giftRecipientName)}</p>` : ''}
        ${order.giftRecipientPhone ? `<p style="margin: 2px 0;">${formatLineItem('Recipient Phone:', order.giftRecipientPhone)}</p>` : ''}
        ${order.giftMessage ? `<p style="margin: 2px 0;">${formatLineItem('Message:', order.giftMessage)}</p>` : ''}
      </div>
      
      <div class="divider"></div>
    ` : ''}
    
    ${order.notes || order.kitchenNotes || order.designNotes ? `
      <div style="margin: 10px 0;" class="notes">
        ${order.notes ? `<p style="margin: 2px 0;"><strong>Order Notes:</strong> ${order.notes}</p>` : ''}
        ${order.kitchenNotes ? `<p style="margin: 2px 0;"><strong>Kitchen Notes:</strong> ${order.kitchenNotes}</p>` : ''}
        ${order.designNotes ? `<p style="margin: 2px 0;"><strong>Design Notes:</strong> ${order.designNotes}</p>` : ''}
      </div>
      
      <div class="divider"></div>
    ` : ''}
    
    <div class="center" style="margin-top: 10px;">
      <p style="margin: 5px 0;">${centerText('Thank you for choosing Pinewraps!')}</p>
      <p style="margin: 5px 0;">${centerText('Visit us again soon')}</p>
      <p style="margin: 5px 0;">${centerText('www.pinewraps.com')}</p>
    </div>
  </div>
`;

interface GiftReceiptProps {
  order: Order;
  onClose: () => void;
}

const GiftReceipt: React.FC<GiftReceiptProps> = ({ order, onClose }) => {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePreview = () => {
    setIsPrinting(true);
    withErrorHandling(
      async () => {
        await previewContent(
          generateGiftReceiptContent(order),
          `Gift Receipt #${order.orderNumber}`,
          receiptStyles
        );
        setIsPrinting(false);
      }
    );
  };

  const handlePrint = () => {
    setIsPrinting(true);

    try {
      // Create a hidden iframe for printing
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.top = '-1000px';
      iframe.style.left = '-1000px';
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      iframe.style.border = 'none';

      document.body.appendChild(iframe);

      const giftReceiptContent = generateGiftReceiptContent(order);

      // Write content to iframe
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error('Could not access iframe document');
      }

      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Gift Receipt #${order.orderNumber}</title>
            <meta charset="UTF-8">
            <style>
              body {
                font-family: 'Courier New', monospace;
                font-size: 12px;
                line-height: 1.4;
                margin: 0;
                padding: 10px;
                background: white;
                color: black;
              }
              ${receiptStyles}
              @media print {
                body {
                  margin: 0;
                  padding: 5px;
                  font-size: 11px;
                }
                @page {
                  size: 80mm auto;
                  margin: 0;
                }
                .receipt {
                  max-width: 80mm;
                }
              }
            </style>
          </head>
          <body>
            ${giftReceiptContent}
          </body>
        </html>
      `);
      iframeDoc.close();

      // Wait for content to load, then print
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();

          // Clean up after printing
          setTimeout(() => {
            document.body.removeChild(iframe);
            setIsPrinting(false);
          }, 1000);
        } catch (printError) {
          console.error('Error during iframe print:', printError);
          document.body.removeChild(iframe);
          setIsPrinting(false);

          // Fallback to window.print on current page
          handleDirectPrint();
        }
      }, 500);

    } catch (error) {
      console.error('Error with iframe printing:', error);
      setIsPrinting(false);

      // Fallback to direct print
      handleDirectPrint();
    }
  };

  const handleDirectPrint = () => {
    try {
      // Create a temporary div with the content
      const printDiv = document.createElement('div');
      printDiv.innerHTML = generateGiftReceiptContent(order);
      printDiv.style.display = 'none';

      // Add styles
      const styleElement = document.createElement('style');
      styleElement.textContent = `
        @media print {
          body * { visibility: hidden; }
          .print-content, .print-content * { visibility: visible; }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            line-height: 1.4;
          }
          ${receiptStyles}
          @page {
            size: 80mm auto;
            margin: 0;
          }
        }
      `;

      printDiv.className = 'print-content';
      document.head.appendChild(styleElement);
      document.body.appendChild(printDiv);

      // Print
      window.print();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(printDiv);
        document.head.removeChild(styleElement);
        setIsPrinting(false);
      }, 1000);

    } catch (error) {
      console.error('Error with direct print:', error);
      setIsPrinting(false);
      alert('Error printing gift receipt. Please try again.');
    }
  };

  // Auto-preview on component mount
  useEffect(() => {
    handlePreview();
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">Gift Receipt Preview</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <div dangerouslySetInnerHTML={{ __html: generateGiftReceiptContent(order) }} />
        </div>

        <div className="flex justify-end p-4 border-t">
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 disabled:opacity-50 flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            {isPrinting ? 'Printing...' : 'Print Gift Receipt'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GiftReceipt;
