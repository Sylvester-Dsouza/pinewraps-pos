"use client";

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Clock, ShoppingCart, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { PosQueuedOrder } from '@/services/api';

interface QueuedOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  queuedOrders: PosQueuedOrder[];
  onLoadOrder: (order: PosQueuedOrder) => void;
  onDeleteOrder: (orderId: string) => void;
}

export default function QueuedOrdersModal({
  isOpen,
  onClose,
  queuedOrders,
  onLoadOrder,
  onDeleteOrder
}: QueuedOrdersModalProps) {
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                    Queued Orders
                  </Dialog.Title>
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                    onClick={onClose}
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                {queuedOrders.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">
                    <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-sm">No queued orders</p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-4 max-h-96 overflow-y-auto">
                    {queuedOrders.map((order) => (
                      <div
                        key={order.id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">
                              {order.name || `Order #${order.id.substring(0, 8)}`}
                            </h4>
                            <div className="mt-1 flex items-center text-sm text-gray-500">
                              <Clock className="mr-1 h-4 w-4" />
                              <span>
                                {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                              </span>
                            </div>
                            <div className="mt-2">
                              <span className="text-sm text-gray-600">
                                {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                              </span>
                              <span className="mx-2">•</span>
                              <span className="text-sm font-medium">
                                AED {order.totalAmount.toFixed(2)}
                              </span>
                            </div>
                            {order.notes && (
                              <div className="mt-2 text-sm text-gray-600">
                                <p className="font-medium">Notes:</p>
                                <p className="mt-1">{order.notes}</p>
                              </div>
                            )}
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => onLoadOrder(order)}
                              className="px-3 py-1.5 text-sm bg-black text-white rounded-md hover:bg-gray-800"
                            >
                              Load
                            </button>
                            <button
                              onClick={() => onDeleteOrder(order.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
