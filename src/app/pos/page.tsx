'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { Search, X, Minus, Plus } from 'lucide-react';
import { apiMethods, type Product, type Category, DesignImage, type APIResponse } from '@/services/api';
import toast from 'react-hot-toast';
import ProductDetailsModal from '@/components/pos/product-details-modal';
import CheckoutModal from '@/components/pos/checkout-modal';
import Header from '@/components/header/header';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { nanoid } from 'nanoid';
import CustomProductModal from '@/components/pos/custom-order-modal';
import CartItemImages from '@/components/pos/cart-item-images';

interface CartItem {
  id: string;
  product: {
    id: string;
    name: string;
    basePrice: number;
    status: string;
    images: any[];
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
}

export default function POSPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, setIsFullscreen] = useState(false);

  // State for UI
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isCustomProductModalOpen, setIsCustomProductModalOpen] = useState(false);

  // Check for openCheckoutModal flag
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const shouldOpenCheckout = localStorage.getItem('openCheckoutModal');
      if (shouldOpenCheckout === 'true') {
        setIsCheckoutModalOpen(true);
        localStorage.removeItem('openCheckoutModal');
      }
    }
  }, []);

  // Load cart from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedCart = localStorage.getItem('pos-cart');
      if (savedCart) {
        try {
          const parsedCart = JSON.parse(savedCart);
          setCart(parsedCart);
        } catch (error) {
          console.error('Error parsing cart:', error);
          toast.error('Error loading cart');
        }
      }
    }
  }, []);

  // Initialize cart from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedCart = localStorage.getItem('cart');
      if (savedCart) {
        try {
          const parsedCart = JSON.parse(savedCart);
          setCart(parsedCart);
          localStorage.removeItem('cart'); // Clear the reorder cart after loading
        } catch (error) {
          console.error('Error parsing cart:', error);
        }
      }
    }
  }, []);

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pos-cart', JSON.stringify(cart));
    }
  }, [cart]);

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

  // Handle custom order button click

  // Handle closing the custom product modal
  const handleCloseCustomModal = () => {
    setIsCustomProductModalOpen(false);
    // Remove the custom parameter from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('custom');
    window.history.pushState({}, '', url);
  };

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const customParam = new URL(window.location.href).searchParams.get('custom');
      setIsCustomProductModalOpen(customParam === 'true');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Handle URL parameter for custom modal
  useEffect(() => {
    const custom = searchParams.get('custom');
    setIsCustomProductModalOpen(custom === 'true');
  }, [searchParams]);

  // Handle fullscreen

  // Update fullscreen state on change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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
      const response = await apiMethods.products.getCategories();
      if (!response.success) {
        throw new Error(response.message || 'Failed to fetch categories');
      }
      return response;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Add "All Products" category and filter active categories
  const categories = useMemo(() => {
    if (!categoriesResponse?.success) {
      console.log('No valid categories response:', categoriesResponse);
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

  // Debug logging
  useEffect(() => {
    if (categoriesResponse) {
      console.log('Categories Response:', categoriesResponse);
      console.log('Categories Data:', categoriesResponse.data);
      console.log('Processed Categories:', categories);
    }
  }, [categoriesResponse, categories]);

  // Filter products based on search query and category
  const filteredProducts = productsData?.filter(product => {
    const matchesCategory = !selectedCategory || selectedCategory === 'all' || product.categoryId === selectedCategory;
    const matchesSearch = !searchQuery || 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch && product.status === 'ACTIVE';
  }) || [];

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

  // If still loading or no user, show loading state
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }


  const handleAddToOrder = (orderItem: Omit<CartItem, 'id'>) => {
    const cartItemId = nanoid();
    setCart(prevCart => [
      ...prevCart,
      {
        ...orderItem,
        id: cartItemId,
        totalPrice: (orderItem.product.basePrice + (orderItem.selectedVariations?.reduce((sum, v) => sum + (v.priceAdjustment || 0), 0) || 0)) * orderItem.quantity
      }
    ]);
    toast.success('Added to order');
  };

  const handleRemoveFromCart = (itemId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== itemId));
    toast.success('Removed from order');
  };

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
              totalPrice: (item.totalPrice / item.quantity) * newQuantity
            }
          : item
      )
    );
  };

  const handleAddCustomProduct = (product: { id: string; name: string; price: number; designImages?: DesignImage[] }) => {
    const cartItem: CartItem = {
      id: product.id,
      product: {
        id: `custom_${product.id}`, // Prefix with custom_ to identify custom orders
        name: product.name,
        basePrice: product.price,
        status: 'ACTIVE',
        images: product.designImages?.map(img => ({ 
          url: img.url || (img.file ? URL.createObjectURL(img.file) : ''),
          comment: img.comment 
        })) || []
      },
      quantity: 1,
      selectedVariations: [],
      totalPrice: product.price
    };

    setCart([...cart, cartItem]);
    handleCloseCustomModal();
  };

  // Calculate cart total including variations
  const cartTotal = cart.reduce((total, item) => total + item.totalPrice, 0);

  return (
    <div className="min-h-screen bg-white text-black">
      <Header />
      
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
              <div className="text-center text-gray-500 py-12 text-lg">
                No products found
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredProducts?.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className="group bg-white rounded-xl p-4 border border-gray-100 hover:border-gray-300 transition-all hover:shadow-lg text-left"
                  >
                    {product.images && product.images.length > 0 ? (
                      <div className="relative w-full aspect-square mb-4 rounded-xl overflow-hidden bg-gray-50">
                        <Image
                          src={product.images.find(img => img.isPrimary)?.url || product.images[0].url}
                          alt={product.name}
                          fill
                          className="object-cover transition-transform group-hover:scale-105"
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
                          {/* Show design images for custom products */}
                          {item.product.id.startsWith('custom_') && (
                            <CartItemImages images={item.product.images || []} compact />
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
        cartTotal={cartTotal}
        onCheckoutComplete={() => setCart([])}
      />

      <CustomProductModal
        isOpen={isCustomProductModalOpen}
        onClose={handleCloseCustomModal}
        onAdd={handleAddCustomProduct}
      />
    </div>
  );
}
