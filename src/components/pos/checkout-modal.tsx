"use client";

import { Fragment, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { X } from "lucide-react";
import { toast } from "react-hot-toast";
import { apiMethods, type CustomImage, type POSOrderData, type POSOrderStatus } from "@/services/api";
import Image from "next/image";
import ImageUpload from "./custom-images/image-upload";
import { useAuth } from "@/providers/auth-provider";

interface CartItem {
  id: string;
  product: {
    id: string;
    name: string;
    basePrice: number;
    status: string;
    allowCustomPrice?: boolean;
    requiresDesign?: boolean;
    requiresKitchen?: boolean;
    allowCustomImages?: boolean;
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
  customImages?: CustomImage[];
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: Array<CartItem>;
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  cartTotal: number;
  onCheckoutComplete: () => void;
}

export default function CheckoutModal({
  isOpen,
  onClose,
  cart,
  setCart,
  cartTotal,
  onCheckoutComplete
}: CheckoutModalProps) {
  const { refreshToken } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [paymentReference, setPaymentReference] = useState('');
  const [teamSelection, setTeamSelection] = useState<'KITCHEN' | 'DESIGN' | 'BOTH'>('KITCHEN');
  const [deliveryMethod, setDeliveryMethod] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [customerDetails, setCustomerDetails] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [deliveryDetails, setDeliveryDetails] = useState({
    date: "",
    timeSlot: "",
    instructions: "",
    streetAddress: "",
    apartment: "",
    emirate: "",
    city: "",
    charge: 0,
  });
  const [pickupDetails, setPickupDetails] = useState({
    date: "",
    timeSlot: "",
  });
  const [orderItems, setOrderItems] = useState<Array<{
    productId?: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    variations: any;
    requiresDesign: boolean;
    designDetails?: string;
    kitchenNotes?: string;
    customImages?: CustomImage[];
  }>>([]);

  // Time slots based on emirate
  const getTimeSlots = (emirate: string) => {
    if (emirate === 'DUBAI') {
      return [
        "10:00 AM - 12:00 PM",
        "12:00 PM - 02:00 PM",
        "02:00 PM - 04:00 PM",
        "04:00 PM - 06:00 PM",
        "06:00 PM - 08:00 PM"
      ];
    }
    // Other emirates have limited slots
    return [
      "10:00 AM - 02:00 PM",
      "02:00 PM - 06:00 PM"
    ];
  };

  // Get available dates based on emirate
  const getAvailableDates = (emirate: string) => {
    const dates = [];
    const today = new Date();
    
    // Dubai: Next day delivery
    // Other emirates: 2 days advance delivery
    const startDays = emirate === 'DUBAI' ? 1 : 2;
    
    for (let i = startDays; i < startDays + 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

  // Emirates list
  const emirates = [
    "DUBAI",
    "ABU_DHABI",
    "SHARJAH",
    "AJMAN",
    "UMM_AL_QUWAIN",
    "RAS_AL_KHAIMAH",
    "FUJAIRAH"
  ];

  // Calculate delivery charge based on emirate
  const calculateDeliveryCharge = (emirate: string) => {
    return emirate === 'DUBAI' ? 30 : 50;
  };

  // Calculate total with delivery charge
  const calculateTotal = () => {
    const baseTotal = cartTotal;
    if (deliveryMethod === 'DELIVERY' && deliveryDetails.emirate) {
      return baseTotal + calculateDeliveryCharge(deliveryDetails.emirate);
    }
    return baseTotal;
  };

  // Update emirate and recalculate total
  const handleEmirateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDeliveryDetails(prev => ({ ...prev, emirate: e.target.value }));
  };

  const handleCheckout = async () => {
    try {
      // Validate pickup/delivery details first
      if (deliveryMethod === 'PICKUP') {
        if (!pickupDetails.date || !pickupDetails.timeSlot) {
          toast.error('Please select both pickup date and time');
          return;
        }
      } else if (deliveryMethod === 'DELIVERY') {
        if (!deliveryDetails.date || !deliveryDetails.timeSlot || !deliveryDetails.streetAddress || 
            !deliveryDetails.emirate || !deliveryDetails.city) {
          toast.error('Please fill in all required delivery details');
          return;
        }
      }

      // Validate payment reference for card payments
      if (paymentMethod === 'CARD' && !paymentReference.trim()) {
        toast.error('Please enter the transaction ID for card payment');
        return;
      }

      setIsSubmitting(true);

      // Refresh token before making API calls
      await refreshToken();

      // First create the order with basic item data
      const orderItems = cart.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.product.basePrice,
        totalPrice: item.totalPrice,
        variations: item.selectedVariations.reduce((acc, variation) => ({
          ...acc,
          [variation.type]: {
            name: variation.type,
            value: variation.value
          }
        }), {}),
        notes: item.notes || '',
        customImages: item.customImages?.map(img => ({
          ...(img.file ? { file: img.file } : {}),
          url: img.url || '',
          comment: img.comment || ''
        }))
      }));

      // Create the order
      const orderData: POSOrderData = {
        items: orderItems,
        customerName: customerDetails.name,
        customerPhone: customerDetails.phone,
        customerEmail: customerDetails.email || undefined,
        paymentMethod,
        ...(paymentReference ? { paymentReference: paymentReference.trim() } : {}),
        totalAmount: cartTotal + (deliveryMethod === 'DELIVERY' ? calculateDeliveryCharge(deliveryDetails.emirate) : 0),
        paidAmount: cartTotal + (deliveryMethod === 'DELIVERY' ? calculateDeliveryCharge(deliveryDetails.emirate) : 0),
        changeAmount: 0,
        deliveryMethod,
        requiresKitchen: cart.some(item => item.product.requiresKitchen === true),
        requiresDesign: cart.some(item => item.product.requiresDesign === true),
        status: 'PENDING' as POSOrderStatus,
        ...(deliveryMethod === 'DELIVERY' ? {
          deliveryDate: deliveryDetails.date,
          deliveryTimeSlot: deliveryDetails.timeSlot,
          deliveryCharge: calculateDeliveryCharge(deliveryDetails.emirate),
          deliveryInstructions: deliveryDetails.instructions || '',
          streetAddress: deliveryDetails.streetAddress,
          apartment: deliveryDetails.apartment || '',
          emirate: deliveryDetails.emirate,
          city: deliveryDetails.city || ''
        } : {
          pickupDate: pickupDetails.date,
          pickupTimeSlot: pickupDetails.timeSlot
        }),
      };

      const response = await apiMethods.pos.createOrder(orderData);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to create order');
      }

      // After order is created, upload images for each order item
      await Promise.all(response.data.data.items.map(async (orderItem, index) => {
        const cartItem = cart[index];
        if (cartItem.customImages && cartItem.customImages.length > 0) {
          // Refresh token before uploading images
          await refreshToken();
          
          const imageData = await Promise.all(cartItem.customImages.map(async (image) => {
            if (!image.file) return null;

            const formData = new FormData();
            formData.append('images', image.file);
            formData.append('comments', JSON.stringify({ [image.file.name]: image.comment }));
            
            const response = await apiMethods.pos.uploadCustomImages(orderItem.id, [{
              file: image.file,
              comment: image.comment
            }]);

            if (!response.success) {
              console.error('Failed to upload image:', response.message);
              return null;
            }

            // Get the first uploaded image from the response data array
            const uploadedImage = response.data[0];
            if (!uploadedImage) {
              console.error('No image data in response');
              return null;
            }

            return {
              url: uploadedImage.url,
              comment: image.comment
            };
          }));

          // Filter out any failed uploads
          const validImages = imageData.filter(img => img !== null) as CustomImage[];
          if (validImages.length > 0) {
            // Update order item with image URLs if needed
            console.log('Images uploaded for order item:', orderItem.id, validImages);
          }
        }
      }));

      // Set initial order status based on requirements
      if (orderData.requiresDesign && orderData.requiresKitchen) {
        // If both design and kitchen are required, start with design
        await apiMethods.pos.updateOrderStatus(response.data.data.id, { 
          status: 'PENDING_DESIGN',
          notes: 'Order requires both design and kitchen. Starting with design.'
        });
      } else if (orderData.requiresDesign) {
        // If only design is required
        await apiMethods.pos.updateOrderStatus(response.data.data.id, { 
          status: 'PENDING_DESIGN',
          notes: 'Order requires design work.'
        });
      } else if (orderData.requiresKitchen) {
        // If only kitchen is required
        await apiMethods.pos.updateOrderStatus(response.data.data.id, { 
          status: 'PENDING_KITCHEN',
          notes: 'Order sent to kitchen.'
        });
      }

      toast.success('Order created successfully!');
      
      // Reset all form state
      setPaymentMethod('CASH');
      setPaymentReference('');
      setTeamSelection('KITCHEN');
      setDeliveryMethod('PICKUP');
      setCustomerDetails({
        name: "",
        email: "",
        phone: "",
      });
      setDeliveryDetails({
        date: "",
        timeSlot: "",
        instructions: "",
        streetAddress: "",
        apartment: "",
        emirate: "",
        city: "",
        charge: 0,
      });
      setPickupDetails({
        date: "",
        timeSlot: "",
      });
      setOrderItems([]);
      
      onCheckoutComplete();
      onClose();
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Failed to create order');
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
              <Dialog.Panel className="w-full max-w-6xl transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
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

                    <div className="flex flex-col lg:flex-row h-full space-y-8 lg:space-y-0 lg:space-x-8">
                      {/* Left Side - Delivery/Pickup & Team Selection */}
                      <div className="flex-1 lg:pr-8 lg:border-r">
                        {/* Delivery/Pickup Selection */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">Delivery/Pickup:</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <button
                              type="button"
                              onClick={() => setDeliveryMethod('PICKUP')}
                              className={`p-4 text-center border-2 rounded-lg flex items-center justify-center ${
                                deliveryMethod === 'PICKUP'
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200'
                              }`}
                            >
                              <div className={`w-6 h-6 border-2 rounded-full mr-3 flex items-center justify-center ${
                                deliveryMethod === 'PICKUP'
                                  ? 'border-blue-500 bg-blue-500'
                                  : 'border-gray-300'
                              }`}>
                                {deliveryMethod === 'PICKUP' && (
                                  <div className="w-3 h-3 bg-white rounded-full" />
                                )}
                              </div>
                              <span className="text-lg">Pickup</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeliveryMethod('DELIVERY')}
                              className={`p-4 text-center border-2 rounded-lg flex items-center justify-center ${
                                deliveryMethod === 'DELIVERY'
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200'
                              }`}
                            >
                              <div className={`w-6 h-6 border-2 rounded-full mr-3 flex items-center justify-center ${
                                deliveryMethod === 'DELIVERY'
                                  ? 'border-blue-500 bg-blue-500'
                                  : 'border-gray-300'
                              }`}>
                                {deliveryMethod === 'DELIVERY' && (
                                  <div className="w-3 h-3 bg-white rounded-full" />
                                )}
                              </div>
                              <span className="text-lg">Delivery</span>
                            </button>
                          </div>
                        </div>

                        {/* Delivery Form */}
                        {deliveryMethod === 'DELIVERY' && (
                          <div className="grid grid-cols-1 gap-4 pt-8">
                            <input
                              type="text"
                              value={deliveryDetails.streetAddress}
                              onChange={(e) => setDeliveryDetails(prev => ({ ...prev, streetAddress: e.target.value }))}
                              className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                              placeholder="Street Address *"
                            />

                            <input
                              type="text"
                              value={deliveryDetails.apartment}
                              onChange={(e) => setDeliveryDetails(prev => ({ ...prev, apartment: e.target.value }))}
                              className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                              placeholder="Apartment/Villa/Office (Optional)"
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <select
                                value={deliveryDetails.emirate}
                                onChange={handleEmirateChange}
                                className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                              >
                                <option value="">Select Emirate *</option>
                                {emirates.map((emirate) => (
                                  <option key={emirate} value={emirate}>{emirate.replace('_', ' ')}</option>
                                ))}
                              </select>

                              <input
                                type="text"
                                value={deliveryDetails.city}
                                onChange={(e) => setDeliveryDetails(prev => ({ ...prev, city: e.target.value }))}
                                className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                placeholder="City/Area *"
                              />
                            </div>

                            {deliveryDetails.emirate && (
                              <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <select
                                    value={deliveryDetails.date}
                                    onChange={(e) => setDeliveryDetails(prev => ({ ...prev, date: e.target.value }))}
                                    className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                  >
                                    <option value="">Select Date *</option>
                                    {getAvailableDates(deliveryDetails.emirate).map((date) => (
                                      <option key={date} value={date}>
                                        {new Date(date).toLocaleDateString('en-US', { 
                                          weekday: 'short', 
                                          month: 'short', 
                                          day: 'numeric' 
                                        })}
                                      </option>
                                    ))}
                                  </select>

                                  <select
                                    value={deliveryDetails.timeSlot}
                                    onChange={(e) => setDeliveryDetails(prev => ({ ...prev, timeSlot: e.target.value }))}
                                    className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                  >
                                    <option value="">Select Time Slot *</option>
                                    {getTimeSlots(deliveryDetails.emirate).map((slot) => (
                                      <option key={slot} value={slot}>{slot}</option>
                                    ))}
                                  </select>
                                </div>

                                <textarea
                                  value={deliveryDetails.instructions}
                                  onChange={(e) => setDeliveryDetails(prev => ({ ...prev, instructions: e.target.value }))}
                                  className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                  placeholder="Delivery Instructions (Optional)"
                                  rows={2}
                                />
                              </>
                            )}
                          </div>
                        )}

                        {/* Pickup Form */}
                        {deliveryMethod === 'PICKUP' && (
                          <div className="grid grid-cols-1 gap-4 pt-8">
                            <select
                              value={pickupDetails.date}
                              onChange={(e) => setPickupDetails(prev => ({ ...prev, date: e.target.value }))}
                              className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                            >
                              <option value="">Select Pickup Date *</option>
                              {getAvailableDates('DUBAI').map((date) => (
                                <option key={date} value={date}>
                                  {new Date(date).toLocaleDateString('en-US', { 
                                    weekday: 'short', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })}
                                </option>
                              ))}
                            </select>

                            <select
                              value={pickupDetails.timeSlot}
                              onChange={(e) => setPickupDetails(prev => ({ ...prev, timeSlot: e.target.value }))}
                              className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                            >
                              <option value="">Select Pickup Time *</option>
                              {getTimeSlots('DUBAI').map((slot) => (
                                <option key={slot} value={slot}>{slot}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Team Selection */}
                        <div className="mt-8 pt-8 border-t space-y-4">
                          <h3 className="text-lg font-semibold">Send Order To:</h3>
                          <div className="grid grid-cols-3 gap-4">
                            <button
                              type="button"
                              onClick={() => setTeamSelection('KITCHEN')}
                              className={`p-4 text-center border-2 rounded-lg flex items-center justify-center ${
                                teamSelection === 'KITCHEN'
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200'
                              }`}
                            >
                              <div className={`w-6 h-6 border-2 rounded-full mr-2 flex items-center justify-center ${
                                teamSelection === 'KITCHEN'
                                  ? 'border-blue-500 bg-blue-500'
                                  : 'border-gray-300'
                              }`}>
                                {teamSelection === 'KITCHEN' && (
                                  <div className="w-3 h-3 bg-white rounded-full" />
                                )}
                              </div>
                              <span className="text-base lg:text-lg">Kitchen</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setTeamSelection('DESIGN')}
                              className={`p-4 text-center border-2 rounded-lg flex items-center justify-center ${
                                teamSelection === 'DESIGN'
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200'
                              }`}
                            >
                              <div className={`w-6 h-6 border-2 rounded-full mr-2 flex items-center justify-center ${
                                teamSelection === 'DESIGN'
                                  ? 'border-blue-500 bg-blue-500'
                                  : 'border-gray-300'
                              }`}>
                                {teamSelection === 'DESIGN' && (
                                  <div className="w-3 h-3 bg-white rounded-full" />
                                )}
                              </div>
                              <span className="text-base lg:text-lg">Design</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setTeamSelection('BOTH')}
                              className={`p-4 text-center border-2 rounded-lg flex items-center justify-center ${
                                teamSelection === 'BOTH'
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200'
                              }`}
                            >
                              <div className={`w-6 h-6 border-2 rounded-full mr-2 flex items-center justify-center ${
                                teamSelection === 'BOTH'
                                  ? 'border-blue-500 bg-blue-500'
                                  : 'border-gray-300'
                              }`}>
                                {teamSelection === 'BOTH' && (
                                  <div className="w-3 h-3 bg-white rounded-full" />
                                )}
                              </div>
                              <span className="text-base lg:text-lg">Both Teams</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Right Side - Order Summary & Customer Details */}
                      <div className="flex-1 lg:pl-8">
                        {/* Order Summary */}
                        <div className="mb-8">
                          <h4 className="text-xl font-medium mb-6">Order Summary</h4>
                          <div className="max-h-[40vh] overflow-y-auto pr-4 space-y-6">
                            {cart.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-start justify-between p-4 bg-gray-50 rounded-lg"
                              >
                                <div className="flex-1">
                                  <p className="text-lg font-medium">{item.product.name}</p>
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
                                    <p className="text-sm text-gray-600 mt-2">
                                      Notes: {item.notes}
                                    </p>
                                  )}

                                  {/* Custom Images Upload */}
                                  <div className="mt-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <label className="text-sm font-medium text-gray-700">
                                        Custom Images
                                      </label>
                                      <span className="text-xs text-gray-500">
                                        Upload reference images for your order
                                      </span>
                                    </div>
                                    <ImageUpload
                                      onChange={(images) => {
                                        const updatedCart = cart.map(cartItem =>
                                          cartItem.id === item.id
                                            ? { ...cartItem, customImages: images }
                                            : cartItem
                                        );
                                        setCart(updatedCart);
                                      }}
                                      value={item.customImages || []}
                                    />
                                    {item.customImages && item.customImages.length > 0 && (
                                      <div className="mt-2 text-sm text-gray-500">
                                        {item.customImages.length} image{item.customImages.length !== 1 ? 's' : ''} added
                                      </div>
                                    )}
                                  </div>

                                  {/* Display existing custom images */}
                                  {item.customImages && item.customImages.length > 0 && (
                                    <div className="mt-3">
                                      <div className="flex gap-2 overflow-x-auto pb-2">
                                        {item.customImages.map((image, index) => (
                                          <div 
                                            key={index} 
                                            className="relative min-w-[80px] h-[80px] rounded-lg overflow-hidden bg-gray-100"
                                          >
                                            {image.file ? (
                                              <Image
                                                src={URL.createObjectURL(image.file)}
                                                alt={`Custom ${index + 1}`}
                                                fill
                                                className="object-cover"
                                              />
                                            ) : image.url ? (
                                              <Image
                                                src={image.url}
                                                alt={`Custom ${index + 1}`}
                                                fill
                                                className="object-cover"
                                              />
                                            ) : null}
                                            {image.comment && (
                                              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1">
                                                {image.comment}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <p className="text-lg font-medium ml-4">
                                  AED {item.totalPrice.toFixed(2)}
                                </p>
                              </div>
                            ))}
                          </div>

                          <div className="mt-6 pt-6 border-t">
                            <div className="flex justify-between items-center font-medium">
                              <p className="text-xl">Subtotal</p>
                              <p className="text-xl">AED {cartTotal.toFixed(2)}</p>
                            </div>
                            {deliveryMethod === 'DELIVERY' && deliveryDetails.emirate && (
                              <div className="flex justify-between items-center font-medium mt-2">
                                <p className="text-xl">Delivery Charge ({deliveryDetails.emirate.replace('_', ' ')})</p>
                                <p className="text-xl">AED {calculateDeliveryCharge(deliveryDetails.emirate).toFixed(2)}</p>
                              </div>
                            )}
                            <div className="flex justify-between items-center font-medium mt-4 pt-4 border-t">
                              <p className="text-xl font-bold">Total</p>
                              <p className="text-2xl font-bold">AED {calculateTotal().toFixed(2)}</p>
                            </div>
                          </div>
                        </div>

                        {/* Customer Details */}
                        <div className="mt-8 pt-8 border-t">
                          <h4 className="text-xl font-medium mb-6">Customer Details</h4>
                          <div className="space-y-6">
                            <div>
                              <input
                                type="text"
                                value={customerDetails.name}
                                onChange={(e) => setCustomerDetails(prev => ({ ...prev, name: e.target.value }))}
                                className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                placeholder="Name *"
                                required
                              />
                            </div>

                            <div>
                              <input
                                type="tel"
                                value={customerDetails.phone}
                                onChange={(e) => setCustomerDetails(prev => ({ ...prev, phone: e.target.value }))}
                                className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                placeholder="Phone *"
                                required
                              />
                            </div>

                            <div>
                              <input
                                type="email"
                                value={customerDetails.email}
                                onChange={(e) => setCustomerDetails(prev => ({ ...prev, email: e.target.value }))}
                                className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
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
                                  onClick={() => setPaymentMethod('CARD')}
                                  className={`p-6 text-lg font-medium rounded-xl border-2 transition-all ${
                                    paymentMethod === 'CARD'
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
                                className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                              />
                            </div>

                            <div className="mt-8">
                              <button
                                type="button"
                                onClick={handleCheckout}
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
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
