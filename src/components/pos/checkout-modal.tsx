"use client";

import { Fragment, useState, useEffect, useRef, useCallback } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { X, Search, User, MapPin } from "lucide-react";
import { toast } from "react-hot-toast";
import { apiMethods, type CustomImage, type POSOrderData, type POSOrderStatus } from "@/services/api";
import Image from "next/image";
import ImageUpload from "./custom-images/image-upload";
import { useAuth } from "@/providers/auth-provider";
import debounce from 'lodash/debounce';

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

interface CustomerAddress {
  id: string;
  street: string;
  apartment: string;
  emirate: string;
  city: string;
  country: string;
  pincode: string;
  isDefault: boolean;
  type: string;
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addresses: CustomerAddress[];
  reward: {
    points: number;
  };
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
  const [giftDetails, setGiftDetails] = useState({
    isGift: false,
    recipientName: '',
    recipientPhone: '',
    message: '',
    note: '',
    cashAmount: 0,
    includeCash: false
  });
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
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
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerAddresses, setCustomerAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<CustomerAddress | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  // Close search results when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search customers with debounce
  const searchCustomers = useCallback(async (query: string) => {
    if (!query) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await apiMethods.pos.searchCustomers(query);
      if (response.success) {
        // Transform the response to match Customer type
        const customersWithAddresses = response.data.map(customer => ({
          ...customer,
          addresses: [] as CustomerAddress[] // Initialize empty addresses array
        }));
        setSearchResults(customersWithAddresses);
        setShowSearchResults(true);
      }
    } catch (error) {
      console.error('Error searching customers:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Handle customer selection
  const handleCustomerSelect = async (customer: Customer) => {
    setCustomerDetails({
      name: `${customer.firstName} ${customer.lastName}`.trim(),
      email: customer.email || "",
      phone: customer.phone || "",
    });
    setSelectedCustomer(customer);
    setShowSearchResults(false);
    setSearchResults([]);

    // Fetch customer addresses if needed
    try {
      const addressResponse = await apiMethods.pos.getCustomerAddresses(customer.id);
      if (addressResponse.success) {
        const addresses = addressResponse.data;
        setCustomerAddresses(addresses);
        
        // Update customer with addresses
        setSelectedCustomer(prev => prev ? { ...prev, addresses } : null);
        
        // If delivery method is selected, auto-select default address
        if (deliveryMethod === 'DELIVERY' && addresses.length > 0) {
          const defaultAddress = addresses.find(addr => addr.isDefault) || addresses[0];
          setSelectedAddress(defaultAddress);
          setDeliveryDetails(prev => ({
            ...prev,
            streetAddress: defaultAddress.street,
            apartment: defaultAddress.apartment,
            emirate: defaultAddress.emirate,
            city: defaultAddress.city || 'Dubai'
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching customer addresses:', error);
    }
  };

  // Handle address selection
  const handleAddressSelect = (address: CustomerAddress) => {
    setSelectedAddress(address);
    setDeliveryDetails(prev => ({
      ...prev,
      streetAddress: address.street,
      apartment: address.apartment,
      emirate: address.emirate,
      city: address.city || 'Dubai'
    }));
  };

  // Update delivery method
  const handleDeliveryMethodChange = (method: 'PICKUP' | 'DELIVERY') => {
    setDeliveryMethod(method);
    
    // If switching to delivery and customer has addresses, auto-select default
    if (method === 'DELIVERY' && selectedCustomer?.addresses?.length > 0) {
      const defaultAddress = selectedCustomer.addresses.find(addr => addr.isDefault) || selectedCustomer.addresses[0];
      setSelectedAddress(defaultAddress);
      setDeliveryDetails(prev => ({
        ...prev,
        streetAddress: defaultAddress.street,
        apartment: defaultAddress.apartment,
        emirate: defaultAddress.emirate,
        city: defaultAddress.city || 'Dubai'
      }));
    }
  };

  // Handle customer name change with search
  const handleCustomerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomerDetails(prev => ({ ...prev, name: value }));
    searchCustomers(value);
  };

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
    const baseTotal = parseFloat(cartTotal.toString());
    console.log('Base Total:', baseTotal);
    
    if (isNaN(baseTotal)) {
      console.error('Invalid cart total:', cartTotal);
      return 0;
    }
    
    let total = baseTotal;
    
    // Add delivery charge if applicable
    if (deliveryMethod === 'DELIVERY') {
      const deliveryCharge = calculateDeliveryCharge(deliveryDetails.emirate);
      console.log('Delivery Charge:', deliveryCharge);
      total += deliveryCharge;
    }
    
    // Apply coupon discount if any
    if (appliedCoupon) {
      console.log('Applied Coupon:', appliedCoupon);
      const couponValue = parseFloat(appliedCoupon.value.toString());
      
      if (!isNaN(couponValue)) {
        const discount = appliedCoupon.type === 'PERCENTAGE'
          ? (total * couponValue) / 100
          : couponValue;
        console.log('Calculated Discount:', discount);
        total = Math.max(0, total - discount);
      } else {
        console.error('Invalid coupon value:', appliedCoupon.value);
      }
    }
    
    console.log('Final Total:', total);
    return total;
  };

  // Calculate coupon discount for display
  const calculateCouponDiscount = () => {
    if (!appliedCoupon) return 0;
    
    const baseAmount = parseFloat(cartTotal.toString());
    if (isNaN(baseAmount)) {
      console.error('Invalid cart total for coupon:', cartTotal);
      return 0;
    }
    
    const couponValue = parseFloat(appliedCoupon.value.toString());
    if (isNaN(couponValue)) {
      console.error('Invalid coupon value:', appliedCoupon.value);
      return 0;
    }
    
    const discount = appliedCoupon.type === 'PERCENTAGE'
      ? (baseAmount * couponValue) / 100
      : couponValue;
      
    console.log('Coupon Discount Calculation:', {
      baseAmount,
      couponValue,
      type: appliedCoupon.type,
      calculatedDiscount: discount
    });
    
    return Math.min(discount, baseAmount);
  };

  // Update emirate and recalculate total
  const handleEmirateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDeliveryDetails(prev => ({ ...prev, emirate: e.target.value }));
  };

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    
    setIsValidatingCoupon(true);
    setCouponError('');
    
    try {
      const response = await apiMethods.pos.validateCoupon(couponCode, cartTotal);
      console.log('Coupon Response:', response);
      
      if (!response.success) {
        setCouponError(response.message || 'Invalid coupon code');
        setAppliedCoupon(null);
        return;
      }
      
      // Parse numeric values and validate
      const parsedValue = parseFloat(response.data.value);
      const parsedDiscount = parseFloat(response.data.discount);
      
      if (isNaN(parsedValue)) {
        console.error('Invalid coupon value:', response.data.value);
        setCouponError('Invalid coupon value');
        setAppliedCoupon(null);
        return;
      }

      // Create coupon data with validated numbers
      const couponData = {
        ...response.data,
        value: parsedValue,
        discount: parsedDiscount || 0
      };
      
      console.log('Parsed Coupon Data:', couponData);
      setAppliedCoupon(couponData);
      
    } catch (error) {
      console.error('Error validating coupon:', error);
      setCouponError('Failed to validate coupon');
      setAppliedCoupon(null);
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
  };

  const handleCreateCustomer = async () => {
    try {
      const response = await apiMethods.pos.createOrUpdateCustomer({
        customerName: customerDetails.name,
        customerPhone: customerDetails.phone,
        customerEmail: customerDetails.email,
        deliveryAddress: deliveryMethod === 'DELIVERY' ? {
          streetAddress: deliveryDetails.streetAddress,
          apartment: deliveryDetails.apartment,
          emirate: deliveryDetails.emirate,
          city: deliveryDetails.city
        } : undefined
      });

      if (!response.success || !response.data.customer) {
        return false;
      }

      // Update selected customer with the response
      const newCustomer: Customer = {
        id: response.data.customer.id,
        firstName: response.data.customer.firstName,
        lastName: response.data.customer.lastName,
        email: response.data.customer.email,
        phone: response.data.customer.phone,
        addresses: response.data.customer.addresses,
        reward: response.data.customer.reward
      };
      
      setSelectedCustomer(newCustomer);
      setCustomerAddresses(response.data.customer.addresses);

      // If delivery method is selected and we have addresses, select the first one
      if (deliveryMethod === 'DELIVERY' && response.data.customer.addresses.length > 0) {
        const defaultAddress = response.data.customer.addresses.find(addr => addr.isDefault) 
          || response.data.customer.addresses[0];
        setSelectedAddress(defaultAddress);
      }

      return true;
    } catch (error) {
      console.error('Error creating/updating customer:', error);
      return false;
    }
  };

  const handleCheckout = async () => {
    try {
      // Validate pickup/delivery details first
      if (deliveryMethod === 'DELIVERY') {
        if (!deliveryDetails.emirate || !deliveryDetails.streetAddress) {
          toast.error('Please fill in all delivery details');
          return;
        }
      } else if (deliveryMethod === 'PICKUP') {
        if (!pickupDetails.date || !pickupDetails.timeSlot) {
          toast.error('Please select both pickup date and time');
          return;
        }
      }

      // Create or update customer if we have customer details
      if (customerDetails.name && customerDetails.phone) {
        if (!await handleCreateCustomer()) {
          // Continue with order creation even if customer update fails
        }
      }

      const total = calculateTotal();
      const baseTotal = parseFloat(cartTotal.toString());
      
      // Calculate coupon discount
      let couponDiscount = 0;
      if (appliedCoupon) {
        const couponValue = parseFloat(appliedCoupon.value.toString());
        couponDiscount = appliedCoupon.type === 'PERCENTAGE'
          ? (baseTotal * couponValue) / 100
          : couponValue;
      }

      // Format variations as a Record object
      const orderItems = cart.map(item => {
        const variations = item.selectedVariations.reduce((acc, v) => ({
          ...acc,
          [v.type]: {
            id: v.id,
            value: v.value,
            priceAdjustment: v.priceAdjustment
          }
        }), {});

        return {
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.basePrice,
          totalPrice: item.totalPrice,
          variations,
          notes: item.notes,
          customImages: item.customImages?.map(img => ({
            url: img.url!,
            comment: img.comment
          }))
        };
      });

      const orderData: POSOrderData = {
        items: orderItems,
        totalAmount: total,
        paidAmount: paymentMethod === 'CASH' ? total : total,
        changeAmount: paymentMethod === 'CASH' ? 0 : 0,
        paymentMethod,
        customerName: customerDetails.name || undefined,
        customerPhone: customerDetails.phone || undefined,
        customerEmail: customerDetails.email || undefined,
        deliveryMethod,
        ...(deliveryMethod === 'DELIVERY' ? {
          deliveryCharge: calculateDeliveryCharge(deliveryDetails.emirate),
          streetAddress: deliveryDetails.streetAddress,
          apartment: deliveryDetails.apartment,
          emirate: deliveryDetails.emirate,
          city: deliveryDetails.city || 'Dubai'
        } : {}),
        ...(deliveryMethod === 'PICKUP' ? {
          pickupDate: pickupDetails.date,
          pickupTimeSlot: pickupDetails.timeSlot
        } : {}),
        // Add coupon information if present
        ...(appliedCoupon ? {
          couponCode: appliedCoupon.code,
          couponDiscount: couponDiscount,
          couponType: appliedCoupon.type
        } : {})
      };

      console.log('Sending order data:', JSON.stringify(orderData, null, 2));
      const response = await apiMethods.pos.createOrder(orderData);

      if (response.data.success) {
        // If it's a cash payment, open the drawer and record the transaction
        if (paymentMethod === 'CASH') {
          try {
            const orderId = response.data.data.id;
            const orderNumber = response.data.data.orderNumber;
            console.log('Processing cash payment for order:', orderId, orderNumber);
            
            try {
              // Open cash drawer with string amount
              console.log('Opening cash drawer...');
              const drawerResponse = await apiMethods.pos.openDrawer(
                orderData.totalAmount.toFixed(2),
                `Order #${orderNumber}`
              );
              console.log('Cash drawer response:', drawerResponse);
            } catch (drawerError) {
              console.error('Failed to open cash drawer:', drawerError);
            }
            
            try {
              // Record cash transaction with string amount
              console.log('Recording cash payment...');
              const paymentResponse = await apiMethods.pos.addDrawerOperation(
                'CASH_IN',
                orderData.paidAmount.toFixed(2),
                `Cash payment for Order #${orderNumber}`
              );
              console.log('Payment record response:', paymentResponse);
            } catch (paymentError) {
              console.error('Failed to record cash payment:', paymentError);
            }

            // If change is needed, record that too
            if (orderData.changeAmount > 0) {
              try {
                console.log('Recording change given...');
                const changeResponse = await apiMethods.pos.addDrawerOperation(
                  'CASH_OUT',
                  orderData.changeAmount.toFixed(2),
                  `Change for Order #${orderNumber}`
                );
                console.log('Change record response:', changeResponse);
              } catch (changeError) {
                console.error('Failed to record change:', changeError);
              }
            }
          } catch (drawerError) {
            console.error('Error handling cash drawer operations:', drawerError);
            // Show error but don't block order completion
            toast.error('Failed to process cash drawer operations. Please record this transaction manually.');
          }
        }

        toast.success('Order created successfully!');
        setCart([]);
        onCheckoutComplete();
        onClose();
      } else {
        toast.error(response.data.message || 'Failed to create order');
      }
    } catch (error: any) {
      console.error('Error creating order:', error);
      // Log the response data if available
      if (error.response?.data) {
        console.error('Server error details:', error.response.data);
      }
      toast.error(error.response?.data?.message || 'Failed to create order');
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
                      {/* Left Side - Customer Details & Delivery/Pickup */}
                      <div className="flex-1 lg:pr-8 lg:border-r">
                        {/* Customer Details */}
                        <div className="space-y-4 mb-8">
                          <h3 className="text-lg font-semibold">Customer Details:</h3>
                          <div ref={searchRef} className="relative">
                            <div className="relative">
                              <input
                                type="text"
                                value={customerDetails.name}
                                onChange={handleCustomerNameChange}
                                className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4 pl-12"
                                placeholder="Customer Name *"
                              />
                              <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                            </div>

                            {/* Search Results Dropdown */}
                            {showSearchResults && (
                              <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200">
                                {isSearching ? (
                                  <div className="p-4 text-center text-gray-500">
                                    Searching...
                                  </div>
                                ) : searchResults.length > 0 ? (
                                  <ul className="max-h-60 overflow-auto">
                                    {searchResults.map((customer) => (
                                      <li
                                        key={customer.id}
                                        className="p-4 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                                        onClick={() => handleCustomerSelect(customer)}
                                      >
                                        <div className="font-medium">
                                          {customer.firstName} {customer.lastName}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                          {customer.phone}
                                          {customer.email && ` • ${customer.email}`}
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <div className="p-4 text-center text-gray-500">
                                    No customers found
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                              type="tel"
                              value={customerDetails.phone}
                              onChange={(e) => setCustomerDetails(prev => ({ ...prev, phone: e.target.value }))}
                              className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                              placeholder="Phone Number *"
                            />
                            <input
                              type="email"
                              value={customerDetails.email}
                              onChange={(e) => setCustomerDetails(prev => ({ ...prev, email: e.target.value }))}
                              className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                              placeholder="Email (Optional)"
                            />
                          </div>
                        </div>

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


 {/* Gift Section */}
 <div className="mt-6 space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium text-gray-900">Send as a Gift</h3>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={giftDetails.isGift}
                                onChange={(e) => setGiftDetails(prev => ({ ...prev, isGift: e.target.checked }))}
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          </div>

                          {giftDetails.isGift && (
                            <div className="space-y-4">
                              <input
                                type="text"
                                value={giftDetails.recipientName}
                                onChange={(e) => setGiftDetails(prev => ({ ...prev, recipientName: e.target.value }))}
                                className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                placeholder="Recipient Name *"
                              />

                              <input
                                type="tel"
                                value={giftDetails.recipientPhone}
                                onChange={(e) => setGiftDetails(prev => ({ ...prev, recipientPhone: e.target.value }))}
                                className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                placeholder="Recipient Phone *"
                              />

                              <textarea
                                value={giftDetails.message}
                                onChange={(e) => setGiftDetails(prev => ({ ...prev, message: e.target.value }))}
                                className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                placeholder="Gift Message (Optional)"
                                rows={2}
                              />

                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="includeCash"
                                  checked={giftDetails.includeCash}
                                  onChange={(e) => setGiftDetails(prev => ({ ...prev, includeCash: e.target.checked }))}
                                  className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                                />
                                <label htmlFor="includeCash" className="text-sm font-medium text-gray-900">
                                  Include Cash Gift
                                </label>
                              </div>
                              
                              {giftDetails.includeCash && (
                                <div className="relative">
                                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <span className="text-gray-500 text-lg">AED</span>
                                  </div>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={giftDetails.cashAmount}
                                    onChange={(e) => setGiftDetails(prev => ({ ...prev, cashAmount: parseFloat(e.target.value) || 0 }))}
                                    className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4 pl-16"
                                    placeholder="Cash Amount"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                       

                        {/* Team Selection */}
                        {/* <div className="mt-8 pt-8 border-t space-y-4">
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
                        </div> */}
                      </div>

                      {/* Right Side - Order Summary */}
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
                            {appliedCoupon && (
                              <div className="flex justify-between items-center font-medium mt-2">
                                <p className="text-xl">Coupon Discount ({appliedCoupon.code})</p>
                                <p className="text-xl">
                                  AED {calculateCouponDiscount().toFixed(2)}
                                </p>
                              </div>
                            )}
                            <div className="flex justify-between items-center font-medium mt-4 pt-4 border-t">
                              <p className="text-xl font-bold">Total</p>
                              <p className="text-2xl font-bold">AED {calculateTotal().toFixed(2)}</p>
                            </div>
                          </div>
                        </div>

 {/* Coupon Section */}
 <div className="mt-6 space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium text-gray-900">Apply Coupon</h3>
                          </div>
                          <div className="flex space-x-2">
                            <input
                              type="text"
                              value={couponCode}
                              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                              className="flex-1 rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                              placeholder="Enter Coupon Code"
                            />
                            <button
                              onClick={handleApplyCoupon}
                              disabled={!couponCode || isValidatingCoupon}
                              className="px-6 py-4 bg-black text-white rounded-xl hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
                            >
                              {isValidatingCoupon ? 'Validating...' : 'Apply'}
                            </button>
                          </div>
                          {couponError && (
                            <p className="text-red-500">{couponError}</p>
                          )}
                          {appliedCoupon && (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                              <div className="flex justify-between items-center">
                                <div>
                                  <p className="text-green-700 font-medium">{appliedCoupon.code}</p>
                                  <p className="text-green-600 text-sm">
                                    {appliedCoupon.type === 'PERCENTAGE' 
                                      ? `${appliedCoupon.value}% off`
                                      : `AED ${appliedCoupon.value} off`
                                    }
                                  </p>
                                </div>
                                <button
                                  onClick={handleRemoveCoupon}
                                  className="text-green-700 hover:text-green-800"
                                >
                                  <X className="h-5 w-5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>


                        {/* Payment Method */}
                        <div className="mt-8 pt-8 border-t">
                          <h4 className="text-xl font-medium mb-6">Payment Method</h4>
                          <div className="space-y-4">
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
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
