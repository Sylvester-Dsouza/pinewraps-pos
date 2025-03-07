"use client";

import { Fragment, useState, useEffect, useRef, useCallback } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { X, Minus, Plus, Trash, Search, ShoppingCart, Upload, Camera, User, MapPin, ListOrdered } from "lucide-react";
import { toast } from "react-hot-toast";
import { apiMethods, type POSOrderData, type POSOrderStatus } from "@/services/api";
import Image from "next/image";
import ImageUpload from "./custom-images/image-upload";
import { useAuth } from "@/providers/auth-provider";
import debounce from 'lodash/debounce';
import { CartItem, CustomImage } from "@/types/cart";
import { nanoid } from 'nanoid';

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

interface CheckoutDetails {
  customerDetails: {
    name: string;
    email: string;
    phone: string;
  };
  deliveryMethod: 'PICKUP' | 'DELIVERY';
  deliveryDetails: {
    date: string;
    timeSlot: string;
    instructions: string;
    streetAddress: string;
    apartment: string;
    emirate: string;
    city: string;
    charge: number;
  };
  pickupDetails: {
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
  paymentMethod: 'CASH' | 'CARD';
  paymentReference: string;
  orderSummary: {
    totalItems: number;
    products: {
      id: string;
      productId: string;
      productName: string;
      quantity: number;
      price: number;
      unitPrice: number;
      sku: string;
      requiresKitchen: boolean;
      requiresDesign: boolean;
      hasVariations: boolean;
      hasCustomImages: boolean;
    }[];
    totalAmount: number;
  };
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  setCart: (cart: CartItem[]) => void;
  cartTotal: number;
  onCheckoutComplete?: (checkoutDetails: CheckoutDetails) => void;
  onQueueOrder?: (checkoutDetails: CheckoutDetails) => void;
  onSaveCheckoutDetails?: (checkoutDetails: CheckoutDetails) => void;
  customerDetails?: {
    name: string;
    email: string;
    phone: string;
  };
  deliveryMethod?: 'PICKUP' | 'DELIVERY';
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
  giftDetails?: {
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

export default function CheckoutModal({
  isOpen,
  onClose,
  cart,
  setCart,
  cartTotal,
  onCheckoutComplete,
  onQueueOrder,
  onSaveCheckoutDetails,
  customerDetails,
  deliveryMethod,
  deliveryDetails,
  pickupDetails,
  giftDetails,
  paymentMethod,
  paymentReference
}: CheckoutModalProps) {
  const { refreshToken } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethodState, setPaymentMethodState] = useState<'CASH' | 'CARD'>('CASH');
  const [paymentReferenceState, setPaymentReferenceState] = useState('');
  const [teamSelection, setTeamSelection] = useState<'KITCHEN' | 'DESIGN' | 'BOTH'>('KITCHEN');
  const [deliveryMethodState, setDeliveryMethodState] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [customerDetailsState, setCustomerDetailsState] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [giftDetailsState, setGiftDetailsState] = useState({
    isGift: false,
    recipientName: '',
    recipientPhone: '',
    message: '',
    note: '',
    cashAmount: 0,
    includeCash: false
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [deliveryDetailsState, setDeliveryDetailsState] = useState({
    date: "",
    timeSlot: "",
    instructions: "",
    streetAddress: "",
    apartment: "",
    emirate: "",
    city: "",
    charge: 0,
  });
  const [pickupDetailsState, setPickupDetailsState] = useState({
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
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customerAddresses, setCustomerAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<CustomerAddress | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  // Debug cart items function (moved outside useEffect)
  const debugCartItems = () => {
    if (!Array.isArray(cart) || cart.length === 0) {
      console.warn('Cart is empty or not an array:', cart);
      return;
    }
    
    console.log(`Cart has ${cart.length} items`);
    cart.forEach((item, index) => {
      console.log(`Cart item ${index}:`, JSON.stringify(item, null, 2));
      
      // Check for missing or invalid product
      if (!item.product) {
        console.error(`Cart item ${index} is missing product:`, item);
      } else {
        console.log(`Product details for item ${index}:`, JSON.stringify(item.product, null, 2));
      }
      
      // Check for missing or invalid selectedVariations
      if (!item.selectedVariations || !Array.isArray(item.selectedVariations)) {
        console.warn(`Cart item ${index} has invalid selectedVariations:`, item.selectedVariations);
      } else if (item.selectedVariations.length > 0) {
        console.log(`Selected variations for item ${index}:`, JSON.stringify(item.selectedVariations, null, 2));
      }
      
      // Check for missing or invalid customImages
      if (!item.customImages || !Array.isArray(item.customImages)) {
        console.warn(`Cart item ${index} has invalid customImages:`, item.customImages);
      } else if (item.customImages.length > 0) {
        console.log(`Custom images for item ${index}:`, JSON.stringify(item.customImages, null, 2));
      }
    });
  };

  // Call debugCartItems whenever cart changes
  useEffect(() => {
    if (isOpen && Array.isArray(cart)) {
      debugCartItems();
    }
  }, [cart, isOpen]);

  // Debug cart items when they change
  useEffect(() => {
    if (cart && cart.length > 0) {
      console.log('Cart items in checkout modal:', cart.length);
      
      // Check for items with custom images
      const itemsWithCustomImages = cart.filter(item => 
        item.customImages && Array.isArray(item.customImages) && item.customImages.length > 0
      );
      
      if (itemsWithCustomImages.length > 0) {
        console.log(`Found ${itemsWithCustomImages.length} items with custom images`);
        itemsWithCustomImages.forEach((item, index) => {
          console.log(`Item ${index + 1} custom images:`, item.customImages);
        });
      } else {
        console.log('No items with custom images found');
      }
      
      // Check for items that allow custom images
      const itemsAllowingCustomImages = cart.filter(item => 
        item.product?.allowCustomImages === true
      );
      
      if (itemsAllowingCustomImages.length > 0) {
        console.log(`Found ${itemsAllowingCustomImages.length} items that allow custom images`);
      } else {
        console.log('No items that allow custom images found');
      }
    }
  }, [cart]);

  // Save checkout details whenever they change
  useEffect(() => {
    if (isOpen && onSaveCheckoutDetails) {
      // Use a debounce mechanism to prevent too frequent updates
      const timeoutId = setTimeout(() => {
        const details = getFormattedCheckoutDetails();
        onSaveCheckoutDetails(details);
      }, 500); // 500ms debounce
      
      return () => clearTimeout(timeoutId);
    }
  }, [
    isOpen, 
    customerDetailsState, 
    deliveryMethodState, 
    // We're still watching these states, but the debounce will prevent rapid updates
    deliveryDetailsState, 
    pickupDetailsState, 
    giftDetailsState, 
    paymentMethodState, 
    paymentReferenceState,
    onSaveCheckoutDetails
  ]);

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

  // Search for customers by name or phone
  const searchCustomers = async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      setShowSearchResults(false);
      setIsSearching(false);
      return;
    }

    try {
      const response = await apiMethods.pos.searchCustomers(query);
      if (response.success && response.data) {
        setSearchResults(response.data);
        setShowSearchResults(true);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching customers:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Create debounced search function
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      searchCustomers(query);
    }, 500),
    []
  );

  // Handle customer selection
  const handleCustomerSelect = async (customer: any) => {
    setCustomerDetailsState({
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
        if (deliveryMethodState === 'DELIVERY' && addresses.length > 0) {
          const defaultAddress = addresses.find(addr => addr.isDefault) || addresses[0];
          setSelectedAddress(defaultAddress);
          setDeliveryDetailsState(prev => ({
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
    setDeliveryDetailsState(prev => ({
      ...prev,
      streetAddress: address.street,
      apartment: address.apartment,
      emirate: address.emirate,
      city: address.city || 'Dubai'
    }));
  };

  // Update delivery method
  const handleDeliveryMethodChange = (method: 'PICKUP' | 'DELIVERY') => {
    setDeliveryMethodState(method);
    
    // If switching to delivery and customer has addresses, auto-select default
    if (method === 'DELIVERY' && selectedCustomer?.addresses?.length > 0) {
      const defaultAddress = selectedCustomer.addresses.find(addr => addr.isDefault) || selectedCustomer.addresses[0];
      setSelectedAddress(defaultAddress);
      setDeliveryDetailsState(prev => ({
        ...prev,
        streetAddress: defaultAddress.street,
        apartment: defaultAddress.apartment,
        emirate: defaultAddress.emirate,
        city: defaultAddress.city || 'Dubai'
      }));
    }
  };

  // Handle customer name change and search
  const handleCustomerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomerDetailsState(prev => ({ ...prev, name: value }));
    
    if (value.length >= 3) {
      setIsSearching(true);
      debouncedSearch(value);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
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

  // Calculate total with delivery charge and discounts
  const calculateTotal = () => {
    let baseTotal = cartTotal;
    
    // Apply coupon discount if any
    if (appliedCoupon) {
      if (appliedCoupon.type === 'PERCENTAGE') {
        const discountAmount = (baseTotal * appliedCoupon.value) / 100;
        baseTotal -= discountAmount;
      } else if (appliedCoupon.type === 'FIXED') {
        baseTotal -= appliedCoupon.value;
      }
    }
    
    let total = baseTotal;
    
    // Add delivery charge if applicable
    if (deliveryMethodState === 'DELIVERY' && deliveryDetailsState.emirate) {
      const deliveryCharge = deliveryDetailsState.charge !== undefined ? 
        deliveryDetailsState.charge : 
        calculateDeliveryCharge(deliveryDetailsState.emirate);
      console.log('Delivery Charge:', deliveryCharge);
      total += deliveryCharge;
    }
    
    return total;
  };

  // Calculate coupon discount for display
  const calculateCouponDiscount = () => {
    if (!appliedCoupon) return 0;
    
    const baseAmount = cartTotal;
    if (isNaN(baseAmount)) {
      console.error('Invalid cart total for coupon:', cartTotal);
      return 0;
    }
    
    const couponValue = appliedCoupon.value;
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
    const selectedEmirate = e.target.value;
    const defaultCharge = calculateDeliveryCharge(selectedEmirate);
    
    setDeliveryDetailsState(prevState => ({
      ...prevState,
      emirate: selectedEmirate,
      // Reset time slot when emirate changes
      timeSlot: "",
      // Set delivery charge based on emirate
      charge: defaultCharge
    }));
    
    console.log(`Updated emirate to ${selectedEmirate} with default charge: ${defaultCharge}`);
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
      const parsedValue = parseFloat(String(response.data.value));
      const parsedDiscount = parseFloat(String(response.data.discount));
      
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

  // Create or update customer
  const handleCreateCustomer = async (): Promise<boolean> => {
    try {
      if (!customerDetailsState.name || !customerDetailsState.phone) {
        return false;
      }

      // Split name into first and last name
      const [firstName, lastName] = customerDetailsState.name.trim().split(' ');
      const customerData = {
        customerName: customerDetailsState.name || '',
        customerPhone: customerDetailsState.phone || '',
        customerEmail: customerDetailsState.email || '',
      };

      const response = await apiMethods.pos.createOrUpdateCustomer(customerData);
      return response.success;
    } catch (error) {
      console.error('Error creating/updating customer:', error);
      return false;
    }
  };

  const handleCheckout = async () => {
    try {
      // Validate pickup/delivery details first
      if (deliveryMethodState === 'DELIVERY') {
        if (!deliveryDetailsState.emirate || !deliveryDetailsState.streetAddress) {
          toast.error('Please fill in all delivery details');
          return;
        }
      } else if (deliveryMethodState === 'PICKUP') {
        if (!pickupDetailsState.date || !pickupDetailsState.timeSlot) {
          toast.error('Please select both pickup date and time');
          return;
        }
      }

      // Create or update customer if we have customer details
      if (customerDetailsState.name && customerDetailsState.phone) {
        if (!await handleCreateCustomer()) {
          // Continue with order creation even if customer update fails
        }
      }

      setIsSubmitting(true);

      // Format cart items for order
      const orderItems = cart.map(item => {
        // Process custom images to ensure they're properly formatted
        const processedCustomImages = Array.isArray(item.customImages) 
          ? item.customImages.map(img => ({
              id: img.id || nanoid(),
              url: img.url || '',
              previewUrl: img.previewUrl || '',
              comment: img.comment || ''
            }))
          : [];
          
        console.log(`Processing custom images for item ${item.id}:`, processedCustomImages);
        
        return {
          id: item.id,
          productId: item.product.id,
          productName: item.product.name,
          unitPrice: item.product.basePrice,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
          selectedVariations: item.selectedVariations.map(variation => ({
            id: variation.id,
            type: variation.type,
            value: variation.value,
            price: variation.priceAdjustment // Map priceAdjustment to price
          })),
          notes: item.notes || '',
          customImages: processedCustomImages,
          metadata: {
            ...(item.metadata || {}),
            allowCustomImages: item.product.allowCustomImages || false
          }
        };
      });

      const total = calculateTotal();
      const baseTotal = cartTotal;
      
      // Calculate coupon discount
      let couponDiscount = 0;
      if (appliedCoupon) {
        const couponValue = appliedCoupon.value;
        couponDiscount = appliedCoupon.type === 'PERCENTAGE'
          ? (baseTotal * couponValue) / 100
          : couponValue;
      }

      // Prepare order data
      const orderData: POSOrderData = {
        items: orderItems,
        totalAmount: total,
        paidAmount: paymentMethodState === 'CASH' ? total : total,
        changeAmount: paymentMethodState === 'CASH' ? 0 : 0,
        paymentMethod: paymentMethodState,
        customerName: customerDetailsState.name || undefined,
        customerPhone: customerDetailsState.phone || undefined,
        customerEmail: customerDetailsState.email || undefined,
        deliveryMethod: deliveryMethodState,
        ...(deliveryMethodState === 'DELIVERY' ? {
          deliveryCharge: deliveryDetailsState.charge !== undefined ? 
            deliveryDetailsState.charge : 
            calculateDeliveryCharge(deliveryDetailsState.emirate),
          streetAddress: deliveryDetailsState.streetAddress,
          apartment: deliveryDetailsState.apartment,
          emirate: deliveryDetailsState.emirate,
          city: deliveryDetailsState.city || 'Dubai',
          date: deliveryDetailsState.date,
          timeSlot: deliveryDetailsState.timeSlot,
          instructions: deliveryDetailsState.instructions || ''
        } : {}),
        ...(deliveryMethodState === 'PICKUP' ? {
          pickupDate: pickupDetailsState.date,
          pickupTimeSlot: pickupDetailsState.timeSlot
        } : {}),
        // Add coupon information if present
        ...(appliedCoupon ? {
          couponCode: appliedCoupon.code,
          couponDiscount
        } : {})
      };

      // Create the order
      const response = await apiMethods.pos.createOrder(orderData);

      if (response.data.success) {
        // If it's a cash payment, open the drawer and record the transaction
        if (paymentMethodState === 'CASH') {
          try {
            const orderId = response.data.data.id;
            const orderNumber = response.data.data.orderNumber;
            
            await apiMethods.pos.openDrawer(
              String(total),
              `Payment for order #${orderNumber}`
            );
          } catch (error) {
            console.error('Error opening cash drawer:', error);
            // Continue even if drawer fails to open
          }
        }

        toast.success('Order created successfully!');
        setCart([]);
        if (onCheckoutComplete) {
          onCheckoutComplete(getFormattedCheckoutDetails());
        }
        onClose();
        resetCheckoutState();
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

  // Reset all checkout state
  const resetCheckoutState = useCallback(() => {
    setPaymentMethodState('CASH');
    setPaymentReferenceState('');
    setTeamSelection('KITCHEN');
    setDeliveryMethodState('PICKUP');
    setCustomerDetailsState({
      name: "",
      email: "",
      phone: "",
    });
    setGiftDetailsState({
      isGift: false,
      recipientName: '',
      recipientPhone: '',
      message: '',
      note: '',
      cashAmount: 0,
      includeCash: false
    });
    setSearchQuery('');
    setIsSearching(false);
    setSearchResults([]);
    setShowSearchResults(false);
    setDeliveryDetailsState({
      date: "",
      timeSlot: "",
      instructions: "",
      streetAddress: "",
      apartment: "",
      emirate: "",
      city: "",
      charge: 0,
    });
    setPickupDetailsState({
      date: "",
      timeSlot: "",
    });
    setOrderItems([]);
    setSelectedCustomer(null);
    setCustomerAddresses([]);
    setSelectedAddress(null);
    setCouponCode('');
    setIsValidatingCoupon(false);
    setCouponError('');
    setAppliedCoupon(null);
  }, []);

  // Reset state when modal is closed
  useEffect(() => {
    if (!isOpen) {
      resetCheckoutState();
    }
  }, [isOpen, resetCheckoutState]);

  // Initialize state from props when the modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('Checkout modal opened with props:', {
        customerDetails,
        deliveryMethod,
        deliveryDetails,
        pickupDetails,
        giftDetails,
        paymentMethod,
        paymentReference,
        cart: Array.isArray(cart) ? `${cart.length} items` : 'No cart items'
      });

      // Initialize customer details
      if (customerDetails) {
        console.log('Initializing customer details:', customerDetails);
        setCustomerDetailsState({
          name: customerDetails.name || '',
          email: customerDetails.email || '',
          phone: customerDetails.phone || ''
        });
      }

      // Initialize delivery method
      if (deliveryMethod) {
        console.log('Initializing delivery method:', deliveryMethod);
        setDeliveryMethodState(deliveryMethod);
      }

      // Initialize delivery details
      if (deliveryDetails) {
        console.log('Initializing delivery details:', deliveryDetails);
        setDeliveryDetailsState({
          date: deliveryDetails.date || '',
          timeSlot: deliveryDetails.timeSlot || '',
          instructions: deliveryDetails.instructions || '',
          streetAddress: deliveryDetails.streetAddress || '',
          apartment: deliveryDetails.apartment || '',
          emirate: deliveryDetails.emirate || '',
          city: deliveryDetails.city || '',
          charge: deliveryDetails.charge || 0
        });
      }

      // Initialize pickup details
      if (pickupDetails) {
        console.log('Initializing pickup details:', pickupDetails);
        setPickupDetailsState({
          date: pickupDetails.date || '',
          timeSlot: pickupDetails.timeSlot || ''
        });
      }

      // Initialize gift details
      if (giftDetails) {
        console.log('Initializing gift details:', giftDetails);
        setGiftDetailsState({
          isGift: giftDetails.isGift || false,
          recipientName: giftDetails.recipientName || '',
          recipientPhone: giftDetails.recipientPhone || '',
          message: giftDetails.message || '',
          note: giftDetails.note || '',
          cashAmount: giftDetails.cashAmount || 0,
          includeCash: giftDetails.includeCash || false
        });
      }

      // Initialize payment method
      if (paymentMethod) {
        console.log('Initializing payment method:', paymentMethod);
        setPaymentMethodState(paymentMethod);
      }

      // Initialize payment reference
      if (paymentReference) {
        console.log('Initializing payment reference:', paymentReference);
        setPaymentReferenceState(paymentReference);
      }

      // Clear the flag from localStorage
      localStorage.removeItem('openCheckoutModal');
      
      // Don't remove checkout details from localStorage here
      // This should be done in the POS page after the modal is opened
    }
  }, [isOpen, customerDetails, deliveryMethod, deliveryDetails, pickupDetails, giftDetails, paymentMethod, paymentReference, cart]);

  // Get formatted checkout details for saving
  const getFormattedCheckoutDetails = (): CheckoutDetails => {
    return {
      customerDetails: customerDetailsState,
      deliveryMethod: deliveryMethodState,
      deliveryDetails: deliveryDetailsState,
      pickupDetails: pickupDetailsState,
      giftDetails: giftDetailsState,
      paymentMethod: paymentMethodState,
      paymentReference: paymentReferenceState,
      orderSummary: {
        totalItems: cart.length,
        products: cart.map(item => ({
          id: item.id,
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          price: item.totalPrice,
          unitPrice: item.product.basePrice,
          sku: item.product.sku,
          requiresKitchen: item.product.requiresKitchen,
          requiresDesign: item.product.requiresDesign,
          hasVariations: item.selectedVariations && item.selectedVariations.length > 0,
          hasCustomImages: item.customImages && item.customImages.length > 0
        })),
        totalAmount: cartTotal
      }
    };
  };

  const handleQueueOrder = async () => {
    try {
      setIsSubmitting(true);
      
      // Validate cart
      if (!cart || cart.length === 0) {
        toast.error('Your cart is empty');
        setIsSubmitting(false);
        return;
      }
      
      // Validate customer details if required
      if (customerDetailsState.name && customerDetailsState.phone) {
        if (!customerDetailsState.name || !customerDetailsState.phone) {
          toast.error('Please provide customer details');
          setIsSubmitting(false);
          return;
        }
      }
      
      // Format cart items with all necessary data
      const cartWithMetadata = cart.map(item => {
        // Format selected variations
        const selectedVariations = Array.isArray(item.selectedVariations) 
          ? item.selectedVariations.map(v => ({
              id: v.id,
              type: v.type,
              value: v.value,
              price: v.priceAdjustment || 0
            }))
          : [];
          
        // Format custom images
        const customImages = Array.isArray(item.customImages)
          ? item.customImages.map(img => ({
              id: img.id || nanoid(),
              url: img.url || '',
              previewUrl: img.previewUrl || '',
              comment: img.comment || ''
            }))
          : [];
        
        // Return formatted item
        return {
          productId: item.product.id,
          productName: item.product.name,
          description: item.product.description || '',
          sku: item.product.sku || '',
          barcode: item.product.barcode || '',
          unitPrice: item.product.basePrice,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
          selectedVariations,
          customImages,
          notes: item.notes || '',
          requiresKitchen: item.product.requiresKitchen || false,
          requiresDesign: item.product.requiresDesign || false,
          allowCustomImages: item.product.allowCustomImages || false,
          metadata: {
            ...item.metadata,
            requiresKitchen: item.product.requiresKitchen || false,
            requiresDesign: item.product.requiresDesign || false
          }
        };
      });
      
      // Create order summary
      const orderSummary = {
        totalItems: cart.reduce((sum, item) => sum + item.quantity, 0),
        products: cart.map(item => ({
          id: nanoid(),
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          price: item.totalPrice,
          unitPrice: item.product.basePrice,
          sku: item.product.sku || '',
          requiresKitchen: item.product.requiresKitchen || false,
          requiresDesign: item.product.requiresDesign || false,
          hasVariations: Array.isArray(item.selectedVariations) && item.selectedVariations.length > 0,
          hasCustomImages: Array.isArray(item.customImages) && item.customImages.length > 0
        })),
        totalAmount: cartTotal
      };
      
      console.log('Queuing order with data:', {
        items: cartWithMetadata,
        customer: {
          name: customerDetailsState.name,
          email: customerDetailsState.email,
          phone: customerDetailsState.phone
        },
        notes: '',
        totalAmount: cartTotal,
        deliveryMethod: deliveryMethodState,
        deliveryDetails: deliveryMethodState === 'DELIVERY' ? {
          date: deliveryDetailsState.date,
          timeSlot: deliveryDetailsState.timeSlot,
          instructions: deliveryDetailsState.instructions,
          streetAddress: deliveryDetailsState.streetAddress,
          apartment: deliveryDetailsState.apartment,
          emirate: deliveryDetailsState.emirate,
          city: deliveryDetailsState.city,
          charge: deliveryDetailsState.charge !== undefined ? 
            deliveryDetailsState.charge : 
            calculateDeliveryCharge(deliveryDetailsState.emirate)
        } : undefined,
        pickupDetails: deliveryMethodState === 'PICKUP' ? {
          date: pickupDetailsState.date,
          timeSlot: pickupDetailsState.timeSlot
        } : undefined,
        giftDetails: giftDetailsState.isGift ? {
          isGift: giftDetailsState.isGift,
          recipientName: giftDetailsState.recipientName,
          recipientPhone: giftDetailsState.recipientPhone,
          message: giftDetailsState.message,
          note: giftDetailsState.note,
          cashAmount: giftDetailsState.cashAmount,
          includeCash: giftDetailsState.includeCash
        } : undefined,
        orderSummary
      });
      
      // Call API to queue order
      const response = await apiMethods.pos.queueOrder({
        items: cartWithMetadata,
        customerName: customerDetailsState.name,
        customerEmail: customerDetailsState.email,
        customerPhone: customerDetailsState.phone,
        notes: '',
        totalAmount: cartTotal,
        deliveryMethod: deliveryMethodState,
        deliveryDetails: deliveryMethodState === 'DELIVERY' ? {
          date: deliveryDetailsState.date,
          timeSlot: deliveryDetailsState.timeSlot,
          instructions: deliveryDetailsState.instructions,
          streetAddress: deliveryDetailsState.streetAddress,
          apartment: deliveryDetailsState.apartment,
          emirate: deliveryDetailsState.emirate,
          city: deliveryDetailsState.city,
          charge: deliveryDetailsState.charge !== undefined ? 
            deliveryDetailsState.charge : 
            calculateDeliveryCharge(deliveryDetailsState.emirate)
        } : undefined,
        pickupDetails: deliveryMethodState === 'PICKUP' ? {
          date: pickupDetailsState.date,
          timeSlot: pickupDetailsState.timeSlot
        } : undefined,
        giftDetails: giftDetailsState.isGift ? {
          isGift: giftDetailsState.isGift,
          recipientName: giftDetailsState.recipientName,
          recipientPhone: giftDetailsState.recipientPhone,
          message: giftDetailsState.message,
          note: giftDetailsState.note,
          cashAmount: giftDetailsState.cashAmount,
          includeCash: giftDetailsState.includeCash
        } : undefined,
        orderSummary
      });
      
      if (response.success) {
        toast.success('Order queued successfully');
        
        // Call onQueueOrder callback if provided
        if (onQueueOrder) {
          onQueueOrder({
            customerDetails: {
              name: customerDetailsState.name,
              email: customerDetailsState.email,
              phone: customerDetailsState.phone
            },
            deliveryMethod: deliveryMethodState,
            deliveryDetails: deliveryMethodState === 'DELIVERY' ? {
              date: deliveryDetailsState.date,
              timeSlot: deliveryDetailsState.timeSlot,
              instructions: deliveryDetailsState.instructions,
              streetAddress: deliveryDetailsState.streetAddress,
              apartment: deliveryDetailsState.apartment,
              emirate: deliveryDetailsState.emirate,
              city: deliveryDetailsState.city,
              charge: deliveryDetailsState.charge !== undefined ? 
                deliveryDetailsState.charge : 
                calculateDeliveryCharge(deliveryDetailsState.emirate)
            } : undefined,
            pickupDetails: deliveryMethodState === 'PICKUP' ? {
              date: pickupDetailsState.date,
              timeSlot: pickupDetailsState.timeSlot
            } : undefined,
            giftDetails: giftDetailsState.isGift ? {
              isGift: giftDetailsState.isGift,
              recipientName: giftDetailsState.recipientName,
              recipientPhone: giftDetailsState.recipientPhone,
              message: giftDetailsState.message,
              note: giftDetailsState.note,
              cashAmount: giftDetailsState.cashAmount,
              includeCash: giftDetailsState.includeCash
            } : undefined,
            paymentMethod: paymentMethodState,
            paymentReference: paymentReferenceState,
            orderSummary
          });
        }
        
        // Close modal and reset state
        onClose();
        resetCheckoutState();
      } else {
        toast.error(response.message || 'Failed to queue order');
      }
    } catch (error) {
      console.error('Error queuing order:', error);
      toast.error('An error occurred while queuing the order');
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
                      {/* Left Side - Customer Details & Delivery/Pickup */}
                      <div className="flex-1 lg:pr-8 lg:border-r">
                        {/* Customer Details */}
                        <div className="space-y-4 mb-8">
                          <h3 className="text-lg font-semibold">Customer Details:</h3>
                          <div ref={searchRef} className="relative">
                            <div className="relative">
                              <input
                                type="text"
                                value={customerDetailsState.name}
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
                              value={customerDetailsState.phone}
                              onChange={(e) => setCustomerDetailsState((prev) => ({ ...prev, phone: e.target.value }))}
                              className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                              placeholder="Phone Number *"
                            />
                            <input
                              type="email"
                              value={customerDetailsState.email}
                              onChange={(e) => setCustomerDetailsState((prev) => ({ ...prev, email: e.target.value }))}
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
                              onClick={() => setDeliveryMethodState('PICKUP')}
                              className={`p-4 text-center border-2 rounded-lg flex items-center justify-center ${
                                deliveryMethodState === 'PICKUP'
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200'
                              }`}
                            >
                              <div className={`w-6 h-6 border-2 rounded-full mr-3 flex items-center justify-center ${
                                deliveryMethodState === 'PICKUP'
                                  ? 'border-blue-500 bg-blue-500'
                                  : 'border-gray-300'
                              }`}>
                                {deliveryMethodState === 'PICKUP' && (
                                  <div className="w-3 h-3 bg-white rounded-full" />
                                )}
                              </div>
                              <span className="text-lg">Pickup</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeliveryMethodState('DELIVERY')}
                              className={`p-4 text-center border-2 rounded-lg flex items-center justify-center ${
                                deliveryMethodState === 'DELIVERY'
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200'
                              }`}
                            >
                              <div className={`w-6 h-6 border-2 rounded-full mr-3 flex items-center justify-center ${
                                deliveryMethodState === 'DELIVERY'
                                  ? 'border-blue-500 bg-blue-500'
                                  : 'border-gray-300'
                              }`}>
                                {deliveryMethodState === 'DELIVERY' && (
                                  <div className="w-3 h-3 bg-white rounded-full" />
                                )}
                              </div>
                              <span className="text-lg">Delivery</span>
                            </button>
                          </div>
                        </div>

                        {/* Delivery Form */}
                        {deliveryMethodState === 'DELIVERY' && (
                          <div className="grid grid-cols-1 gap-4 pt-8">
                            <input
                              type="text"
                              value={deliveryDetailsState.streetAddress}
                              onChange={(e) => setDeliveryDetailsState((prev) => ({ ...prev, streetAddress: e.target.value }))}
                              className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                              placeholder="Street Address *"
                            />

                            <input
                              type="text"
                              value={deliveryDetailsState.apartment}
                              onChange={(e) => setDeliveryDetailsState((prev) => ({ ...prev, apartment: e.target.value }))}
                              className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                              placeholder="Apartment/Villa/Office (Optional)"
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <select
                                value={deliveryDetailsState.emirate}
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
                                value={deliveryDetailsState.city}
                                onChange={(e) => setDeliveryDetailsState((prev) => ({ ...prev, city: e.target.value }))}
                                className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                placeholder="City/Area *"
                              />
                            </div>

                            {deliveryDetailsState.emirate && (
                              <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <select
                                    value={deliveryDetailsState.date}
                                    onChange={(e) => setDeliveryDetailsState((prev) => ({ ...prev, date: e.target.value }))}
                                    className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                  >
                                    <option value="">Select Date *</option>
                                    {getAvailableDates(deliveryDetailsState.emirate).map((date) => (
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
                                    value={deliveryDetailsState.timeSlot}
                                    onChange={(e) => setDeliveryDetailsState((prev) => ({ ...prev, timeSlot: e.target.value }))}
                                    className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                  >
                                    <option value="">Select Time Slot *</option>
                                    {getTimeSlots(deliveryDetailsState.emirate).map((slot) => (
                                      <option key={slot} value={slot}>{slot}</option>
                                    ))}
                                  </select>
                                </div>

                                <textarea
                                  value={deliveryDetailsState.instructions}
                                  onChange={(e) => setDeliveryDetailsState((prev) => ({ ...prev, instructions: e.target.value }))}
                                  className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                  placeholder="Delivery Instructions (Optional)"
                                  rows={2}
                                />
                              </>
                            )}
                          </div>
                        )}

                        {/* Pickup Form */}
                        {deliveryMethodState === 'PICKUP' && (
                          <div className="grid grid-cols-1 gap-4 pt-8">
                            <select
                              value={pickupDetailsState.date}
                              onChange={(e) => setPickupDetailsState((prev) => ({ ...prev, date: e.target.value }))}
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
                              value={pickupDetailsState.timeSlot}
                              onChange={(e) => setPickupDetailsState((prev) => ({ ...prev, timeSlot: e.target.value }))}
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
                                checked={giftDetailsState.isGift}
                                onChange={(e) => setGiftDetailsState((prev) => ({ ...prev, isGift: e.target.checked }))}
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          </div>

                          {giftDetailsState.isGift && (
                            <div className="space-y-4">
                              <input
                                type="text"
                                value={giftDetailsState.recipientName}
                                onChange={(e) => setGiftDetailsState((prev) => ({ ...prev, recipientName: e.target.value }))}
                                className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                placeholder="Recipient Name *"
                              />

                              <input
                                type="tel"
                                value={giftDetailsState.recipientPhone}
                                onChange={(e) => setGiftDetailsState((prev) => ({ ...prev, recipientPhone: e.target.value }))}
                                className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                placeholder="Recipient Phone *"
                              />

                              <textarea
                                value={giftDetailsState.message}
                                onChange={(e) => setGiftDetailsState((prev) => ({ ...prev, message: e.target.value }))}
                                className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                                placeholder="Gift Message (Optional)"
                                rows={2}
                              />

                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="includeCash"
                                  checked={giftDetailsState.includeCash}
                                  onChange={(e) => setGiftDetailsState((prev) => ({ ...prev, includeCash: e.target.checked }))}
                                  className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                                />
                                <label htmlFor="includeCash" className="text-sm font-medium text-gray-900">
                                  Include Cash Gift
                                </label>
                              </div>
                              
                              {giftDetailsState.includeCash && (
                                <div className="relative">
                                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <span className="text-gray-500 text-lg">AED</span>
                                  </div>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={giftDetailsState.cashAmount}
                                    onChange={(e) => setGiftDetailsState((prev) => ({ ...prev, cashAmount: parseFloat(e.target.value) || 0 }))}
                                    className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4 pl-16"
                                    placeholder="Cash Amount"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                       

                        
                      </div>

                      {/* Right Side - Order Summary */}
                      <div className="flex-1 lg:pl-8">
                        {/* Order Summary */}
                        <div className="mb-8">
                          <h4 className="text-xl font-medium mb-6">Order Summary</h4>
                          <div className="max-h-[40vh] overflow-y-auto pr-4 space-y-6">
                            {(() => {
                              console.log('Rendering cart items in checkout modal:', JSON.stringify(cart, null, 2));
                              console.log('Cart length:', Array.isArray(cart) ? cart.length : 'cart is not an array');
                              console.log('Cart total:', cartTotal);
                              return null;
                            })()}
                            
                            {Array.isArray(cart) && cart.length > 0 ? (
                              cart.map((item, index) => {
                                console.log(`Rendering cart item ${index}:`, JSON.stringify(item, null, 2));
                                
                                // Skip rendering if product is missing or invalid
                                if (!item || !item.product) {
                                  console.error(`Invalid cart item at index ${index}:`, item);
                                  return null;
                                }
                                
                                // Ensure selectedVariations is an array
                                const selectedVariations = Array.isArray(item.selectedVariations) 
                                  ? item.selectedVariations 
                                  : [];
                                
                                // Ensure customImages is an array
                                const customImages = Array.isArray(item.customImages)
                                  ? item.customImages
                                  : [];
                                 
                                console.log(`Item ${index} allowCustomImages:`, item.product?.allowCustomImages);
                                console.log(`Item ${index} customImages:`, customImages);
                                 
                                return (
                                  <div
                                    key={item.id || `item-${index}`}
                                    className="flex items-start justify-between p-4 bg-gray-50 rounded-lg"
                                  >
                                    <div className="flex-1">
                                      <p className="text-lg font-medium">{item.product?.name || 'Unknown Product'}</p>
                                      <p className="text-base text-gray-500 mt-2">
                                        Quantity: {item.quantity || 0}
                                      </p>
                                      {selectedVariations.length > 0 ? (
                                        selectedVariations.map((variation, i) => (
                                          <p
                                            key={`${item.id}-var-${i}`}
                                            className="text-base text-gray-500"
                                          >
                                            {variation.type}: {variation.value}
                                            {variation.priceAdjustment > 0 && ` (+AED ${variation.priceAdjustment.toFixed(2)})`}
                                          </p>
                                        ))
                                      ) : null}
                                      {item.notes && (
                                        <p className="text-sm text-gray-600 mt-2">
                                          Notes: {item.notes}
                                        </p>
                                      )}

                                      {/* Spacer before custom images */}
                                      <div className="mt-4 border-t border-gray-200"></div>

                                      {/* Custom Images Upload */}
                                      <div className="mt-6 border-2 border-dashed border-blue-300 p-4 rounded-lg bg-blue-50 hover:border-blue-400 transition-colors relative">
                                        <div className="absolute -top-3 left-4 bg-white px-2 text-xs font-semibold text-blue-600 flex items-center">
                                           <Camera className="w-3 h-3 mr-1" /> UPLOAD IMAGES
                                         </div>
                                        <div className="flex items-center justify-between mb-2">
                                          <label className="text-sm font-semibold text-gray-800">
                                            Upload Reference Images
                                          </label>
                                          <span className="text-xs text-gray-500">
                                            Add photos for your order
                                          </span>
                                        </div>
                                        <ImageUpload
                                          onChange={(images) => {
                                            console.log('Custom images updated:', images);
                                            const updatedCart = cart.map(cartItem =>
                                              cartItem.id === item.id
                                                ? { ...cartItem, customImages: images }
                                                : cartItem
                                            );
                                            setCart(updatedCart);
                                          }}
                                          value={customImages}
                                        />
                                        {customImages.length > 0 && (
                                          <div className="mt-2 text-sm text-gray-500">
                                            {customImages.length} image{customImages.length !== 1 ? 's' : ''} added
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-lg font-medium ml-4">
                                      AED {(item.totalPrice || 0).toFixed(2)}
                                    </p>
                                  </div>
                                );
                              }).filter(Boolean)
                            ) : (
                              <div className="text-center py-8 text-gray-500">
                                No items in cart
                              </div>
                            )}
                          </div>

                          <div className="mt-6 pt-6 border-t">
                            <div className="flex justify-between items-center font-medium">
                              <p className="text-xl">Subtotal</p>
                              <p className="text-xl">AED {cartTotal.toFixed(2)}</p>
                            </div>
                            {deliveryMethodState === 'DELIVERY' && deliveryDetailsState.emirate && (
                              <div className="flex justify-between items-center font-medium mt-2">
                                <p className="text-xl">Delivery Charge ({deliveryDetailsState.emirate.replace('_', ' ')})</p>
                                <div className="flex items-center">
                                  <span className="mr-2 text-xl">AED</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={deliveryDetailsState.charge !== undefined ? 
                                      deliveryDetailsState.charge : 
                                      calculateDeliveryCharge(deliveryDetailsState.emirate)}
                                    onChange={(e) => setDeliveryDetailsState(prev => ({ 
                                      ...prev, 
                                      charge: parseFloat(e.target.value) || 0 
                                    }))}
                                    className="w-20 text-xl font-medium border-b-2 border-gray-300 focus:border-black focus:outline-none text-right"
                                  />
                                </div>
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
                              className="px-6 py-4 bg-black text-white rounded-xl hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed"
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
                                onClick={() => setPaymentMethodState('CASH')}
                                className={`p-6 text-lg font-medium rounded-xl border-2 transition-all ${
                                  paymentMethodState === 'CASH'
                                    ? 'border-black bg-black text-white'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                Cash
                              </button>
                              <button
                                type="button"
                                onClick={() => setPaymentMethodState('CARD')}
                                className={`p-6 text-lg font-medium rounded-xl border-2 transition-all ${
                                  paymentMethodState === 'CARD'
                                    ? 'border-black bg-black text-white'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                Card
                              </button>
                            </div>
                            <input
                              type="text"
                              value={paymentReferenceState}
                              onChange={(e) => setPaymentReferenceState(e.target.value)}
                              placeholder="Payment Reference"
                              className="block w-full rounded-xl border-2 border-gray-200 shadow-sm focus:border-black focus:ring-black text-lg p-4"
                            />
                          </div>

                          <div className="mt-8">
                            <div className="flex gap-4">
                              <button
                                type="button"
                                onClick={handleCheckout}
                                disabled={isSubmitting}
                                className={`flex-1 inline-flex justify-center rounded-lg border border-transparent shadow-sm px-6 py-4 bg-black text-xl font-medium text-white hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors`}
                              >
                                {isSubmitting ? "Processing..." : "Complete Order"}
                              </button>
                              {onQueueOrder && (
                                <button
                                  type="button"
                                  onClick={handleQueueOrder}
                                  disabled={isSubmitting}
                                  className="inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-4 bg-white text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                                  title="Queue Order"
                                >
                                  <ListOrdered className="h-6 w-6" />
                                </button>
                              )}
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
