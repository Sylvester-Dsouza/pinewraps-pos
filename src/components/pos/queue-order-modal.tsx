"use client";

import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';

interface CheckoutDetails {
  customerDetails: {
    name: string;
    email: string;
    phone: string;
  };
  deliveryMethod: 'PICKUP' | 'DELIVERY';
  deliveryDetails?: {
    date: string;
    timeSlot: string;
    instructions: string;
    streetAddress: string;
    apartment: string;
    emirate: string;
    city: string;
    charge: number;
  };
  pickupDetails?: {
    date: string;
    timeSlot: string;
  };
  giftDetails: {
    isGift: boolean;
    recipientName: string;
    recipientPhone: string;
    message: string;
    note: string;
    cashAmount: number;
    includeCash: boolean;
  };
  paymentMethod?: 'CASH' | 'CARD';
  paymentReference?: string;
}

interface QueueOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQueueOrder: (name: string, notes: string, checkoutDetails: CheckoutDetails) => void;
  checkoutDetails?: CheckoutDetails;
}

export default function QueueOrderModal({ isOpen, onClose, onQueueOrder, checkoutDetails }: QueueOrderModalProps) {
  const [orderName, setOrderName] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  // Pre-fill order name with customer name if available
  useEffect(() => {
    if (checkoutDetails?.customerDetails?.name) {
      setOrderName(checkoutDetails.customerDetails.name);
    }
  }, [checkoutDetails]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkoutDetails) {
      onQueueOrder(orderName, orderNotes, checkoutDetails);
    } else {
      onQueueOrder(orderName, orderNotes, {
        customerDetails: { name: '', email: '', phone: '' },
        deliveryMethod: 'PICKUP',
        giftDetails: {
          isGift: false,
          recipientName: '',
          recipientPhone: '',
          message: '',
          note: '',
          cashAmount: 0,
          includeCash: false
        }
      });
    }
    setOrderName('');
    setOrderNotes('');
    onClose();
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                    Queue Order
                  </Dialog.Title>
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                    onClick={onClose}
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label htmlFor="orderName" className="block text-sm font-medium text-gray-700 mb-1">
                      Order Name (Optional)
                    </label>
                    <input
                      type="text"
                      id="orderName"
                      value={orderName}
                      onChange={(e) => setOrderName(e.target.value)}
                      placeholder="e.g., Table 5 or Customer Name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      This helps you identify the order in the queue
                    </p>
                  </div>

                  <div className="mb-4">
                    <label htmlFor="orderNotes" className="block text-sm font-medium text-gray-700 mb-1">
                      Notes (Optional)
                    </label>
                    <textarea
                      id="orderNotes"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="Add any notes about this order"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black"
                    />
                  </div>

                  {checkoutDetails && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-md">
                      <h4 className="font-medium text-sm text-gray-700 mb-2">Checkout Details</h4>
                      
                      {checkoutDetails.customerDetails && (
                        <div className="mb-2">
                          <p className="text-sm text-gray-600 font-medium">Customer Details:</p>
                          {checkoutDetails.customerDetails.name && (
                            <p className="text-sm text-gray-600">
                              <strong>Name:</strong> {checkoutDetails.customerDetails.name}
                            </p>
                          )}
                          {checkoutDetails.customerDetails.phone && (
                            <p className="text-sm text-gray-600">
                              <strong>Phone:</strong> {checkoutDetails.customerDetails.phone}
                            </p>
                          )}
                          {checkoutDetails.customerDetails.email && (
                            <p className="text-sm text-gray-600">
                              <strong>Email:</strong> {checkoutDetails.customerDetails.email}
                            </p>
                          )}
                        </div>
                      )}
                      
                      <p className="text-sm text-gray-600">
                        <strong>Method:</strong> {checkoutDetails.deliveryMethod}
                      </p>
                      
                      {checkoutDetails.deliveryMethod === 'DELIVERY' && checkoutDetails.deliveryDetails && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-600 font-medium">Delivery Details:</p>
                          <p className="text-sm text-gray-600">
                            <strong>Date/Time:</strong> {checkoutDetails.deliveryDetails.date} {checkoutDetails.deliveryDetails.timeSlot}
                          </p>
                          {checkoutDetails.deliveryDetails.instructions && (
                            <p className="text-sm text-gray-600">
                              <strong>Instructions:</strong> {checkoutDetails.deliveryDetails.instructions}
                            </p>
                          )}
                          {checkoutDetails.deliveryDetails.streetAddress && (
                            <div>
                              <p className="text-sm text-gray-600 mt-1">
                                <strong>Address:</strong>
                              </p>
                              <p className="text-sm text-gray-600">
                                {checkoutDetails.deliveryDetails.streetAddress}
                                {checkoutDetails.deliveryDetails.apartment && `, ${checkoutDetails.deliveryDetails.apartment}`}
                              </p>
                              <p className="text-sm text-gray-600">
                                {checkoutDetails.deliveryDetails.city}, {checkoutDetails.deliveryDetails.emirate}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {checkoutDetails.deliveryMethod === 'PICKUP' && checkoutDetails.pickupDetails && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-600 font-medium">Pickup Details:</p>
                          <p className="text-sm text-gray-600">
                            <strong>Date/Time:</strong> {checkoutDetails.pickupDetails.date} {checkoutDetails.pickupDetails.timeSlot}
                          </p>
                        </div>
                      )}
                      
                      {checkoutDetails.giftDetails && checkoutDetails.giftDetails.isGift && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-600 font-medium">Gift Details:</p>
                          <p className="text-sm text-gray-600">
                            <strong>Recipient:</strong> {checkoutDetails.giftDetails.recipientName}
                            {checkoutDetails.giftDetails.recipientPhone && ` (${checkoutDetails.giftDetails.recipientPhone})`}
                          </p>
                          {checkoutDetails.giftDetails.message && (
                            <p className="text-sm text-gray-600">
                              <strong>Message:</strong> {checkoutDetails.giftDetails.message}
                            </p>
                          )}
                          {checkoutDetails.giftDetails.includeCash && (
                            <p className="text-sm text-gray-600">
                              <strong>Cash Amount:</strong> AED {checkoutDetails.giftDetails.cashAmount}
                            </p>
                          )}
                        </div>
                      )}

                      {checkoutDetails.paymentMethod && (
                        <p className="text-sm text-gray-600 mt-2">
                          <strong>Payment Method:</strong> {checkoutDetails.paymentMethod}
                          {checkoutDetails.paymentReference && ` (Ref: ${checkoutDetails.paymentReference})`}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-black rounded-md hover:bg-gray-800"
                    >
                      Queue Order
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
