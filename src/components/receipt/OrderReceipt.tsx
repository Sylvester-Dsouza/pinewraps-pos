import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Printer, X } from 'lucide-react';
import {
  PRINTER_CONFIG,
  centerText,
  formatLineItem,
  formatCurrency,
  printContent,
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

export const generateReceiptContent = (order: Order): string => `
  <div class="receipt">
    <div class="header">
      <h1 style="font-size: 16px; margin: 0;">${centerText('PINEWRAPS')}</h1>
      <p style="margin: 5px 0;">${centerText('Tax Invoice')}</p>
      <p style="margin: 5px 0;">${centerText('Dubai, UAE')}</p>
      <p style="margin: 5px 0;">${centerText('Phone: +971 544044864')}</p>
      <p style="margin: 5px 0; font-size: 10px;">${centerText('TRN: 100461426700003')}</p>
    </div>
    
    <div class="divider"></div>
    
    <div style="margin: 10px 0;">
      <p style="margin: 2px 0;">${formatLineItem('Order #:', order.orderNumber)}</p>
      <p style="margin: 2px 0;">${formatLineItem('Date:', format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm'))}</p>
      <p style="margin: 2px 0;">${formatLineItem('Customer:', order.customerName)}</p>
      <p style="margin: 2px 0;">${formatLineItem('Phone:', order.customerPhone)}</p>
      ${order.customerEmail ? `<p style="margin: 2px 0;">${formatLineItem('Email:', order.customerEmail)}</p>` : ''}
      <p style="margin: 2px 0;">${formatLineItem('Status:', order.status)}</p>
      
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
          ${order.deliveryCharge ? `<p style="margin: 2px 0;">${formatLineItem('Delivery Charge:', formatCurrency(order.deliveryCharge))}</p>` : ''}
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
          <th style="text-align: right;">Price</th>
        </tr>
      </thead>
      <tbody>
        ${order.items.map((item) => `
          <tr>
            <td>${item.productName}</td>
            <td style="text-align: center;">${item.quantity}</td>
            <td style="text-align: right;">${formatCurrency(item.totalPrice)}</td>
          </tr>
          ${Array.isArray(item.selectedVariations) ? item.selectedVariations.map(variation => {
            // Ensure variation has the correct structure
            const type = typeof variation === 'object' && variation !== null 
              ? (variation.type || variation.id || '').toString()
              : '';
            const value = typeof variation === 'object' && variation !== null 
              ? (variation.value || variation.id || '').toString()
              : '';
            
            return type && value ? `
              <tr>
                <td class="variation">${type}: ${value}${variation.customText ? ` (${variation.customText})` : ''}</td>
                <td></td>
                <td style="text-align: right;">${variation.price ? formatCurrency(variation.price) : ''}</td>
              </tr>
            ` : '';
          }).join('') : ''}
          ${item.notes ? `
            <tr>
              <td colspan="3" class="notes">Note: ${item.notes}</td>
            </tr>
          ` : ''}
        `).join('')}
      </tbody>
    </table>
    
    <div class="divider"></div>
    
    <div style="margin: 10px 0;">
      <h3 style="margin: 5px 0; text-align: center; font-size: 14px;">Order Summary</h3>
      <div class="divider"></div>
      
      <!-- Always show subtotal -->
      <p style="margin: 2px 0;">${formatLineItem('Subtotal:', formatCurrency(order.subtotal || order.totalAmount))}</p>
      
      <!-- Display coupon discount if available -->
      ${order.couponDiscount > 0 && order.couponCode ? `<p style="margin: 2px 0;">${formatLineItem(`Coupon Discount (${order.couponCode}):`, formatCurrency(-order.couponDiscount))}</p>` : ''}
      ${order.couponDiscount > 0 && !order.couponCode ? `<p style="margin: 2px 0;">${formatLineItem('Discount:', formatCurrency(-order.couponDiscount))}</p>` : ''}
      
      <!-- For backward compatibility with older orders -->
      ${!order.couponDiscount && (order as any).metadata?.discount > 0 && (order as any).metadata?.coupon?.code ? 
        `<p style="margin: 2px 0;">${formatLineItem(`Coupon Discount (${(order as any).metadata.coupon.code}):`, formatCurrency(-(order as any).metadata.discount))}</p>` : ''}
      ${!order.couponDiscount && (order as any).metadata?.discount > 0 && !(order as any).metadata?.coupon?.code ? 
        `<p style="margin: 2px 0;">${formatLineItem('Discount:', formatCurrency(-(order as any).metadata.discount))}</p>` : ''}
      ${!order.couponDiscount && !(order as any).metadata?.discount && (order as any).metadata?.coupon?.discount > 0 && (order as any).metadata?.coupon?.code ? 
        `<p style="margin: 2px 0;">${formatLineItem(`Coupon Discount (${(order as any).metadata.coupon.code}):`, formatCurrency(-(order as any).metadata.coupon.discount))}</p>` : ''}
      ${!order.couponDiscount && !(order as any).metadata?.discount && (order as any).metadata?.coupon?.discount > 0 && !(order as any).metadata?.coupon?.code ? 
        `<p style="margin: 2px 0;">${formatLineItem('Discount:', formatCurrency(-(order as any).metadata.coupon.discount))}</p>` : ''}
      
      <!-- Display delivery charge if applicable -->
      ${order.deliveryMethod === 'DELIVERY' && order.deliveryCharge && order.deliveryCharge > 0 ? `<p style="margin: 2px 0;">${formatLineItem('Delivery Charge:', formatCurrency(order.deliveryCharge))}</p>` : ''}
      
      <!-- Calculate tax as 5% of subtotal after coupon discount -->
      ${(() => {
        // Get the subtotal
        const subtotal = order.subtotal || order.totalAmount || 0;
        
        // Get the coupon discount
        let couponDiscount = 0;
        if (order.couponDiscount && order.couponDiscount > 0) {
          couponDiscount = order.couponDiscount;
        } else if ((order as any).metadata?.discount && (order as any).metadata.discount > 0) {
          couponDiscount = (order as any).metadata.discount;
        } else if ((order as any).metadata?.coupon?.discount && (order as any).metadata.coupon.discount > 0) {
          couponDiscount = (order as any).metadata.coupon.discount;
        }
        
        // Calculate the taxable amount (subtotal - coupon discount)
        const taxableAmount = Math.max(0, subtotal - couponDiscount);
        
        // Calculate tax using the formula: total / 1.05 = amount before VAT, then VAT = total - amountBeforeVAT
        // This matches the calculation used in the checkout page and order emails
        const amountBeforeVAT = Math.round((taxableAmount / 1.05) * 100) / 100;
        const tax = Math.round((taxableAmount - amountBeforeVAT) * 100) / 100;
        
        // Return the tax line
        return `<p style="margin: 2px 0;">${formatLineItem(`Tax (5%):`, formatCurrency(tax))}</p>`;
      })()}
      
      <div class="divider"></div>
      
      <!-- Total amount with recalculated tax -->
      ${(() => {
        // Get the subtotal
        const subtotal = order.subtotal || order.totalAmount || 0;
        
        // Get the coupon discount
        let couponDiscount = 0;
        if (order.couponDiscount && order.couponDiscount > 0) {
          couponDiscount = order.couponDiscount;
        } else if ((order as any).metadata?.discount && (order as any).metadata.discount > 0) {
          couponDiscount = (order as any).metadata.discount;
        } else if ((order as any).metadata?.coupon?.discount && (order as any).metadata.coupon.discount > 0) {
          couponDiscount = (order as any).metadata.coupon.discount;
        }
        
        // Get the delivery charge
        const deliveryCharge = (order.deliveryMethod === 'DELIVERY' && order.deliveryCharge) ? order.deliveryCharge : 0;
        
        // Calculate the taxable amount (subtotal - coupon discount)
        const taxableAmount = Math.max(0, subtotal - couponDiscount);
        
        // Calculate tax using the formula: total / 1.05 = amount before VAT, then VAT = total - amountBeforeVAT
        // This matches the calculation used in the checkout page and order emails
        const amountBeforeVAT = Math.round((taxableAmount / 1.05) * 100) / 100;
        const tax = Math.round((taxableAmount - amountBeforeVAT) * 100) / 100;
        
        // Calculate the total (taxable amount + delivery charge)
        // Note: taxableAmount already includes VAT, so we don't add tax separately
        const total = taxableAmount + deliveryCharge;
        
        // Return the total line
        return `<p style="margin: 2px 0; font-weight: bold;">${formatLineItem('Total:', formatCurrency(total))}</p>`;
      })()}
    </div>
    
    <div class="divider"></div>
    
    <div style="margin: 10px 0;">
      <p style="margin: 2px 0; font-weight: bold;">Payment Information:</p>
      ${order.payments && order.payments.length > 0 ? `
        ${order.payments.map(payment => `
          <p style="margin: 2px 0;">${formatLineItem(payment.method, formatCurrency(payment.amount))}</p>
          ${payment.status ? `<p style="margin: 2px 0;">${formatLineItem('Status:', payment.status)}</p>` : ''}
          ${payment.reference ? `<p style="margin: 2px 0;">${formatLineItem('Reference:', payment.reference)}</p>` : ''}
          ${payment.metadata && payment.metadata.cashAmount ? `<p style="margin: 2px 0;">${formatLineItem('Cash Amount:', formatCurrency(Number(payment.metadata.cashAmount)))}</p>` : ''}
          ${payment.metadata && payment.metadata.changeAmount ? `<p style="margin: 2px 0;">${formatLineItem('Change Amount:', formatCurrency(Number(payment.metadata.changeAmount)))}</p>` : ''}
        `).join('<div style="margin: 5px 0;"></div>')}
      ` : `
        <p style="margin: 2px 0;">${formatLineItem('Payment Method:', order.paymentMethod || 'Not specified')}</p>
        <p style="margin: 2px 0;">${formatLineItem('Amount Paid:', formatCurrency(order.paidAmount || 0))}</p>
        ${order.changeAmount ? `<p style="margin: 2px 0;">${formatLineItem('Change:', formatCurrency(order.changeAmount))}</p>` : ''}
      `}
    </div>
    
    ${order.isGift ? `
      <div class="divider"></div>
      <div style="margin: 10px 0;">
        <p style="margin: 2px 0; font-weight: bold;">Gift Information:</p>
        ${order.giftRecipientName ? `<p style="margin: 2px 0;">${formatLineItem('Recipient:', order.giftRecipientName)}</p>` : ''}
        ${order.giftRecipientPhone ? `<p style="margin: 2px 0;">${formatLineItem('Recipient Phone:', order.giftRecipientPhone)}</p>` : ''}
        ${order.giftMessage ? `<p style="margin: 2px 0;">${formatLineItem('Message:', order.giftMessage)}</p>` : ''}
        ${order.giftCashAmount ? `<p style="margin: 2px 0;">${formatLineItem('Cash Amount:', formatCurrency(Number(order.giftCashAmount)))}</p>` : ''}
      </div>
    ` : ''}
    
    ${order.notes || order.kitchenNotes || order.designNotes ? `
      <div class="divider"></div>
      <div style="margin: 10px 0;" class="notes">
        ${order.notes ? `<p style="margin: 2px 0;"><strong>Order Notes:</strong> ${order.notes}</p>` : ''}
        ${order.kitchenNotes ? `<p style="margin: 2px 0;"><strong>Kitchen Notes:</strong> ${order.kitchenNotes}</p>` : ''}
        ${order.designNotes ? `<p style="margin: 2px 0;"><strong>Design Notes:</strong> ${order.designNotes}</p>` : ''}
      </div>
    ` : ''}
    
    <div class="divider"></div>
    
    <div class="center" style="margin-top: 10px;">
      <p style="margin: 5px 0;">${centerText('Thank you for choosing Pinewraps!')}</p>
      <p style="margin: 5px 0;">${centerText('Visit us again soon')}</p>
      <p style="margin: 5px 0;">${centerText('www.pinewraps.com')}</p>
    </div>
  </div>
`;

interface OrderReceiptProps {
  order: Order;
  onClose: () => void;
}

const OrderReceipt: React.FC<OrderReceiptProps> = ({ order, onClose }) => {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePreview = () => {
    setIsPrinting(true);
    withErrorHandling(
      async () => {
        await previewContent(
          generateReceiptContent(order),
          `Order Receipt #${order.orderNumber}`,
          receiptStyles
        );
        setIsPrinting(false);
      }
    );
  };

  const handlePrint = () => {
    setIsPrinting(true);
    withErrorHandling(
      async () => {
        await printContent(
          generateReceiptContent(order),
          `Order Receipt #${order.orderNumber}`,
          receiptStyles,
          false, // Don't open cash drawer
          order // Pass the order object for proper formatting
        );
        setIsPrinting(false);
      }
    );
  };

  // Auto-preview on component mount
  useEffect(() => {
    if (order) {
      console.log('Order data for receipt:', order);
      handlePreview();
    }
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Order Receipt #{order.orderNumber}</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="border border-gray-200 rounded p-4 mb-4">
          <div dangerouslySetInnerHTML={{ __html: generateReceiptContent(order) }} />
        </div>
        
        <div className="flex justify-end">
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            {isPrinting ? 'Printing...' : 'Print Receipt'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderReceipt;
