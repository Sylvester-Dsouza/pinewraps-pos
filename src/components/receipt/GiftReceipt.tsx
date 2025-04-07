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
                <td class="variation">${type}: ${value}</td>
                <td></td>
              </tr>
            ` : '';
          }).join('') : ''}
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
  useEffect(() => {
    if (order) {
      console.log('Order data for gift receipt:', order);
      setTimeout(() => {
        withErrorHandling(
          async () => {
            await printContent(
              generateGiftReceiptContent(order),
              `Gift Receipt #${order.orderNumber}`,
              receiptStyles
            );
          }
        );
      }, 500);
    }
  }, [order]);

  return null; // Component doesn't need to render anything
};

export default GiftReceipt;
