'use client';

import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { XCircle, Calendar, Clock } from 'lucide-react';
import { apiMethods } from '@/services/api';
import { toast } from 'react-hot-toast';
import { Order } from '@/types/order';
import { format } from 'date-fns';

interface UpdatePickupDetailsModalProps {
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

const UpdatePickupDetailsModal: React.FC<UpdatePickupDetailsModalProps> = ({
  isOpen,
  onClose,
  order,
  onSuccess
}) => {
  // Initialize with current pickup details from the order
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pickupDate || !pickupTimeSlot) {
      toast.error('Please select both date and time');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const response = await apiMethods.pos.updatePickupDetails(order.id, {
        pickupDate,
        pickupTimeSlot
      });
      
      if (response.success) {
        toast.success('Pickup details updated successfully');
        onSuccess();
        onClose();
      } else {
        throw new Error(response.message || 'Failed to update pickup details');
      }
    } catch (error: any) {
      console.error('Error updating pickup details:', error);
      toast.error(error.message || 'Failed to update pickup details');
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
                  className="text-lg font-medium leading-6 text-gray-900 justify-between items-center"
                >
                  <span>Update Pickup Details</span>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-gray-500"
                    onClick={onClose}
                  >
                    <XCircle className="h-6 w-6" />
                  </button>
                </Dialog.Title>
                
                <div className="mt-4">
                  <p className="text-sm text-gray-500 mb-4">
                    Order #{order.orderNumber} - Current pickup: {order.pickupDate ? format(new Date(order.pickupDate), 'PP') : 'Not set'} at {order.pickupTimeSlot || 'Not set'}
                  </p>
                  
                  <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          Pickup Date
                        </label>
                        <input
                          type="date"
                          value={pickupDate}
                          onChange={(e) => setPickupDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          min={format(new Date(), 'yyyy-MM-dd')}
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          Pickup Time
                        </label>
                        <select
                          value={pickupTimeSlot}
                          onChange={(e) => setPickupTimeSlot(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          required
                        >
                          {timeSlots.map((slot) => (
                            <option key={slot} value={slot}>
                              {slot}
                            </option>
                          ))}
                        </select>
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
                        {isSubmitting ? 'Updating...' : 'Update Pickup Details'}
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

export default UpdatePickupDetailsModal;
