'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { Clock, ArrowLeft, Trash2, ShoppingCart, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { apiMethods, type PosQueuedOrder, type Product } from '@/services/api';
import toast from 'react-hot-toast';
import Header from '@/components/header/header';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { nanoid } from 'nanoid';

export default function QueuedOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [queuedOrders, setQueuedOrders] = useState<PosQueuedOrder[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<{[key: string]: boolean}>({});

  // Fetch queued orders
  const { data: queuedOrdersData, refetch: refetchQueuedOrders, isLoading } = useQuery({
    queryKey: ['queuedOrders'],
    queryFn: async () => {
      try {
        const response = await apiMethods.pos.getQueuedOrders();
        if (!response.success) {
          throw new Error(response.message || 'Failed to fetch queued orders');
        }
        return response.data;
      } catch (error) {
        console.error('Error fetching queued orders:', error);
        toast.error('Failed to load queued orders');
        return [];
      }
    },
    staleTime: 30 * 1000, // Cache for 30 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
  });

  useEffect(() => {
    if (queuedOrdersData) {
      setQueuedOrders(queuedOrdersData);
      console.log('Updated queued orders:', queuedOrdersData.length);
    }
  }, [queuedOrdersData]);

  // Set up automatic refresh
  useEffect(() => {
    // Refresh on component mount
    refetchQueuedOrders();
    
    // Set up interval for automatic refresh
    const intervalId = setInterval(() => {
      refetchQueuedOrders();
    }, 15000); // Refresh every 15 seconds
    
    return () => clearInterval(intervalId);
  }, [refetchQueuedOrders]);

  // Debug function to log the full structure of a queued order
  const debugQueuedOrder = (order: any) => {
    console.log('Queued Order Structure:', JSON.stringify(order, null, 2));
    
    // Log specific important parts
    console.log('Order ID:', order.id);
    console.log('Created At:', order.createdAt);
    console.log('Total Amount:', order.totalAmount);
    
    // Log customer details
    console.log('Customer Details:', {
      name: order.customerName,
      email: order.customerEmail,
      phone: order.customerPhone
    });
    
    // Log items
    if (Array.isArray(order.items)) {
      console.log(`Items (${order.items.length}):`, order.items.map(item => ({
        id: item.id,
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        hasVariations: Array.isArray(item.selectedVariations) && item.selectedVariations.length > 0,
        hasCustomImages: Array.isArray(item.customImages) && item.customImages.length > 0
      })));
    } else {
      console.log('Items: Not an array or missing');
    }
    
    // Log delivery/pickup details
    console.log('Delivery Method:', order.deliveryMethod);
    if (order.deliveryMethod === 'DELIVERY' && order.deliveryDetails) {
      console.log('Delivery Details:', order.deliveryDetails);
    } else if (order.deliveryMethod === 'PICKUP' && order.pickupDetails) {
      console.log('Pickup Details:', order.pickupDetails);
    }
    
    // Log order summary if available
    if (order.orderSummary) {
      console.log('Order Summary:', order.orderSummary);
    }
  };

  // Load a queued order into the POS
  const handleLoadQueuedOrder = async (order: any) => {
    try {
      // Debug the order structure
      debugQueuedOrder(order);
      
      console.log('Original order data:', JSON.stringify(order, null, 2));
      
      // Check if items exist in the order
      if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
        console.error('No items found in the queued order:', order);
        toast.error('This order has no items to load');
        return;
      }
      
      // Collect all product IDs from the order items
      const productIds = order.items.map((item: any) => item.productId).filter(Boolean);
      console.log('Product IDs to fetch:', productIds);
      
      // Fetch product data for all products in the order
      let productData: { [key: string]: Product } = {};
      
      if (productIds.length > 0) {
        try {
          // Fetch products from API
          const response = await apiMethods.products.getProductsByIds(productIds);
          if (response.success && Array.isArray(response.data)) {
            // Create a map of product ID to product data
            const productMap: { [key: string]: Product } = {};
            response.data.forEach(product => {
              productMap[product.id] = product;
            });
            productData = productMap;
            console.log('Fetched product data:', productData);
          } else {
            console.error('Failed to fetch product data:', response);
          }
        } catch (error) {
          console.error('Error fetching product data:', error);
        }
      }
      
      // Format cart items - ensure all required fields are present and use product data when available
      const cartItems = Array.isArray(order.items) ? order.items.map((item: any) => {
        console.log('Processing item:', JSON.stringify(item, null, 2));
        
        // Get product data from the fetched products or use the item data as fallback
        const fetchedProduct = item.productId ? productData[item.productId] : null;
        
        // Ensure we have a valid product object
        const product: Product = {
          id: item.productId || '',
          name: fetchedProduct?.name || item.name || 'Unknown Product',
          description: fetchedProduct?.description || item.description || '',
          sku: fetchedProduct?.sku || item.sku || '',
          status: (fetchedProduct?.status || 'ACTIVE') as 'ACTIVE' | 'DRAFT',
          basePrice: fetchedProduct?.basePrice || parseFloat(String(item.unitPrice)) || 0,
          stock: fetchedProduct?.stock || 0,
          trackInventory: fetchedProduct?.trackInventory || false,
          categoryId: fetchedProduct?.categoryId || item.categoryId || '',
          options: fetchedProduct?.options || [],
          variants: fetchedProduct?.variants || item.variants || [],
          images: fetchedProduct?.images || item.images || [],
          visibility: fetchedProduct?.visibility || 'ALL',
          allowCustomPrice: fetchedProduct?.allowCustomPrice || item.allowCustomPrice || false,
          requiresDesign: fetchedProduct?.requiresDesign || item.requiresDesign || item.metadata?.requiresDesign || false,
          requiresKitchen: fetchedProduct?.requiresKitchen || item.requiresKitchen || item.metadata?.requiresKitchen || false,
          allowCustomImages: fetchedProduct?.allowCustomImages || item.allowCustomImages || false
        };
        
        // Process selected variations - ensure they have proper structure
        let selectedVariations = [];
        if (item.selectedVariations && Array.isArray(item.selectedVariations)) {
          selectedVariations = item.selectedVariations.map((v: any) => ({
            id: v.id || nanoid(),
            type: v.type || 'Option',
            value: v.value || '',
            price: parseFloat(String(v.price)) || 0
          }));
        } else if (item.variants && Array.isArray(item.variants)) {
          // If selectedVariations is missing but variants exists, use that
          selectedVariations = item.variants.map((v: any) => ({
            id: v.id || nanoid(),
            type: v.type || 'Option',
            value: v.value || '',
            price: parseFloat(String(v.price)) || 0
          }));
        }
        
        // Process custom images - ensure they have proper structure
        let customImages = [];
        if (item.customImages && Array.isArray(item.customImages)) {
          customImages = item.customImages.map((img: any) => ({
            id: img.id || nanoid(),
            url: img.url || '',
            previewUrl: img.previewUrl || '',
            comment: img.comment || ''
          }));
        }
        
        // Create a properly formatted cart item
        return {
          id: item.id || nanoid(), // Generate a unique ID for each cart item
          product,
          quantity: parseInt(String(item.quantity)) || 1,
          selectedVariations,
          notes: item.notes || '',
          customImages,
          totalPrice: parseFloat(String(item.totalPrice)) || 0,
          metadata: item.metadata || {}
        };
      }) : [];

      console.log('Formatted cart items:', JSON.stringify(cartItems, null, 2));
      
      // Make sure we have cart items
      if (cartItems.length === 0) {
        console.error('No valid cart items could be created from the queued order');
        toast.error('Could not load order items. Please try again.');
        return;
      }

      // Format checkout details
      const checkoutDetails = {
        customerDetails: {
          name: order.customerName || '',
          email: order.customerEmail || '',
          phone: order.customerPhone || '',
        },
        deliveryMethod: order.deliveryMethod || 'PICKUP',
        deliveryDetails: order.deliveryMethod === 'DELIVERY' ? {
          date: order.deliveryDetails?.date || '',
          timeSlot: order.deliveryDetails?.timeSlot || '',
          instructions: order.deliveryDetails?.instructions || '',
          streetAddress: order.deliveryDetails?.streetAddress || '',
          apartment: order.deliveryDetails?.apartment || '',
          emirate: order.deliveryDetails?.emirate || '',
          city: order.deliveryDetails?.city || '',
          charge: order.deliveryDetails?.charge || 0,
        } : {
          date: '',
          timeSlot: '',
          instructions: '',
          streetAddress: '',
          apartment: '',
          emirate: '',
          city: '',
          charge: 0,
        },
        pickupDetails: {
          date: order.pickupDetails?.date || '',
          timeSlot: order.pickupDetails?.timeSlot || '',
        },
        giftDetails: {
          isGift: order.giftDetails?.isGift || false,
          recipientName: order.giftDetails?.recipientName || '',
          recipientPhone: order.giftDetails?.recipientPhone || '',
          message: order.giftDetails?.message || '',
          note: order.giftDetails?.note || '',
          cashAmount: order.giftDetails?.cashAmount || 0,
          includeCash: order.giftDetails?.includeCash || false,
        },
        paymentMethod: order.paymentMethod || 'CASH',
        paymentReference: order.paymentReference || '',
        orderSummary: order.orderSummary ? {
          totalItems: order.orderSummary.totalItems || cartItems.length,
          products: Array.isArray(order.orderSummary.products) 
            ? order.orderSummary.products.map((p: any) => ({
                id: p.id || '',
                productId: p.productId || '',
                productName: p.name || 'Unknown Product',
                quantity: parseInt(String(p.quantity)) || 1,
                price: parseFloat(String(p.price)) || 0,
                unitPrice: parseFloat(String(p.unitPrice)) || 0,
                sku: p.sku || '',
                requiresKitchen: p.requiresKitchen || false,
                requiresDesign: p.requiresDesign || false,
                hasVariations: p.hasVariations || false,
                hasCustomImages: p.hasCustomImages || false
              }))
            : cartItems.map(item => ({
                id: item.id,
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
          totalAmount: parseFloat(String(order.orderSummary.totalAmount)) || 
            parseFloat(String(order.totalAmount)) || 
            cartItems.reduce((sum, item) => sum + item.totalPrice, 0)
        } : {
          totalItems: cartItems.length,
          products: cartItems.map(item => ({
            id: item.id,
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
          totalAmount: parseFloat(String(order.totalAmount)) || cartItems.reduce((total, item) => total + item.totalPrice, 0)
        }
      };

      console.log('Loading queued order with checkout details:', checkoutDetails);
      console.log('Loading queued order with cart items:', cartItems);

      // First clear any existing cart items and checkout details
      localStorage.removeItem('cartItems');
      localStorage.removeItem('checkoutDetails');
      localStorage.removeItem('pos-cart');
      
      // Then save the new data to localStorage
      localStorage.setItem('cartItems', JSON.stringify(cartItems));
      localStorage.setItem('checkoutDetails', JSON.stringify(checkoutDetails));
      
      // Set the flag to open checkout modal
      localStorage.setItem('openCheckoutModal', 'true');

      // Navigate to POS page
      router.push('/pos');
      
      toast.success('Order loaded successfully');
    } catch (error) {
      console.error('Error loading queued order:', error);
      toast.error('Failed to load queued order');
    }
  };

  // Function to delete a queued order
  const handleDeleteQueuedOrder = async (orderId: string) => {
    try {
      const response = await apiMethods.pos.deleteQueuedOrder(orderId);
      
      if (response.success) {
        toast.success('Queued order deleted successfully');
        refetchQueuedOrders();
      } else {
        toast.error(response.message || 'Failed to delete queued order');
      }
    } catch (error) {
      console.error('Error deleting queued order:', error);
      toast.error('Failed to delete queued order');
    }
  };

  // Toggle expanded state for an order
  const toggleOrderExpanded = (orderId: string) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  // Check if an order is expanded
  const isOrderExpanded = (orderId: string) => {
    return !!expandedOrders[orderId];
  };

  // If still loading or no user, show loading state
  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-black mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Queued Orders" />
      
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center mb-6">
          <button 
            onClick={() => router.push('/pos')}
            className="flex items-center text-gray-700 hover:text-black"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            <span>Back to POS</span>
          </button>
          
          <button
            onClick={() => refetchQueuedOrders()}
            className="ml-auto flex items-center px-3 py-1 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold mb-6">Queued Orders</h1>
          
          {isLoading ? (
            <div className="py-8 text-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-black mx-auto"></div>
              <p className="mt-2">Loading orders...</p>
            </div>
          ) : queuedOrders.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-lg">No queued orders</p>
              <button 
                onClick={() => router.push('/pos')}
                className="mt-4 px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800"
              >
                Return to POS
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {queuedOrders.map((order) => (
                <div
                  key={order.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="w-full">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium text-lg">
                          {order.name || `Order #${order.id.substring(0, 8)}`}
                        </h4>
                        <button 
                          onClick={() => toggleOrderExpanded(order.id)}
                          className="p-1 rounded-full hover:bg-gray-200"
                        >
                          {isOrderExpanded(order.id) ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                      
                      <div className="mt-1 flex items-center text-sm text-gray-500">
                        <Clock className="mr-1 h-4 w-4" />
                        <span>
                          {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      
                      {/* Summary info always visible */}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="text-sm bg-gray-100 px-2 py-1 rounded">
                          {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                        </span>
                        <span className="text-sm bg-gray-100 px-2 py-1 rounded">
                          AED {order.totalAmount.toFixed(2)}
                        </span>
                        {order.deliveryMethod && (
                          <span className="text-sm bg-gray-100 px-2 py-1 rounded">
                            {order.deliveryMethod}
                          </span>
                        )}
                      </div>
                      
                      {/* Detailed info only visible when expanded */}
                      {isOrderExpanded(order.id) && (
                        <div className="mt-3 animate-fadeIn">
                          {/* Customer Information */}
                          {(order.customerName || order.customerPhone || order.customerEmail) && (
                            <div className="mt-3 border-t border-gray-100 pt-3">
                              <p className="font-medium text-sm">Customer:</p>
                              <div className="mt-1 text-sm">
                                {order.customerName && <p>{order.customerName}</p>}
                                {order.customerPhone && <p>Phone: {order.customerPhone}</p>}
                                {order.customerEmail && <p>Email: {order.customerEmail}</p>}
                              </div>
                            </div>
                          )}
                          
                          {/* Delivery/Pickup Information */}
                          <div className="mt-3 border-t border-gray-100 pt-3">
                            <p className="font-medium text-sm">
                              {order.deliveryMethod === 'DELIVERY' ? 'Delivery Details:' : 'Pickup Details:'}
                            </p>
                            <div className="mt-1 text-sm">
                              {order.deliveryMethod === 'DELIVERY' && order.deliveryDetails && (
                                <>
                                  {order.deliveryDetails.date && order.deliveryDetails.timeSlot && (
                                    <p>When: {order.deliveryDetails.date}, {order.deliveryDetails.timeSlot}</p>
                                  )}
                                  {order.deliveryDetails.streetAddress && (
                                    <p>Address: {order.deliveryDetails.streetAddress}</p>
                                  )}
                                  {order.deliveryDetails.apartment && (
                                    <p>Apt/Villa: {order.deliveryDetails.apartment}</p>
                                  )}
                                  {order.deliveryDetails.emirate && (
                                    <p>Emirate: {order.deliveryDetails.emirate.replace('_', ' ')}</p>
                                  )}
                                  {order.deliveryDetails.city && (
                                    <p>City: {order.deliveryDetails.city}</p>
                                  )}
                                  {order.deliveryDetails.charge > 0 && (
                                    <p>Delivery Charge: AED {order.deliveryDetails.charge.toFixed(2)}</p>
                                  )}
                                  {order.deliveryDetails.instructions && (
                                    <p>Instructions: {order.deliveryDetails.instructions}</p>
                                  )}
                                </>
                              )}
                              
                              {order.deliveryMethod === 'PICKUP' && order.pickupDetails && (
                                <>
                                  {order.pickupDetails.date && (
                                    <p>Date: {order.pickupDetails.date}</p>
                                  )}
                                  {order.pickupDetails.timeSlot && (
                                    <p>Time: {order.pickupDetails.timeSlot}</p>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          
                          {/* Gift Details */}
                          {order.giftDetails && order.giftDetails.isGift && (
                            <div className="mt-3 border-t border-gray-100 pt-3">
                              <p className="font-medium text-sm">Gift Details:</p>
                              <div className="mt-1 text-sm">
                                {order.giftDetails.recipientName && (
                                  <p>Recipient: {order.giftDetails.recipientName}</p>
                                )}
                                {order.giftDetails.recipientPhone && (
                                  <p>Recipient Phone: {order.giftDetails.recipientPhone}</p>
                                )}
                                {order.giftDetails.message && (
                                  <p>Message: {order.giftDetails.message}</p>
                                )}
                                {order.giftDetails.includeCash && (
                                  <p>Cash Gift: AED {order.giftDetails.cashAmount.toFixed(2)}</p>
                                )}
                                {order.giftDetails.note && (
                                  <p>Note: {order.giftDetails.note}</p>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {order.notes && (
                            <div className="mt-3 border-t border-gray-100 pt-3">
                              <p className="font-medium text-sm">Notes:</p>
                              <p className="mt-1 text-sm">{order.notes}</p>
                            </div>
                          )}
                          
                          {/* Display order summary if available */}
                          {order.orderSummary && order.orderSummary.products && (
                            <div className="mt-3 border-t border-gray-100 pt-3">
                              <p className="font-medium text-sm">Order Items:</p>
                              <div className="mt-1 max-h-40 overflow-y-auto">
                                {order.orderSummary.products.map((product, idx) => (
                                  <div key={idx} className="flex justify-between text-sm py-1">
                                    <span>{product.productName} x{product.quantity}</span>
                                    <span>AED {(product.price || 0).toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-4 flex space-x-2">
                    <button
                      onClick={() => handleLoadQueuedOrder(order)}
                      className="flex-1 px-3 py-2 text-sm bg-black text-white rounded-md hover:bg-gray-800"
                    >
                      Load Order
                    </button>
                    <button
                      onClick={() => handleDeleteQueuedOrder(order.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                      aria-label="Delete order"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
