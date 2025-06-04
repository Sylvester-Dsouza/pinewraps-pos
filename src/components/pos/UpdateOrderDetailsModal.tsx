'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { XCircle, Calendar, Clock, Truck, Store, Gift, DollarSign } from 'lucide-react';
import { apiMethods } from '@/services/api';
import { toast } from 'react-hot-toast';
import { Order } from '@/types/order';
import { format } from 'date-fns';

interface UpdateOrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  onSuccess: () => void;
}

const timeSlots = [
  '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', 
  '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', 
  '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM'
];

const UpdateOrderDetailsModal: React.FC<UpdateOrderDetailsModalProps> = ({
  isOpen,
  onClose,
  order,
  onSuccess
}) => {
  // Initialize with current order details
  const [deliveryMethod, setDeliveryMethod] = useState<'PICKUP' | 'DELIVERY'>(
    order.deliveryMethod || 'PICKUP'
  );
  
  // Pickup details
  const [pickupDate, setPickupDate] = useState<string>(() => {
    if (order.pickupDate) {
      // Convert the ISO date string to a Date object and format it as YYYY-MM-DD for the input
      return format(new Date(order.pickupDate), 'yyyy-MM-dd');
    }
    return format(new Date(), 'yyyy-MM-dd');
  });
  const [pickupTimeSlot, setPickupTimeSlot] = useState<string>(
    order.pickupTimeSlot || timeSlots[0]
  );
  
  // Delivery details
  const [deliveryDate, setDeliveryDate] = useState<string>(() => {
    if (order.deliveryDate) {
      return format(new Date(order.deliveryDate), 'yyyy-MM-dd');
    }
    return format(new Date(), 'yyyy-MM-dd');
  });
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState<string>(
    order.deliveryTimeSlot || timeSlots[0]
  );
  const [deliveryCharge, setDeliveryCharge] = useState<string>(
    String(order.deliveryCharge || 0)
  );

  // Gift details
  const [isGift, setIsGift] = useState<boolean>(order.isGift || false);
  const [giftRecipientName, setGiftRecipientName] = useState<string>(order.giftRecipientName || '');
  const [giftRecipientPhone, setGiftRecipientPhone] = useState<string>(order.giftRecipientPhone || '');
  const [giftMessage, setGiftMessage] = useState<string>(order.giftMessage || '');
  const [giftCashAmount, setGiftCashAmount] = useState<string>(
    order.giftCashAmount ? order.giftCashAmount.toString() : '0'
  );
  const [includeCash, setIncludeCash] = useState<boolean>(order.giftCashAmount > 0);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate totals
  const currentSubtotal = order.subtotal || (order.totalAmount - (order.deliveryCharge || 0));
  const currentDeliveryCharge = parseFloat(deliveryCharge) || 0;
  const newTotal = deliveryMethod === 'DELIVERY'
    ? currentSubtotal + currentDeliveryCharge
    : currentSubtotal;
  const totalDifference = newTotal - order.totalAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (deliveryMethod === 'PICKUP' && (!pickupDate || !pickupTimeSlot)) {
      toast.error('Please select both date and time for pickup');
      return;
    }
    
    if (deliveryMethod === 'DELIVERY' && (!deliveryDate || !deliveryTimeSlot)) {
      toast.error('Please select both date and time for delivery');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const response = await apiMethods.pos.updateOrderDetails(order.id, {
        deliveryMethod,
        pickupDate: deliveryMethod === 'PICKUP' ? pickupDate : undefined,
        pickupTimeSlot: deliveryMethod === 'PICKUP' ? pickupTimeSlot : undefined,
        deliveryDate: deliveryMethod === 'DELIVERY' ? deliveryDate : undefined,
        deliveryTimeSlot: deliveryMethod === 'DELIVERY' ? deliveryTimeSlot : undefined,
        deliveryCharge: deliveryMethod === 'DELIVERY' ? parseFloat(deliveryCharge) || 0 : 0,
        isGift,
        giftRecipientName: isGift ? giftRecipientName : undefined,
        giftRecipientPhone: isGift ? giftRecipientPhone : undefined,
        giftMessage: isGift ? giftMessage : undefined,
        giftCashAmount: isGift && includeCash ? parseFloat(giftCashAmount) : 0
      });
      
      if (response.success) {
        toast.success('Order details updated successfully');
        onSuccess();
        onClose();
      } else {
        throw new Error(response.message || 'Failed to update order details');
      }
    } catch (error: any) {
      console.error('Error updating order details:', error);
      toast.error(error.message || 'Failed to update order details');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
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
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 justify-between items-center flex"
                >
                  <span>Update Order Details</span>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-gray-500 ml-auto"
                    onClick={onClose}
                  >
                    <XCircle className="h-6 w-6" />
                  </button>
                </Dialog.Title>
                
                <div className="mt-4">
                  <p className="text-sm text-gray-500 mb-4">
                    Order #{order.orderNumber} - Current method: {order.deliveryMethod || 'PICKUP'}
                    {order.deliveryMethod === 'PICKUP' && order.pickupDate && (
                      <> - Pickup: {format(new Date(order.pickupDate), 'PP')} at {order.pickupTimeSlot || 'Not set'}</>
                    )}
                    {order.deliveryMethod === 'DELIVERY' && order.deliveryDate && (
                      <> - Delivery: {format(new Date(order.deliveryDate), 'PP')} at {order.deliveryTimeSlot || 'Not set'}</>
                    )}
                  </p>
                  
                  <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                      <div className="mb-4">
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Delivery Method</label>
                        <div className="flex space-x-4 mt-2">
                          <button
                            type="button"
                            className={`flex items-center px-4 py-2 rounded-md ${deliveryMethod === 'PICKUP' ? 'bg-indigo-100 border-indigo-500 text-indigo-700 border-2' : 'bg-gray-100 border-gray-300 text-gray-700 border'}`}
                            onClick={() => setDeliveryMethod('PICKUP')}
                          >
                            <Store className="h-4 w-4 mr-2" />
                            Pickup
                          </button>
                          <button
                            type="button"
                            className={`flex items-center px-4 py-2 rounded-md ${deliveryMethod === 'DELIVERY' ? 'bg-indigo-100 border-indigo-500 text-indigo-700 border-2' : 'bg-gray-100 border-gray-300 text-gray-700 border'}`}
                            onClick={() => setDeliveryMethod('DELIVERY')}
                          >
                            <Truck className="h-4 w-4 mr-2" />
                            Delivery
                          </button>
                        </div>
                      </div>
                      
                      {deliveryMethod === 'PICKUP' && (
                        <>
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              Pickup Date
                            </label>
                            <input
                              type="date"
                              value={pickupDate}
                              onChange={(e) => setPickupDate(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                              min={format(new Date(), 'yyyy-MM-dd')}
                              required={deliveryMethod === 'PICKUP'}
                            />
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              Pickup Time
                            </label>
                            <select
                              value={pickupTimeSlot}
                              onChange={(e) => setPickupTimeSlot(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                              required={deliveryMethod === 'PICKUP'}
                            >
                              {timeSlots.map((slot) => (
                                <option key={slot} value={slot}>
                                  {slot}
                                </option>
                              ))}
                            </select>
                          </div>
                        </>
                      )}
                      
                      {deliveryMethod === 'DELIVERY' && (
                        <>
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              Delivery Date
                            </label>
                            <input
                              type="date"
                              value={deliveryDate}
                              onChange={(e) => setDeliveryDate(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                              min={format(new Date(), 'yyyy-MM-dd')}
                              required={deliveryMethod === 'DELIVERY'}
                            />
                          </div>

                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              Delivery Time
                            </label>
                            <select
                              value={deliveryTimeSlot}
                              onChange={(e) => setDeliveryTimeSlot(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                              required={deliveryMethod === 'DELIVERY'}
                            >
                              {timeSlots.map((slot) => (
                                <option key={slot} value={slot}>
                                  {slot}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 flex items-center">
                              <DollarSign className="h-4 w-4 mr-1" />
                              Delivery Charge (AED)
                            </label>
                            <input
                              type="number"
                              value={deliveryCharge}
                              onChange={(e) => setDeliveryCharge(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                              min="0"
                              step="0.01"
                              placeholder="Enter delivery charge"
                            />
                          </div>
                        </>
                      )}

                      {/* Order Total Summary */}
                      <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Order Total Summary</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span>AED {currentSubtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Delivery Charge:</span>
                            <span>AED {(deliveryMethod === 'DELIVERY' ? currentDeliveryCharge : 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-medium border-t pt-2">
                            <span>New Total:</span>
                            <span>AED {newTotal.toFixed(2)}</span>
                          </div>
                          {totalDifference !== 0 && (
                            <div className={`flex justify-between text-sm ${totalDifference > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              <span>Change from current:</span>
                              <span>{totalDifference > 0 ? '+' : ''}AED {totalDifference.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Gift Information Section */}
                      <div className="mt-6 border-t pt-4">
                        <div className="flex items-center mb-4">
                          <input
                            type="checkbox"
                            id="isGift"
                            checked={isGift}
                            onChange={(e) => setIsGift(e.target.checked)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <label htmlFor="isGift" className="ml-2 block text-sm font-medium text-gray-700 flex items-center">
                            <Gift className="h-4 w-4 mr-1" />
                            This is a gift order
                          </label>
                        </div>
                        
                        {isGift && (
                          <div className="space-y-4 pl-6 border-l-2 border-indigo-100">
                            <div>
                              <label className="text-sm font-medium text-gray-700 mb-1 block">
                                Recipient Name
                              </label>
                              <input
                                type="text"
                                value={giftRecipientName}
                                onChange={(e) => setGiftRecipientName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="Recipient's name"
                              />
                            </div>
                            
                            <div>
                              <label className="text-sm font-medium text-gray-700 mb-1 block">
                                Recipient Phone
                              </label>
                              <input
                                type="tel"
                                value={giftRecipientPhone}
                                onChange={(e) => setGiftRecipientPhone(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="Recipient's phone number"
                              />
                            </div>
                            
                            <div>
                              <label className="text-sm font-medium text-gray-700 mb-1 block">
                                Gift Message
                              </label>
                              <textarea
                                value={giftMessage}
                                onChange={(e) => setGiftMessage(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                rows={3}
                                placeholder="Your gift message"
                              />
                            </div>
                            
                            <div className="flex items-center mb-2">
                              <input
                                type="checkbox"
                                id="includeCash"
                                checked={includeCash}
                                onChange={(e) => setIncludeCash(e.target.checked)}
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                              />
                              <label htmlFor="includeCash" className="ml-2 block text-sm font-medium text-gray-700">
                                Include Cash Gift
                              </label>
                            </div>
                            
                            {includeCash && (
                              <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">
                                  Cash Amount (AED)
                                </label>
                                <input
                                  type="number"
                                  value={giftCashAmount}
                                  onChange={(e) => setGiftCashAmount(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                  min="0"
                                  step="1"
                                  placeholder="Cash amount"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        type="button"
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                        onClick={onClose}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Updating...' : 'Update Order Details'}
                      </button>
                    </div>
                  </form>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default UpdateOrderDetailsModal;
