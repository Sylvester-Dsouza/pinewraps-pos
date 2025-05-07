'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { Clock, ArrowLeft, Trash2, ShoppingCart, RefreshCw, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { apiMethods, type Product } from '@/services/api';
import { type ParkedOrder } from '@/types/order';
import toast from 'react-hot-toast';
import Header from '@/components/header/header';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { nanoid } from 'nanoid';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

// Process image URL to use our proxy for Firebase Storage URLs
function processImageUrl(url: string): string {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    console.log('Empty or invalid URL, using placeholder');
    return '/placeholder.jpg';
  }
  
  // Handle Firebase Storage URLs
  if (url.includes('firebasestorage.googleapis.com')) {
    console.log('Using proxy for Firebase Storage URL in parked order:', url);
    return `/api/proxy/image?url=${encodeURIComponent(url)}`;
  }
  
  // Handle blob URLs
  if (url.startsWith('blob:')) {
    console.log('Found blob URL in parked order, replacing with placeholder:', url);
    return '/placeholder.jpg';
  }
  
  return url;
}

// Calculate order total from items
function calculateOrderTotal(items: any[]): number {
  if (!items || !Array.isArray(items)) return 0;
  return items.reduce((total, item) => total + (item.totalPrice || 0), 0);
}

export default function ParkedOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [parkedOrders, setParkedOrders] = useState<any[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch parked orders
  const { data: parkedOrdersData, refetch: refetchParkedOrders, isLoading: isFetching } = useQuery({
    queryKey: ['parkedOrders'],
    queryFn: async () => {
      try {
        console.log('Fetching parked orders...');
        const response = await apiMethods.pos.getParkedOrders();
        console.log('Parked orders response:', response);
        if (!response.success) {
          throw new Error(response.message || 'Failed to fetch parked orders');
        }
        return response.data;
      } catch (error) {
        console.error('Error fetching parked orders:', error);
        toast.error('Failed to load parked orders');
        return [];
      }
    },
    staleTime: 30 * 1000, // Cache for 30 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
  });

  useEffect(() => {
    if (parkedOrdersData) {
      setParkedOrders(parkedOrdersData);
      console.log('Updated parked orders:', parkedOrdersData.length);
      setIsLoading(false);
    }
  }, [parkedOrdersData]);

  // Filter orders based on search query
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return parkedOrders;

    const query = searchQuery.toLowerCase().trim();
    return parkedOrders.filter(order => {
      // Search in customer details
      const customerMatch = 
        (order.customerName?.toLowerCase().includes(query) ?? false) ||
        (order.customerPhone?.toLowerCase().includes(query) ?? false) ||
        (order.customerEmail?.toLowerCase().includes(query) ?? false);

      // Search in order ID
      const idMatch = order.id.toLowerCase().includes(query);

      // Search in order items
      const itemsMatch = order.items?.some((item: any) => 
        item.productName?.toLowerCase().includes(query)
      ) ?? false;

      return customerMatch || idMatch || itemsMatch;
    });
  }, [parkedOrders, searchQuery]);

  // Debounced search handler
  const handleSearch = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  }, []);

  // Debug function to log the structure of a parked order
  const debugParkedOrder = (order: any) => {
    // Log custom images for debugging
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach((item: any, index: number) => {
        if (item.customImages && Array.isArray(item.customImages) && item.customImages.length > 0) {
          console.log(`Item ${index} has ${item.customImages.length} custom images:`);
          item.customImages.forEach((img: any, imgIndex: number) => {
            console.log(`  Image ${imgIndex}:`, {
              url: img.url,
              processedUrl: processImageUrl(img.url),
              comment: img.comment
            });
          });
        }
      });
    }
    console.log('Parked Order ID:', order.id);
    console.log('Name:', order.name);
    console.log('Created At:', order.createdAt);
    console.log('Total Amount:', order.totalAmount);
    
    // Log customer information
    console.log('Customer Name:', order.customerName);
    console.log('Customer Phone:', order.customerPhone);
    console.log('Customer Email:', order.customerEmail);
    
    // Log items
    if (Array.isArray(order.items)) {
      console.log('Items Count:', order.items.length);
      order.items.forEach((item, index) => {
        console.log(`Item ${index + 1}:`, {
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
          hasSelectedVariations: item.selectedVariations && Array.isArray(item.selectedVariations) && item.selectedVariations.length > 0,
          hasCustomImages: item.customImages && Array.isArray(item.customImages) && item.customImages.length > 0,
          notes: item.notes
        });
      });
    } else {
      console.log('Items: Not an array or missing');
    }
    
    // Log delivery/pickup details
    console.log('Delivery Method:', order.deliveryMethod);
    if (order.deliveryMethod === 'DELIVERY') {
      console.log('Delivery Details:', {
        date: order.deliveryDate,
        timeSlot: order.deliveryTimeSlot,
        instructions: order.deliveryInstructions,
        charge: order.deliveryCharge,
        streetAddress: order.streetAddress,
        apartment: order.apartment,
        emirate: order.emirate,
        city: order.city
      });
    } else if (order.deliveryMethod === 'PICKUP') {
      console.log('Pickup Details:', {
        date: order.pickupDate,
        timeSlot: order.pickupTimeSlot
      });
    }
    
    // Log gift details if available
    if (order.isGift) {
      console.log('Gift Details:', {
        isGift: order.isGift,
        recipientName: order.giftRecipientName,
        recipientPhone: order.giftRecipientPhone,
        message: order.giftMessage,
        cashAmount: order.giftCashAmount
      });
    }
  };

  // Load a parked order into the POS
  const handleLoadParkedOrder = async (order: any) => {
    try {
      console.log('Loading parked order:', order);
      console.log('Delivery method:', order.deliveryMethod);
      
      // Close the order details if it's expanded
      if (expandedOrders[order.id]) {
        toggleOrderExpanded(order.id);
      }

      // Debug the order structure
      debugParkedOrder(order);

      // Log customer information
      console.log('Customer information:', {
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerEmail: order.customerEmail
      });

      // Ensure the order has all required fields
      if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
        console.error('Order is missing items array or has no items');
        toast.error('Invalid order data');
        return;
      }

      // Normalize delivery method - ensure it's uppercase and a valid value
      const normalizedDeliveryMethod = 
        (order.deliveryMethod && order.deliveryMethod.toUpperCase() === 'DELIVERY') 
          ? 'DELIVERY' 
          : 'PICKUP';
      
      console.log('Normalized delivery method:', normalizedDeliveryMethod);
      
      // Format cart items - ensure all required fields are present and use product data when available
      const cartItems = order.items.map((item: any) => {
        console.log('Processing item:', JSON.stringify(item, null, 2));
        
        // Get product data from the item's product relation or use the item data as fallback
        const fetchedProduct = item.product || null;
        
        // Create a product object with all the necessary data
        const product: Product = {
          id: item.productId || '',
          name: item.productName || '',
          description: fetchedProduct?.description || '',
          sku: fetchedProduct?.sku || '',
          status: (fetchedProduct?.status || 'ACTIVE') as 'ACTIVE' | 'DRAFT',
          basePrice: item.unitPrice || 0,
          stock: fetchedProduct?.stock || 0,
          trackInventory: fetchedProduct?.trackInventory || false,
          categoryId: fetchedProduct?.categoryId || '',
          options: fetchedProduct?.options || [],
          variants: fetchedProduct?.variants || [],
          images: fetchedProduct?.images || [],
          visibility: fetchedProduct?.visibility || 'ALL',
          allowCustomPrice: fetchedProduct?.allowCustomPrice || false,
          allowCustomImages: fetchedProduct?.allowCustomImages || false,
          requiresKitchen: fetchedProduct?.requiresKitchen || false,
          requiresDesign: fetchedProduct?.requiresDesign || false
        };
        
        // Process selected variations - ensure they have proper structure
        let selectedVariations = [];
        if (item.selectedVariations && Array.isArray(item.selectedVariations)) {
          selectedVariations = item.selectedVariations.map((v: any) => ({
            id: v.id || nanoid(),
            type: v.type || 'Option',
            value: v.value || '',
            priceAdjustment: parseFloat(String(v.price)) || 0
          }));
        }
        
        // Process custom images - ensure they have proper structure
        let customImages = [];
        if (item.customImages && Array.isArray(item.customImages)) {
          customImages = item.customImages.map((img: any) => {
            // Handle Firebase Storage URLs
            let imageUrl = img.url || '';
            
            // Use our proxy API for Firebase Storage URLs
            if (imageUrl && imageUrl.includes('firebasestorage.googleapis.com')) {
              console.log('Using proxy for Firebase Storage URL in parked order:', imageUrl);
              // Don't encode here - the ImageUpload component will handle it
              // We just pass the original URL and let the component handle proxying
            }
            
            // Skip blob URLs as they can't be loaded across sessions
            if (imageUrl && imageUrl.startsWith('blob:')) {
              console.log('Found blob URL in parked order, replacing with placeholder:', imageUrl);
              imageUrl = '/placeholder.jpg';
            }
            
            return {
              id: img.id || nanoid(),
              url: imageUrl,
              // Don't use previewUrl from storage as it might be a blob URL
              previewUrl: imageUrl,
              comment: img.comment || ''
            };
          });
        }
        
        // Create a properly formatted cart item
        return {
          id: item.id || nanoid(), // Generate a unique ID for each cart item
          product,
          quantity: item.quantity || 1,
          selectedVariations,
          notes: item.notes || '',
          customImages,
          totalPrice: item.totalPrice || 0,
          metadata: {
            requiresKitchen: product.requiresKitchen,
            requiresDesign: product.requiresDesign,
            allowCustomImages: product.allowCustomImages
          }
        };
      });

      console.log('Formatted cart items:', JSON.stringify(cartItems, null, 2));
      
      // Make sure we have cart items
      if (cartItems.length === 0) {
        console.error('No valid cart items could be created from the parked order');
        toast.error('Could not load order items. Please try again.');
        return;
      }

      // Create checkout details object with direct fields
      const checkoutDetails = {
        customerDetails: {
          name: order.customerName || '',
          email: order.customerEmail || '',
          phone: order.customerPhone || ''
        },
        deliveryMethod: normalizedDeliveryMethod as 'PICKUP' | 'DELIVERY',
        deliveryDetails: normalizedDeliveryMethod === 'DELIVERY' ? {
          date: order.deliveryDate ? new Date(order.deliveryDate).toISOString().split('T')[0] : '',
          timeSlot: order.deliveryTimeSlot || '',
          instructions: order.deliveryInstructions || '',
          streetAddress: order.streetAddress || '',
          apartment: order.apartment || '',
          emirate: order.emirate || '',
          city: order.city || '',
          charge: order.deliveryCharge || 0,
        } : undefined,
        pickupDetails: normalizedDeliveryMethod === 'PICKUP' ? {
          date: order.pickupDate ? new Date(order.pickupDate).toISOString().split('T')[0] : '',
          timeSlot: order.pickupTimeSlot || '',
        } : undefined,
        giftDetails: order.isGift ? {
          isGift: order.isGift || false,
          recipientName: order.giftRecipientName || '',
          recipientPhone: order.giftRecipientPhone || '',
          message: order.giftMessage || '',
          cashAmount: order.giftCashAmount || 0,
          includeCash: order.giftCashAmount ? true : false,
          note: ''
        } : undefined,
        name: order.name || '',
        notes: order.notes || ''
      };

      console.log('Checkout details:', checkoutDetails);

      // Build the URL with parameters to pass to the POS page
      const params = new URLSearchParams();
      params.append('orderId', order.id);
      params.append('customerName', order.customerName || '');
      params.append('customerEmail', order.customerEmail || '');
      params.append('customerPhone', order.customerPhone || '');
      params.append('deliveryMethod', normalizedDeliveryMethod);
      
      // Store cart items and checkout details in localStorage for the POS page to access
      localStorage.setItem('pos-cart', JSON.stringify(cartItems));
      localStorage.setItem('pos-checkout-details', JSON.stringify(checkoutDetails));
      
      // Set a flag in localStorage to indicate we're loading a parked order
      localStorage.setItem('pos-loading-parked-order', 'true');
      
      // Navigate to POS page with minimal parameters
      // This prevents URL parameters from affecting subsequent orders
      router.push('/pos');
      
      toast.success('Order loaded successfully');
    } catch (error) {
      console.error('Error loading parked order:', error);
      toast.error('Failed to load order');
    }
  };

  // Handle delete order
  const handleDeleteParkedOrder = async (orderId: string) => {
    try {
      console.log('Deleting parked order:', orderId);
      const response = await apiMethods.pos.deleteParkedOrder(orderId);
      
      // Even if we get an error response, the order might have been deleted
      // So we'll refetch the orders list regardless
      console.log('Delete response:', response);
      
      if (response && response.success) {
        toast.success('Order deleted successfully');
      } else {
        console.warn('Received unsuccessful response but order might be deleted:', response);
        toast.error('Order may have been deleted, refreshing list...');
      }
      
      // Always clean up the UI state
      setOrderToDelete(null);
      setIsDeleteDialogOpen(false);
      
      // Always refetch to get the current state from the server
      refetchParkedOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
      
      // Even on error, the deletion might have succeeded on the server
      toast.error('Error occurred, but order may have been deleted. Refreshing list...');
      
      // Clean up UI state
      setOrderToDelete(null);
      setIsDeleteDialogOpen(false);
      
      // Refetch to check the current state
      refetchParkedOrders();
    }
  };

  // Confirm delete
  const confirmDelete = (orderId: string) => {
    setOrderToDelete(orderId);
    setIsDeleteDialogOpen(true);
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
  if (authLoading || !user || isLoading) {
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
      <Header title="Parked Orders" />
      
      <main className="container mx-auto px-4 py-8">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by customer name, phone, email, or order ID..."
              value={searchQuery}
              onChange={handleSearch}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div>
          {isLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="mt-2 text-gray-600">Loading orders...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">
                {searchQuery ? 'No orders found matching your search.' : 'No parked orders available.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white shadow-sm border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col h-full">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-medium text-lg truncate">
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
                    
                    <div className="flex items-center text-sm text-gray-500 mb-3">
                      <Clock className="mr-1 h-4 w-4" />
                      <span>
                        {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    
                    {/* Summary info always visible */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="text-sm bg-gray-100 px-2 py-1 rounded">
                        {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                      </span>
                      <span className="text-sm bg-gray-100 px-2 py-1 rounded">
                        AED {(order.totalAmount || calculateOrderTotal(order.items)).toFixed(2)}
                      </span>
                      {order.deliveryMethod && (
                        <span className={`text-sm px-2 py-1 rounded ${
                          order.deliveryMethod === 'DELIVERY' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {order.deliveryMethod === 'DELIVERY' ? 'Delivery' : 'Pickup'}
                        </span>
                      )}
                    </div>
                    
                    {/* Expanded content */}
                    {isOrderExpanded(order.id) && (
                      <div className="border-t border-gray-100 pt-3">
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
                        
                        {/* Payment Information */}
                        {(order.paymentMethod || order.paymentReference) && (
                          <div className="mt-3 border-t border-gray-100 pt-3">
                            <p className="font-medium text-sm">Payment:</p>
                            <div className="mt-1 text-sm">
                              {order.paymentMethod && <p>Method: {order.paymentMethod}</p>}
                              {order.paymentReference && <p>Reference: {order.paymentReference}</p>}
                            </div>
                          </div>
                        )}
                        
                        {/* Delivery/Pickup Information */}
                        <div className="mt-3 border-t border-gray-100 pt-3">
                          <p className="font-medium text-sm">
                            {(order.deliveryMethod && order.deliveryMethod.toUpperCase() === 'DELIVERY') 
                              ? 'Delivery Details:' 
                              : 'Pickup Details:'}
                          </p>
                          <div className="mt-1 text-sm">
                            {(order.deliveryMethod && order.deliveryMethod.toUpperCase() === 'DELIVERY') && (
                              <>
                                {order.deliveryDate && <p>Date: {order.deliveryDate}</p>}
                                {order.deliveryTimeSlot && <p>Time: {order.deliveryTimeSlot}</p>}
                                {order.streetAddress && (
                                  <p>Address: {order.streetAddress}{order.apartment ? `, ${order.apartment}` : ''}</p>
                                )}
                                {(order.emirate || order.city) && (
                                  <p>Location: {order.city}{order.emirate ? `, ${order.emirate}` : ''}</p>
                                )}
                                {order.deliveryInstructions && (
                                  <p>Instructions: {order.deliveryInstructions}</p>
                                )}
                                {order.deliveryCharge && (
                                  <p>Delivery Charge: AED {order.deliveryCharge.toFixed(2)}</p>
                                )}
                              </>
                            )}
                            {(order.deliveryMethod && order.deliveryMethod.toUpperCase() !== 'DELIVERY') && (
                              <>
                                {order.pickupDate && (
                                  <p>Date: {order.pickupDate}</p>
                                )}
                                {order.pickupTimeSlot && (
                                  <p>Time: {order.pickupTimeSlot}</p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        
                        {/* Address Details (if separate from delivery details) */}
                        {order.addressDetails && order.deliveryMethod !== 'DELIVERY' && (
                          <div className="mt-3 border-t border-gray-100 pt-3">
                            <p className="font-medium text-sm">Address Details:</p>
                            <div className="mt-1 text-sm">
                              {order.addressDetails.streetAddress && (
                                <p>Address: {order.addressDetails.streetAddress}</p>
                              )}
                              {order.addressDetails.apartment && (
                                <p>Apt/Villa: {order.addressDetails.apartment}</p>
                              )}
                              {order.addressDetails.emirate && (
                                <p>Emirate: {order.addressDetails.emirate.replace('_', ' ')}</p>
                              )}
                              {order.addressDetails.city && (
                                <p>City: {order.addressDetails.city}</p>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Gift Details */}
                        {order.isGift && (
                          <div className="mt-3 border-t border-gray-100 pt-3">
                            <p className="font-medium text-sm">Gift Details:</p>
                            <div className="mt-1 text-sm">
                              {order.giftRecipientName && (
                                <p>Recipient: {order.giftRecipientName}</p>
                              )}
                              {order.giftRecipientPhone && (
                                <p>Recipient Phone: {order.giftRecipientPhone}</p>
                              )}
                              {order.giftMessage && (
                                <p>Message: {order.giftMessage}</p>
                              )}
                              {order.giftCashAmount && (
                                <p>Cash Gift: AED {order.giftCashAmount.toFixed(2)}</p>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Order Items */}
                        {order.items && Array.isArray(order.items) && order.items.length > 0 ? (
                          <div className="mt-3 border-t border-gray-100 pt-3">
                            <p className="font-medium text-sm">Order Items:</p>
                            <div className="mt-1 text-sm max-h-60 overflow-y-auto">
                              {order.items.map((item, index) => (
                                <div key={index} className="py-2 border-b border-gray-100 last:border-b-0">
                                  <div className="flex justify-between">
                                    <span className="font-medium">{item.productName} x{item.quantity}</span>
                                    <span>AED {item.totalPrice.toFixed(2)}</span>
                                  </div>
                                  <p className="text-xs text-gray-500">Unit Price: AED {item.unitPrice.toFixed(2)}</p>
                                  
                                  {/* Product details */}
                                  {(item.product?.sku || item.product?.barcode) && (
                                    <div className="text-xs text-gray-500 flex flex-wrap gap-2 mt-1">
                                      {item.product?.sku && <span>SKU: {item.product.sku}</span>}
                                      {item.product?.barcode && <span>Barcode: {item.product.barcode}</span>}
                                    </div>
                                  )}
                                  
                                  {/* Product metadata */}
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {item.product?.requiresKitchen && (
                                      <span className="text-xs bg-yellow-100 px-1 rounded">Kitchen</span>
                                    )}
                                    {item.product?.requiresDesign && (
                                      <span className="text-xs bg-blue-100 px-1 rounded">Design</span>
                                    )}
                                    {item.selectedVariations && item.selectedVariations.length > 0 && (
                                      <span className="text-xs bg-purple-100 px-1 rounded">Variations</span>
                                    )}
                                    {item.customImages && item.customImages.length > 0 && (
                                      <span className="text-xs bg-green-100 px-1 rounded">Custom Images</span>
                                    )}
                                  </div>
                                  
                                  {/* Variations */}
                                  {item.selectedVariations && item.selectedVariations.length > 0 && (
                                    <div className="mt-1 pl-2 border-l-2 border-purple-200">
                                      <p className="text-xs font-medium text-purple-700">Variations:</p>
                                      <div className="text-xs space-y-1 mt-1">
                                        {item.selectedVariations.map((variation, variationIndex) => (
                                          <div key={variationIndex} className="flex justify-between">
                                            <div>
                                              <span className="font-medium">{variation.type}:</span> {variation.value}
                                            </div>
                                            {variation.price > 0 && (
                                              <span className="text-green-600">+AED {variation.price.toFixed(2)}</span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Custom Images */}
                                  {item.customImages && item.customImages.length > 0 && (
                                    <div className="mt-1 pl-2 border-l-2 border-green-200">
                                      <p className="text-xs font-medium text-green-700">Custom Images:</p>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {item.customImages.map((image, imageIndex) => (
                                          <div key={imageIndex} className="text-xs">
                                            <img 
                                              src={processImageUrl(image.url)} 
                                              alt="Custom" 
                                              className="w-10 h-10 object-cover rounded border border-gray-200" 
                                              onError={(e) => {
                                                // Only set placeholder if not already set
                                                if (e.currentTarget.src !== '/placeholder.jpg') {
                                                  console.log('Image load error, using placeholder for:', image.url);
                                                  e.currentTarget.src = '/placeholder.jpg';
                                                }
                                              }}
                                            />
                                            {image.comment && <p className="text-xs">{image.comment}</p>}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Notes */}
                                  {item.notes && (
                                    <div className="mt-1 pl-2 border-l-2 border-gray-200">
                                      <p className="text-xs font-medium text-gray-700">Notes:</p>
                                      <p className="text-xs">{item.notes}</p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 border-t border-gray-100 pt-2 flex justify-between font-medium">
                              <span>Total:</span>
                              <span>AED {(order.totalAmount || calculateOrderTotal(order.items)).toFixed(2)}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 border-t border-gray-100 pt-3">
                            <p className="font-medium text-sm">Order Items:</p>
                            <p className="mt-1 text-sm text-gray-500">No items found for this order.</p>
                          </div>
                        )}
                        
                        {order.notes && (
                          <div className="mt-3 border-t border-gray-100 pt-3">
                            <p className="font-medium text-sm">Notes:</p>
                            <p className="mt-1 text-sm">{order.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="mt-auto pt-4 flex space-x-2">
                      <button
                        onClick={() => handleLoadParkedOrder(order)}
                        className="flex-1 px-3 py-2 text-sm bg-black text-white rounded-md hover:bg-gray-800"
                      >
                        Load Order
                      </button>
                      <button
                        onClick={() => confirmDelete(order.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                        aria-label="Delete order"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Bottom refresh button */}
          {filteredOrders.length > 0 && (
            <div className="mt-8 text-center">
              <button
                onClick={() => refetchParkedOrders()}
                className="inline-flex items-center px-4 py-2 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                disabled={isFetching}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                <span>Refresh Orders</span>
              </button>
            </div>
          )}
        </div>
      </main>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this order? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOrderToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => orderToDelete && handleDeleteParkedOrder(orderToDelete)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

}
