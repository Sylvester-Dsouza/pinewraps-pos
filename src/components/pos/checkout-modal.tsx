"use client";

import { Fragment, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { X } from "lucide-react";
import { toast } from "react-hot-toast";
import { apiMethods } from "@/services/api";
import Image from "next/image";


interface CartItem {
  id: string;
  product: {
    id: string;
    name: string;
    basePrice: number;
    status: string;
    images?: Array<{
      url: string;
      comment: string;
    }>;
  };
  quantity: number;
  selectedVariations: Array<{
    id: string;
    type: string;
    value: string;
    priceAdjustment: number;
  }>;
  totalPrice: number;
  notes?: string;
  customProductId?: string;
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: Array<CartItem>;
  cartTotal: number;
  onCheckoutComplete: () => void;
}

export default function CheckoutModal({
  isOpen,
  onClose,
  cart,
  cartTotal,
  onCheckoutComplete
}: CheckoutModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CREDIT_CARD'>('CASH');
  const [paymentReference, setPaymentReference] = useState('');
  const [customerDetails, setCustomerDetails] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      // Validate required fields
      if (!customerDetails.name || !customerDetails.phone) {
        toast.error("Please fill in required customer details");
        setIsSubmitting(false);
        return;
      }

      const orderData = {
        items: cart.map(item => {
          const images = item.product.images || [];
          const isCustomProduct = item.product.id.startsWith('custom_');
          const customProductId = isCustomProduct ? item.product.id.replace('custom_', '') : undefined;
          
          return {
            productId: isCustomProduct ? undefined : item.product.id,
            customProductId,
            productName: item.product.name,
            quantity: item.quantity,
            unitPrice: Number(item.product.basePrice),
            totalPrice: Number(item.totalPrice),
            variations: item.selectedVariations || [],
            requiresDesign: images.length > 0,
            notes: item.notes || '',
            designDetails: item.notes || '',
            kitchenNotes: item.notes || '',
            designImages: images.length > 0 ? 
              images.map(img => ({
                imageUrl: img.url || '',
                comment: img.comment || ''
              })) : undefined
          };
        }),
        customerName: customerDetails.name,
        customerPhone: customerDetails.phone,
        customerEmail: customerDetails.email,
        paymentMethod,
        paymentReference,
        paidAmount: Number(cartTotal),
        totalAmount: Number(cartTotal),
        changeAmount: 0,
        requiresKitchen: true,
        expectedReadyTime: new Date(Date.now() + 30 * 60 * 1000)
      };

      console.log('Sending order data:', JSON.stringify(orderData, null, 2));

      try {
        const response = await apiMethods.pos.createOrder(orderData);
        if (response.success) {
          toast.success("Order created successfully!");
          onCheckoutComplete();
          onClose();
        } else {
          toast.error(response.message || "Failed to create order");
        }
      } catch (error: any) {
        console.error("Failed to create order:", error);
        toast.error(error.response?.data?.message || "Failed to create order");
      } finally {
        setIsSubmitting(false);
      }
    } catch (error: any) {
      console.error("Failed to create order:", error);
      toast.error(error.message || "Failed to create order");
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
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-5xl transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                <div className="relative">
                  <button
                    onClick={onClose}
                    className="absolute right-0 top-0 p-4 text-gray-400 hover:text-gray-500"
                  >
                    <X className="h-6 w-6" />
                  </button>

                  <div className="mt-8">
                    <Dialog.Title
                      as="h3"
                      className="text-2xl font-semibold leading-6 text-gray-900 mb-8"
                    >
                      Checkout
                    </Dialog.Title>

                    <div className="flex flex-row h-full space-x-8">
                      {/* Left Side - Order Summary */}
                      <div className="flex-1 pr-8 border-r">
                        <h4 className="text-xl font-medium mb-6">Order Summary</h4>
                        <div className="max-h-[60vh] overflow-y-auto pr-4 space-y-6">
                          {cart.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-start justify-between p-4 bg-gray-50 rounded-lg"
                            >
                              <div className="flex-1">
                                <p className="text-lg font-medium">{item.product.name}</p>
                                {/* Show images for custom orders */}
                                {item.product.images && item.product.images.length > 0 && (
                                  <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                                    {item.product.images.map((image, index) => (
                                      <div 
                                        key={index} 
                                        className="relative min-w-[80px] h-[80px] rounded-lg overflow-hidden"
                                      >
                                        <Image
                                          src={image.url}
                                          alt={`Design ${index + 1}`}
                                          fill
                                          className="object-cover"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <p className="text-base text-gray-500 mt-2">
                                  Quantity: {item.quantity}
                                </p>
                                {item.selectedVariations.map((variation) => (
                                  <p
                                    key={variation.id}
                                    className="text-base text-gray-500"
                                  >
                                    {variation.type}: {variation.value}
                                  </p>
                                ))}
                                {item.notes && (
                                  <p className="text-base text-gray-500 mt-2">
                                    Notes: {item.notes}
                                  </p>
                                )}
                              </div>
                              <p className="text-lg font-medium ml-4">
                                AED {item.totalPrice.toFixed(2)}
                              </p>
                            </div>
                          ))}
                        </div>

                        <div className="mt-8 pt-6 border-t">
                          <div className="flex justify-between items-center font-medium">
                            <p className="text-xl">Total</p>
                            <p className="text-2xl">AED {cartTotal.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Right Side - Customer Details & Payment */}
                      <div className="flex-1 pl-8">
                        <h4 className="text-xl font-medium mb-6">Customer Details</h4>
                        <div className="space-y-6">
                          <div>
                            <input
                              type="text"
                              value={customerDetails.name}
                              onChange={(e) => setCustomerDetails(prev => ({ ...prev, name: e.target.value }))}
                              className="mt-1 block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                              placeholder="Name *"
                              required
                            />
                          </div>

                          <div>
                            <input
                              type="tel"
                              value={customerDetails.phone}
                              onChange={(e) => setCustomerDetails(prev => ({ ...prev, phone: e.target.value }))}
                              className="mt-1 block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                              placeholder="Phone *"
                              required
                            />
                          </div>

                          <div>
                            <input
                              type="email"
                              value={customerDetails.email}
                              onChange={(e) => setCustomerDetails(prev => ({ ...prev, email: e.target.value }))}
                              className="mt-1 block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                              placeholder="Email"
                            />
                          </div>

                          <div className="space-y-4">
                            <h4 className="text-lg font-medium text-gray-700">
                              Payment Method *
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                              <button
                                type="button"
                                onClick={() => setPaymentMethod('CASH')}
                                className={`p-6 text-lg font-medium rounded-xl border-2 transition-all ${
                                  paymentMethod === 'CASH'
                                    ? 'border-black bg-black text-white'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                Cash
                              </button>
                              <button
                                type="button"
                                onClick={() => setPaymentMethod('CREDIT_CARD')}
                                className={`p-6 text-lg font-medium rounded-xl border-2 transition-all ${
                                  paymentMethod === 'CREDIT_CARD'
                                    ? 'border-black bg-black text-white'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                Card
                              </button>
                            </div>
                          </div>

                          <div>
                            <input
                              type="text"
                              value={paymentReference}
                              onChange={(e) => setPaymentReference(e.target.value)}
                              placeholder="Payment Reference"
                              className="mt-1 block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                            />
                          </div>

                          <div className="mt-8">
                            <button
                              type="button"
                              onClick={handleSubmit}
                              disabled={isSubmitting}
                              className={`w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-6 py-4 bg-black text-xl font-medium text-white hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors`}
                            >
                              {isSubmitting ? "Processing..." : "Complete Order"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
