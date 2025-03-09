'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiMethods, type Product, type Category, type APIResponse, type PosQueuedOrder } from '@/services/api';
import toast from 'react-hot-toast';
import ProductDetailsModal from '@/components/pos/product-details-modal';
import CheckoutModal from '@/components/pos/checkout-modal';
import Header from '@/components/header/header';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { nanoid } from 'nanoid';
import { CartItem, CustomImage } from '@/types/cart';

import { Search, X, Minus, Plus, ListOrdered } from 'lucide-react';

export default function POSPage() {
  const { user, loading: authLoading, refreshToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, setIsFullscreen] = useState(false);

  // State for UI
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [queuedOrders, setQueuedOrders] = useState<PosQueuedOrder[]>([]);
  const checkoutDetailsRef = useRef<any>(null);
  const [checkoutDetails, setCheckoutDetails] = useState<any>(null);

  // Load cart items from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedCartItems = localStorage.getItem('pos-cart');
      if (savedCartItems) {
        try {
          const parsedCartItems = JSON.parse(savedCartItems);
          console.log('Loading cart items from localStorage:', parsedCartItems);
          
          if (Array.isArray(parsedCartItems)) {
            // Ensure all required fields are present
            const validatedCartItems = parsedCartItems.map(item => {
              // Log each item for debugging
              console.log('Processing cart item:', JSON.stringify(item, null, 2));
              
              // Check if product exists
              if (!item.product) {
                console.error('Cart item missing product:', item);
                return null;
              }
              
              // Process selected variations - ensure they have proper structure
              let selectedVariations = [];
              if (item.selectedVariations && Array.isArray(item.selectedVariations)) {
                selectedVariations = item.selectedVariations.map((v: any) => ({
                  id: v.id || nanoid(),
                  type: v.type || 'Option',
                  value: v.value || '',
                  priceAdjustment: parseFloat(String(v.price || v.priceAdjustment)) || 0
                }));
              }
              
              // Process custom images - ensure they have proper structure
              let customImages = [];
              if (item.customImages && Array.isArray(item.customImages)) {
                customImages = item.customImages.map((img: any) => ({
                  id: img.id || nanoid(),
                  url: img.url || '',
                  previewUrl: img.previewUrl || img.url || '',
                  comment: img.comment || ''
                }));
              }
              
              // Create a properly formatted cart item
              return {
                id: item.id || nanoid(),
                product: {
                  id: item.product?.id || '',
                  name: item.product?.name || 'Unknown Product',
                  basePrice: parseFloat(String(item.product?.basePrice)) || 0,
                  requiresKitchen: item.product?.requiresKitchen || false,
                  requiresDesign: item.product?.requiresDesign || false,
                  allowCustomImages: item.product?.allowCustomImages || false,
                  status: item.product?.status || 'ACTIVE',
                  images: Array.isArray(item.product?.images) ? item.product.images : [],
                  allowCustomPrice: item.product?.allowCustomPrice || false,
                },
                quantity: parseInt(String(item.quantity)) || 1,
                selectedVariations,
                notes: item.notes || '',
                customImages,
                totalPrice: parseFloat(String(item.totalPrice)) || 0
              };
            }).filter(item => item !== null);
            
            console.log('Setting cart with validated items:', validatedCartItems);
            setCart(validatedCartItems);
          }
        } catch (error) {
          console.error('Error parsing cart items from localStorage:', error);
        }
      }
    }
  }, []);

  // Save cart items to localStorage whenever cart changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (cart.length > 0 || isCheckoutModalOpen) {
        localStorage.setItem('pos-cart', JSON.stringify(cart));
      } else {
        localStorage.removeItem('pos-cart');
      }
    }
  }, [cart, isCheckoutModalOpen]);

  // Load checkout details
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedCheckoutDetails = localStorage.getItem('pos-checkout-details');
      if (savedCheckoutDetails) {
        try {
          const parsedCheckoutDetails = JSON.parse(savedCheckoutDetails);
          console.log('Loading checkout details from localStorage:', parsedCheckoutDetails);
          
          // Validate and ensure all required fields are present
          const validatedCheckoutDetails = {
            customerDetails: {
              name: parsedCheckoutDetails.customerDetails?.name || '',
              email: parsedCheckoutDetails.customerDetails?.email || '',
              phone: parsedCheckoutDetails.customerDetails?.phone || '',
            },
            deliveryMethod: parsedCheckoutDetails.deliveryMethod || 'PICKUP',
            deliveryDetails: parsedCheckoutDetails.deliveryDetails ? {
              date: parsedCheckoutDetails.deliveryDetails?.date || '',
              timeSlot: parsedCheckoutDetails.deliveryDetails?.timeSlot || '',
              instructions: parsedCheckoutDetails.deliveryDetails?.instructions || '',
              streetAddress: parsedCheckoutDetails.deliveryDetails?.streetAddress || '',
              apartment: parsedCheckoutDetails.deliveryDetails?.apartment || '',
              emirate: parsedCheckoutDetails.deliveryDetails?.emirate || '',
              city: parsedCheckoutDetails.deliveryDetails?.city || '',
              charge: parseFloat(String(parsedCheckoutDetails.deliveryDetails?.charge)) || 0,
            } : undefined,
            pickupDetails: parsedCheckoutDetails.pickupDetails ? {
              date: parsedCheckoutDetails.pickupDetails?.date || '',
              timeSlot: parsedCheckoutDetails.pickupDetails?.timeSlot || '',
            } : undefined,
            giftDetails: parsedCheckoutDetails.giftDetails ? {
              isGift: parsedCheckoutDetails.giftDetails?.isGift || false,
              recipientName: parsedCheckoutDetails.giftDetails?.recipientName || '',
              recipientPhone: parsedCheckoutDetails.giftDetails?.recipientPhone || '',
              message: parsedCheckoutDetails.giftDetails?.message || '',
              note: parsedCheckoutDetails.giftDetails?.note || '',
              cashAmount: parseFloat(String(parsedCheckoutDetails.giftDetails?.cashAmount)) || 0,
              includeCash: parsedCheckoutDetails.giftDetails?.includeCash || false,
            } : undefined,
            addressDetails: parsedCheckoutDetails.addressDetails ? {
              streetAddress: parsedCheckoutDetails.addressDetails?.streetAddress || '',
              apartment: parsedCheckoutDetails.addressDetails?.apartment || '',
              emirate: parsedCheckoutDetails.addressDetails?.emirate || '',
              city: parsedCheckoutDetails.addressDetails?.city || '',
            } : undefined,
            name: parsedCheckoutDetails.name || '',
            notes: parsedCheckoutDetails.notes || ''
          };
          
          console.log('Validated checkout details:', validatedCheckoutDetails);
          setCheckoutDetails(validatedCheckoutDetails);
          
          // Clean up localStorage
          localStorage.removeItem('pos-checkout-details');
          
          // Open the checkout modal after a short delay to ensure state is updated
          setTimeout(() => {
            setIsCheckoutModalOpen(true);
          }, 500);
        } catch (error) {
          console.error('Error parsing checkout details from localStorage:', error);
        }
      } else {
        console.warn('No checkout details found in localStorage');
      }
    }
  }, []);

  // Clear cart function
  const handleClearCart = () => {
    setCart([]);
    localStorage.removeItem('pos-cart');
    toast.success('Cart cleared');
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
      return;
    }
  }, [user, authLoading, router]);

  // Fetch products with category filter
  const { data: productsData, isLoading: isProductsLoading } = useQuery({
    queryKey: ['products', selectedCategory],
    queryFn: async () => {
      try {
        const response = await apiMethods.pos.getProducts();
        if (!response.success) {
          throw new Error(response.message || 'Failed to fetch products');
        }
        return response.data;
      } catch (error) {
        console.error('Error fetching products:', error);
        toast.error('Failed to load products. Please try again.');
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 3
  });

  // Fetch categories
  const { data: categoriesResponse, isLoading: isCategoriesLoading } = useQuery<APIResponse<Category[]>>({
    queryKey: ['categories'],
    queryFn: async () => {
      try {
        const response = await apiMethods.products.getCategories();
        if (!response.success) {
          throw new Error('Failed to fetch categories');
        }
        return response;
      } catch (error) {
        console.error('Error fetching categories:', error);
        throw error instanceof Error ? error : new Error('Failed to fetch categories');
      }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Add "All Products" category and filter active categories
  const categories = useMemo(() => {
    if (!categoriesResponse?.success) {
      console.log('No valid categories response:', categoriesResponse?.message ?? 'Unknown error');
      return [{ id: 'all', name: 'All Products', description: null, isActive: true }];
    }

    const categoryList = categoriesResponse.data;
    if (!Array.isArray(categoryList)) {
      console.log('Categories data is not an array:', categoryList);
      return [{ id: 'all', name: 'All Products', description: null, isActive: true }];
    }
    
    return [
      { id: 'all', name: 'All Products', description: null, isActive: true },
      ...categoryList
    ];
  }, [categoriesResponse]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = productsData || [];
    
    // Filter by category if selected
    if (selectedCategory) {
      result = result.filter(product => product.categoryId === selectedCategory);
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(product => 
        product.name.toLowerCase().includes(query) || 
        product.description?.toLowerCase().includes(query)
      );
    }
    
    // Sort by position
    return result.sort((a, b) => (a.position || 0) - (b.position || 0));
  }, [productsData, selectedCategory, searchQuery]);

  // Calculate price range for a product
  const getProductPriceDisplay = (product: Product) => {
    const basePrice = product.basePrice || 0;
    const hasVariations = product.variants?.length > 0;
    
    if (!hasVariations) {
      return `AED ${basePrice.toFixed(2)}`;
    }

    const priceRange = product.variants.reduce(
      (range, variant) => {
        const price = variant.price || 0;
        return {
          min: Math.min(range.min, price),
          max: Math.max(range.max, price)
        };
      },
      { min: Infinity, max: 0 }
    );

    if (priceRange.min === priceRange.max) {
      return `AED ${priceRange.min.toFixed(2)}`;
    }
    return `AED ${priceRange.min.toFixed(2)} - ${priceRange.max.toFixed(2)}`;
  };

  // Calculate total price for variations
  const calculateTotalPrice = (basePrice: number, quantity: number, variations: Array<{ priceAdjustment?: number; price?: number }>) => {
    const variationTotal = variations.reduce((total, variation) => {
      // Use priceAdjustment if available, otherwise try to use price, or default to 0
      const adjustmentValue = variation.priceAdjustment !== undefined ? variation.priceAdjustment : 
                             (variation.price !== undefined ? variation.price : 0);
      return total + adjustmentValue;
    }, 0);
    return (basePrice + variationTotal) * quantity;
  };

  // Handle adding product to cart from product details modal
  const handleAddToOrder = ({ product, quantity, selectedVariations, notes, customImages, totalPrice }: any) => {
    handleAddToCart(product, quantity, selectedVariations, null, notes, customImages);
  };

  // Handle quick add to cart (without opening modal)
  const handleQuickAddToCart = (product: Product) => {
    // Only allow quick add for products that don't need customization
    if (product.allowCustomImages || product.allowCustomPrice || (product.options && product.options.length > 0)) {
      setSelectedProduct(product);
      return;
    }

    const cartItem: CartItem = {
      id: nanoid(),
      product: {
        id: product.id,
        name: product.name,
        basePrice: product.basePrice,
        status: product.status,
        images: product.images || [],
        allowCustomPrice: product.allowCustomPrice,
        requiresDesign: product.requiresDesign,
        requiresKitchen: product.requiresKitchen,
        allowCustomImages: product.allowCustomImages
      },
      quantity: 1,
      selectedVariations: [],
      totalPrice: product.basePrice,
      customImages: []
    };

    setCart(prevCart => [...prevCart, cartItem]);
    toast.success('Added to cart');
  };

  // Handle adding product to cart
  const handleAddToCart = (product: Product, quantity: number, selectedVariations: any[], customPrice: number | null, notes: string, customImages: CustomImage[]) => {
    // Calculate total price
    let totalPrice = customPrice !== null ? customPrice : product.basePrice;
    
    // Add variation price adjustments
    if (selectedVariations.length > 0) {
      totalPrice += selectedVariations.reduce((sum, variation) => sum + (variation.priceAdjustment || 0), 0);
    }
    
    // Multiply by quantity
    totalPrice *= quantity;
    
    // Create cart item
    const cartItem: CartItem = {
      id: nanoid(),
      product: {
        ...product,
        allowCustomImages: true, // Always enable custom images for all products
      },
      quantity,
      selectedVariations,
      totalPrice,
      notes,
      customImages
    };
    
    setCart(prevCart => [...prevCart, cartItem]);
    toast.success('Added to cart');
  };

  // Handle removing from cart
  const handleRemoveFromCart = (itemId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== itemId));
    toast.success('Removed from cart');
  };

  // Handle updating quantity
  const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      handleRemoveFromCart(itemId);
      return;
    }

    setCart(prevCart =>
      prevCart.map(item =>
        item.id === itemId
          ? {
              ...item,
              quantity: newQuantity,
              totalPrice: calculateTotalPrice(item.product.basePrice, newQuantity, item.selectedVariations)
            }
          : item
      )
    );
  };

  // Calculate cart total including variations
  const cartTotal = useMemo(() => {
    console.log('Calculating cart total with cart items:', cart);
    return cart.reduce((total, item) => total + (item.totalPrice * item.quantity), 0);
  }, [cart]);

  // Update cart state when checkout modal closes
  const handleCheckoutComplete = () => {
    // Clear custom images from memory
    cart.forEach(item => {
      if (item.customImages) {
        item.customImages.forEach(image => {
          if (image && 'previewUrl' in image && image.previewUrl) {
            URL.revokeObjectURL(image.previewUrl as string);
          }
        });
      }
    });
    setCart([]);
    localStorage.removeItem('pos-cart');
  };

  // Fetch queued orders count
  const { data: queuedOrdersData, refetch: refetchQueuedOrders } = useQuery({
    queryKey: ['queuedOrdersCount'],
    queryFn: async () => {
      try {
        const response = await apiMethods.pos.getQueuedOrders();
        if (!response.success) {
          throw new Error(response.message || 'Failed to fetch queued orders');
        }
        return response.data;
      } catch (error) {
        console.error('Error fetching queued orders:', error);
        return [];
      }
    },
    staleTime: 30 * 1000, // Cache for 30 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
  });

  useEffect(() => {
    if (queuedOrdersData) {
      setQueuedOrders(queuedOrdersData);
      console.log('Updated queued orders count:', queuedOrdersData.length);
    }
  }, [queuedOrdersData]);

  useEffect(() => {
    // Refresh queued orders when the component mounts
    refetchQueuedOrders();
    
    // Set up an interval to refresh queued orders
    const intervalId = setInterval(() => {
      refetchQueuedOrders();
    }, 15000); // Refresh every 15 seconds
    
    // Clean up the interval when the component unmounts
    return () => clearInterval(intervalId);
  }, [refetchQueuedOrders]);

  // Handle queue order
  const handleQueueOrder = async (checkoutDetails: any) => {
    try {
      // Validate cart
      if (cart.length === 0) {
        toast.error('Cannot queue an empty order');
        return;
      }

      // Ensure we have a name for the order
      const orderName = checkoutDetails.customerName || checkoutDetails.customerDetails?.name || 'Untitled Order';

      console.log('Queueing order with details:', {
        ...checkoutDetails,
        name: orderName
      });

      // Format the order data to match the API requirements
      const orderData = {
        ...checkoutDetails,
        name: orderName,
        items: cart.map(item => ({
          productId: item.product.id,
          name: item.product.name, // Required by API
          productName: item.product.name,
          unitPrice: item.product.basePrice,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
          notes: item.notes || '',
          selectedVariations: item.selectedVariations?.map(v => ({
            id: v.id,
            type: v.type,
            value: v.value,
            price: v.priceAdjustment
          })) || [],
          customImages: item.customImages || [],
          requiresKitchen: item.product.requiresKitchen || false,
          requiresDesign: item.product.requiresDesign || false,
          sku: item.product.sku || '',
          categoryId: item.product.categoryId || ''
        })),
        totalAmount: cart.reduce((sum, item) => sum + item.totalPrice, 0)
      };

      // Call the API to queue the order
      const response = await apiMethods.pos.queueOrder(orderData);

      if (response.success) {
        toast.success('Order queued successfully');
        setCart([]);
        localStorage.removeItem('pos-cart');
        setCheckoutDetails(null);
        setIsCheckoutModalOpen(false);
        await refetchQueuedOrders();
      } else {
        throw new Error(response.message || 'Failed to queue order');
      }
    } catch (error: any) {
      console.error('Error queueing order:', error);
      toast.error(error.message || 'Failed to queue order');
      
      // Handle authentication errors
      if (error.response?.status === 401) {
        toast.error('Your session has expired. Please log in again.');
        await refreshToken();
      }
    }
  };

  // Handle URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queuedOrderId = params.get('queuedOrderId');
    const deliveryMethod = params.get('deliveryMethod');
    const customerName = params.get('customerName');
    const customerPhone = params.get('customerPhone');
    const customerEmail = params.get('customerEmail');
    
    console.log('URL parameters:', { 
      queuedOrderId, 
      deliveryMethod,
      customerName,
      customerPhone,
      customerEmail
    });

    // If we have customer information or delivery method from URL, set it in checkout details
    if (customerName || customerPhone || customerEmail || deliveryMethod) {
      setCheckoutDetails(prev => ({
        ...prev,
        customerDetails: {
          name: customerName || prev?.customerDetails?.name || '',
          phone: customerPhone || prev?.customerDetails?.phone || '',
          email: customerEmail || prev?.customerDetails?.email || ''
        },
        deliveryMethod: (deliveryMethod === 'DELIVERY' ? 'DELIVERY' : 'PICKUP') as 'PICKUP' | 'DELIVERY'
      }));
    }
  }, []);

  // If still loading or no user, show loading state
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <Header title="Point of Sale" />
      
      <div className="flex h-[calc(100vh-3.5rem)]">
        {/* Left side - Products */}
        <div className="flex-1 flex flex-col">
          {/* Search and Categories */}
          <div className="p-4 border-b border-gray-200">
            {/* Search */}
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-black text-lg"
              />
              <Search className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
            </div>

            {/* Categories */}
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
              {isCategoriesLoading ? (
                <div className="flex gap-3">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="w-[140px] h-12 bg-gray-100 rounded-xl animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id === 'all' ? null : category.id)}
                      className={`
                        flex items-center justify-center
                        w-[140px] h-12 px-4
                        rounded-xl text-base font-medium
                        transition-colors duration-200
                        ${
                          (category.id === 'all' && !selectedCategory) || selectedCategory === category.id
                            ? "bg-black text-white hover:bg-gray-900"
                            : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                        }
                      `}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="truncate">{category.name}</span>
                        {category.id !== 'all' && filteredProducts.filter(p => p.categoryId === category.id).length > 0 && (
                          <span className="flex-shrink-0 px-2 py-0.5 text-sm bg-gray-700 text-white rounded-full">
                            {filteredProducts.filter(p => p.categoryId === category.id).length}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {isProductsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-gray-50 rounded-xl p-4 aspect-square animate-pulse"
                  >
                    <div className="w-full aspect-square bg-gray-100 rounded-xl mb-4" />
                    <div className="h-5 bg-gray-100 rounded-lg w-3/4 mb-2" />
                    <div className="h-5 bg-gray-100 rounded-lg w-1/2" />
                  </div>
                ))}
              </div>
            ) : filteredProducts?.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                No products found
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredProducts?.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className="group bg-white rounded-xl p-4 border border-gray-100 hover:border-gray-300 transition-all hover:shadow-lg text-left"
                    style={{ order: product.position || 0 }}
                  >
                    {product.images && product.images.length > 0 ? (
                      <div className="relative w-full aspect-square mb-4 rounded-xl overflow-hidden bg-gray-50">
                        <Image
                          src={product.images[0]?.url || '/placeholder.jpg'}
                          alt={product.name}
                          fill
                          priority
                          className="object-cover transition-transform group-hover:scale-105"
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (target.parentElement) {
                              target.parentElement.innerHTML = '<span class="text-gray-400">No image</span>';
                            } else {
                              // If no parent element, just hide the image
                              target.style.display = 'none';
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-full aspect-square mb-4 rounded-xl bg-gray-50 flex items-center justify-center">
                        <span className="text-gray-400">No image</span>
                      </div>
                    )}
                    <h3 className="font-medium text-lg mb-1 line-clamp-2 group-hover:text-blue-600">
                      {product.name}
                    </h3>
                    <div className="text-base text-gray-600">
                      {getProductPriceDisplay(product)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right side - Cart */}
        <div className="w-96 flex flex-col border-l border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Cart ({cart.length})</h2>
              {cart.length > 0 && (
                <button
                  onClick={handleClearCart}
                  className="px-3 py-1 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center"
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear Cart
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No items in cart
              </div>
            ) : (
              <div className="space-y-6">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
                  >
                    <div className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium">{item.product.name}</div>
                          {item.selectedVariations.length > 0 && (
                            <div className="text-sm text-gray-600">
                              {item.selectedVariations.map(v => v.value).join(', ')}
                            </div>
                          )}
                          {item.notes && (
                            <div className="text-sm text-gray-600">
                              Note: {item.notes}
                            </div>
                          )}
                          {/* Show custom images if this is a custom product that requires design */}
                          {item.product.requiresDesign && item.customImages && item.customImages.length > 0 && (
                            <div className="mt-2 flex gap-2 overflow-x-auto">
                              {item.customImages.map((image, index) => (
                                <div key={index} className="relative min-w-[80px] h-[80px] rounded-lg overflow-hidden bg-gray-50">
                                  {image.url ? (
                                    <Image
                                      src={image.url}
                                      alt={`Design ${index + 1}`}
                                      fill
                                      className="object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                                      Uploading...
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-gray-900">
                            AED {item.totalPrice.toFixed(2)}
                          </div>
                          <div className="text-sm text-gray-600">
                            Qty: {item.quantity}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center border-t border-gray-100">
                      <div className="flex-1 flex items-center px-4 py-3">
                        <button
                          onClick={() => handleUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                          className="w-12 h-12 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors"
                        >
                          <Minus className="h-5 w-5" />
                        </button>
                        <span className="text-xl font-semibold mx-6 min-w-[2rem] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                          className="w-12 h-12 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors"
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                      </div>
                      <button
                        onClick={() => handleRemoveFromCart(item.id)}
                        className="p-6 text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors border-l border-gray-100"
                      >
                        <X className="h-6 w-6" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-200">
            <div className="flex justify-between mb-4">
              <span className="font-medium">Total</span>
              <span className="font-medium">{`AED ${cartTotal.toFixed(2)}`}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => router.push('/pos/queued-orders')}
                className="py-2 flex items-center justify-center bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                <ListOrdered className="h-4 w-4 mr-1" />
                <span>Queued Orders ({queuedOrders.length})</span>
              </button>
            </div>
            
            <button
              disabled={cart.length === 0}
              onClick={() => setIsCheckoutModalOpen(true)}
              className="w-full py-3 bg-black text-white rounded-lg disabled:opacity-50"
            >
              Checkout
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToOrder={handleAddToOrder}
        />
      )}

      <CheckoutModal
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        cart={cart}
        setCart={setCart}
        cartTotal={cartTotal}
        onCheckoutComplete={handleCheckoutComplete}
        onQueueOrder={handleQueueOrder}
        onSaveCheckoutDetails={(details) => {
          setCheckoutDetails(details);
        }}
        customerDetails={checkoutDetails?.customerDetails}
        deliveryMethod={checkoutDetails?.deliveryMethod}
        deliveryDetails={checkoutDetails?.deliveryDetails}
        pickupDetails={checkoutDetails?.pickupDetails}
        giftDetails={checkoutDetails?.giftDetails}
        paymentMethod={checkoutDetails?.paymentMethod}
        paymentReference={checkoutDetails?.paymentReference}
        orderName={checkoutDetails?.name || ''}
      />
    </div>
  );
}
