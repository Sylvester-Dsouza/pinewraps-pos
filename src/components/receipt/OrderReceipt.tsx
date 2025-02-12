'use client';

import React from 'react';
import { format } from 'date-fns';
import Image from 'next/image';

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  totalPrice: number;
  variations: Array<{
    type: string;
    value: string;
  }>;
  notes?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  createdAt: string;
  status: 'PENDING' | 'KITCHEN_PROCESSING' | 'KITCHEN_READY' | 'COMPLETED' | 'CANCELLED';
  totalAmount: number;
  paidAmount: number;
  paymentMethod: 'CASH' | 'CARD';
  items: OrderItem[];
  notes?: string;
}

interface OrderReceiptProps {
  order: Order;
  onClose: () => void;
}

const OrderReceipt: React.FC<OrderReceiptProps> = ({ order, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED'
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 print:hidden">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Print Receipt</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <button
            onClick={handlePrint}
            className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 mb-4"
          >
            Print Receipt
          </button>
        </div>
      </div>

      {/* Receipt Template - Only visible when printing */}
      <div className="hidden print:block p-4 w-[80mm] mx-auto text-[12px] leading-tight">
        {/* Header */}
        <div className="text-center mb-4">
          <div className="mb-2">
            {/* Add your logo here */}
            <h1 className="text-xl font-bold">PINEWRAPS</h1>
          </div>
          <p className="font-semibold">Your Delicious Food Partner</p>
          <p>Dubai, UAE</p>
          <p>Phone: +971 XXXXXXXXX</p>
          <p className="text-[10px]">TRN: XXXXXXXXXXXXX</p>
        </div>

        <div className="border-t border-b border-black py-2 mb-3">
          <div className="flex justify-between text-[11px]">
            <div>
              <p><strong>Order #:</strong> {order.orderNumber}</p>
              <p><strong>Date:</strong> {format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm')}</p>
              <p><strong>Customer:</strong> {order.customerName}</p>
              <p><strong>Phone:</strong> {order.customerPhone}</p>
              {order.customerEmail && <p><strong>Email:</strong> {order.customerEmail}</p>}
            </div>
            <div className="text-right">
              <p><strong>Status:</strong> {order.status}</p>
              <p><strong>Payment:</strong> {order.paymentMethod}</p>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="mb-3">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-black">
                <th className="text-left py-1">Item</th>
                <th className="text-right py-1">Qty</th>
                <th className="text-right py-1">Price</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => (
                <React.Fragment key={index}>
                  <tr>
                    <td className="py-1">{item.productName}</td>
                    <td className="text-right">{item.quantity}</td>
                    <td className="text-right">{formatCurrency(item.totalPrice)}</td>
                  </tr>
                  {item.variations?.length > 0 && (
                    <tr>
                      <td colSpan={3} className="text-[10px] text-gray-600 py-0">
                        Options: {item.variations.map(v => `${v.type}: ${v.value}`).join(', ')}
                      </td>
                    </tr>
                  )}
                  {item.notes && (
                    <tr>
                      <td colSpan={3} className="text-[10px] text-gray-600 py-0">
                        Notes: {item.notes}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t border-black pt-2">
          <div className="flex justify-between text-[11px]">
            <strong>Subtotal:</strong>
            <span>{formatCurrency(order.totalAmount / 1.05)}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <strong>VAT (5%):</strong>
            <span>{formatCurrency(order.totalAmount - (order.totalAmount / 1.05))}</span>
          </div>
          <div className="flex justify-between font-bold mt-1 text-[12px]">
            <strong>Total:</strong>
            <span>{formatCurrency(order.totalAmount)}</span>
          </div>
          <div className="flex justify-between text-[11px] mt-1">
            <strong>Paid Amount:</strong>
            <span>{formatCurrency(order.paidAmount)}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <strong>Change:</strong>
            <span>{formatCurrency(order.paidAmount - order.totalAmount)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-4 text-[11px]">
          <p>Thank you for choosing Pinewraps!</p>
          <p>Visit us again soon.</p>
        </div>
      </div>
    </div>
  );
};

export default OrderReceipt;
