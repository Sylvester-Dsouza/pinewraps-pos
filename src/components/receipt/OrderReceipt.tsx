import React, { useEffect } from 'react';
import { format } from 'date-fns';
import {
  PRINTER_CONFIG,
  centerText,
  formatLineItem,
  formatCurrency,
  printContent,
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

const generateReceiptContent = (order: Order): string => `
  <div class="receipt">
    <div class="header">
      <h1 style="font-size: 16px; margin: 0;">${centerText('PINEWRAPS')}</h1>
      <p style="margin: 5px 0;">${centerText('Your Delicious Food Partner')}</p>
      <p style="margin: 5px 0;">${centerText('Dubai, UAE')}</p>
      <p style="margin: 5px 0;">${centerText('Phone: +971 XXXXXXXXX')}</p>
      <p style="margin: 5px 0; font-size: 10px;">${centerText('TRN: XXXXXXXXXXXXX')}</p>
    </div>
    
    <div class="divider"></div>
    
    <div style="margin: 10px 0;">
      <p style="margin: 2px 0;">${formatLineItem('Order #:', order.orderNumber)}</p>
      <p style="margin: 2px 0;">${formatLineItem('Date:', format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm'))}</p>
      <p style="margin: 2px 0;">${formatLineItem('Customer:', order.customerName)}</p>
      <p style="margin: 2px 0;">${formatLineItem('Phone:', order.customerPhone)}</p>
      ${order.customerEmail ? `<p style="margin: 2px 0;">${formatLineItem('Email:', order.customerEmail)}</p>` : ''}
      <p style="margin: 2px 0;">${formatLineItem('Status:', order.status)}</p>
      <p style="margin: 2px 0;">${formatLineItem('Payment:', order.paymentMethod)}</p>
      
      ${order.deliveryMethod ? `
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
          `}
        </div>
      ` : ''}
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
            <td>${item.name}</td>
            <td style="text-align: center;">${item.quantity}</td>
            <td style="text-align: right;">${formatCurrency(item.totalPrice)}</td>
          </tr>
          ${Array.isArray(item.variations) ? item.variations.map(variation => {
            // Ensure variation has the correct structure
            const type = typeof variation === 'object' && variation !== null 
              ? (variation.type || variation.id || '').toString()
              : '';
            const value = typeof variation === 'object' && variation !== null 
              ? (variation.value || variation.id || '').toString()
              : '';
            
            return type && value ? `
              <tr>
                <td colspan="3" class="variation">- ${type}: ${value}</td>
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
      <p style="margin: 2px 0;">${formatLineItem('Subtotal:', formatCurrency(order.totalAmount))}</p>
      ${order.deliveryMethod === 'DELIVERY' ? `<p style="margin: 2px 0;">${formatLineItem('Delivery:', formatCurrency(order.deliveryCharge || 0))}</p>` : ''}
      <p style="margin: 2px 0; font-weight: bold;">${formatLineItem('Total:', formatCurrency(order.totalAmount + (order.deliveryCharge || 0)))}</p>
      <p style="margin: 2px 0;">${formatLineItem('Payment Method:', order.paymentMethod)}</p>
      <p style="margin: 2px 0;">${formatLineItem('Amount Paid:', formatCurrency(order.paidAmount))}</p>
      ${order.changeAmount ? `<p style="margin: 2px 0;">${formatLineItem('Change:', formatCurrency(order.changeAmount))}</p>` : ''}
      ${order.payments && order.payments.length > 0 ? `
        <div class="divider"></div>
        <div style="margin: 10px 0;">
          <p style="margin: 2px 0; font-weight: bold;">Payment Details:</p>
          ${order.payments.map(payment => `
            <p style="margin: 2px 0;">${formatLineItem(payment.method, formatCurrency(payment.amount))}</p>
            ${payment.reference ? `<p style="margin: 2px 0;">${formatLineItem('Reference:', payment.reference)}</p>` : ''}
            ${payment.metadata && payment.metadata.cashAmount ? `<p style="margin: 2px 0;">${formatLineItem('Cash Amount:', formatCurrency(payment.metadata.cashAmount))}</p>` : ''}
            ${payment.metadata && payment.metadata.changeAmount ? `<p style="margin: 2px 0;">${formatLineItem('Change Amount:', formatCurrency(payment.metadata.changeAmount))}</p>` : ''}
          `).join('')}
        </div>
      ` : ''}
    </div>
    
    ${order.notes ? `
      <div style="margin: 10px 0;" class="notes">
        <strong>Order Notes:</strong> ${order.notes}
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
  useEffect(() => {
    if (order) {
      console.log('Order data for receipt:', order);
      setTimeout(() => {
        withErrorHandling(
          async () => {
            await printContent(
              generateReceiptContent(order),
              `Order Receipt #${order.orderNumber}`,
              receiptStyles
            );
          },
          'Failed to print receipt'
        );
      }, 500);
    }
  }, [order]);

  return null; // Component doesn't need to render anything
};

export default OrderReceipt;
