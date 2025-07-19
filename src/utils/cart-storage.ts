/**
 * Cart Storage Utility
 * Handles localStorage operations with data optimization to prevent quota exceeded errors
 */

import { CartItem, CustomImage } from '@/types/cart';
import toast from 'react-hot-toast';

const CART_STORAGE_KEY = 'pos-cart';
const CHECKOUT_DETAILS_KEY = 'pos-checkout-details';

/**
 * Optimizes cart data for localStorage storage by removing large/unnecessary data
 */
export const optimizeCartForStorage = (cart: CartItem[]): CartItem[] => {
  return cart.map(item => ({
    ...item,
    // Optimize product data - keep only essential fields
    product: {
      id: item.product.id,
      name: item.product.name,
      basePrice: item.product.basePrice,
      status: item.product.status,
      allowCustomPrice: item.product.allowCustomPrice,
      requiresDesign: item.product.requiresDesign,
      requiresKitchen: item.product.requiresKitchen,
      allowCustomImages: item.product.allowCustomImages,
      categoryId: item.product.categoryId,
      description: item.product.description,
      sku: item.product.sku,
      barcode: item.product.barcode,
      visibility: item.product.visibility,
      stock: item.product.stock,
      trackInventory: item.product.trackInventory,
      // Keep only essential image data (first image for display)
      images: item.product.images ? item.product.images.slice(0, 1).map(img => ({
        id: img.id,
        url: img.url,
        alt: img.alt
      })) : undefined,
      // Keep only essential variant/option data
      variants: item.product.variants ? item.product.variants.map(variant => ({
        id: variant.id,
        sku: variant.sku,
        price: variant.price,
        stock: variant.stock
      })) : undefined,
      options: item.product.options ? item.product.options.map(option => ({
        id: option.id,
        name: option.name,
        values: option.values ? option.values.map(value => ({
          id: value.id,
          value: value.value,
          position: value.position,
          price: value.price
        })) : undefined
      })) : undefined
    },
    // Optimize custom images - remove File objects and large data
    customImages: item.customImages ? item.customImages.map(img => ({
      id: img.id,
      url: img.url,
      previewUrl: img.previewUrl,
      type: img.type,
      notes: img.notes,
      comment: img.comment,
      createdAt: img.createdAt,
      // Remove File object and other large data
      file: undefined
    })) : undefined
  }));
};

/**
 * Safely saves cart to localStorage with error handling and optimization
 */
export const saveCartToStorage = (cart: CartItem[]): boolean => {
  try {
    const optimizedCart = optimizeCartForStorage(cart);
    const cartData = JSON.stringify(optimizedCart);
    
    // Check if data size is reasonable (less than 4MB to leave room for other data)
    const dataSize = new Blob([cartData]).size;
    const maxSize = 4 * 1024 * 1024; // 4MB
    
    if (dataSize > maxSize) {
      console.warn(`Cart data size (${(dataSize / 1024 / 1024).toFixed(2)}MB) exceeds recommended limit`);
      
      // Try to further optimize by removing non-essential data
      const minimalCart = cart.map(item => ({
        id: item.id,
        product: {
          id: item.product.id,
          name: item.product.name,
          basePrice: item.product.basePrice,
          allowCustomPrice: item.product.allowCustomPrice,
          requiresDesign: item.product.requiresDesign,
          requiresKitchen: item.product.requiresKitchen,
          allowCustomImages: item.product.allowCustomImages
        },
        quantity: item.quantity,
        selectedVariations: item.selectedVariations,
        totalPrice: item.totalPrice,
        notes: item.notes,
        // Keep only essential custom image data
        customImages: item.customImages ? item.customImages.map(img => ({
          id: img.id,
          url: img.url,
          comment: img.comment
        })) : undefined
      }));
      
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(minimalCart));
        toast.error('Cart data optimized due to size limits. Some product details may be simplified.');
        return true;
      } catch (minimalError) {
        console.warn('Even minimal cart data too large, trying ultra-minimal approach');
        // Ultra-minimal approach - only essential data
        const ultraMinimalCart = cart.map(item => ({
          id: item.id,
          product: {
            id: item.product.id,
            name: item.product.name,
            basePrice: item.product.basePrice
          },
          quantity: item.quantity,
          totalPrice: item.totalPrice,
          selectedVariations: item.selectedVariations.map(v => ({
            id: v.id,
            type: v.type,
            value: v.value,
            priceAdjustment: v.priceAdjustment || 0
          }))
        }));
        
        try {
          localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(ultraMinimalCart));
          toast.error('Cart saved with essential data only. Custom images and details temporarily removed.');
          return true;
        } catch (ultraError) {
          // If even ultra-minimal fails, we have a serious storage issue
          console.error('Unable to save even ultra-minimal cart data:', ultraError);
          toast.error('Storage critically full. Please clear browser data or use fewer items.');
          return false;
        }
      }
    }
    
    localStorage.setItem(CART_STORAGE_KEY, cartData);
    return true;
  } catch (error) {
    console.error('Error saving cart to localStorage:', error);
    
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      toast.error('Storage quota exceeded. Please remove some items or clear browser data.');
      
      // Try to save a minimal version of the cart
      try {
        const essentialCart = cart.map(item => ({
          id: item.id,
          product: {
            id: item.product.id,
            name: item.product.name,
            basePrice: item.product.basePrice
          },
          quantity: item.quantity,
          totalPrice: item.totalPrice,
          selectedVariations: item.selectedVariations.map(v => ({
            id: v.id,
            type: v.type,
            value: v.value,
            priceAdjustment: v.priceAdjustment
          }))
        }));
        
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(essentialCart));
        toast.success('Cart saved with minimal data to prevent storage issues.');
        return true;
      } catch (fallbackError) {
        console.error('Failed to save even minimal cart data:', fallbackError);
        toast.error('Unable to save cart. Please refresh and try again.');
        return false;
      }
    } else {
      toast.error('Unable to save cart data.');
      return false;
    }
  }
};

/**
 * Loads cart from localStorage with error handling
 */
export const loadCartFromStorage = (): CartItem[] => {
  try {
    const savedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (!savedCart) return [];
    
    const parsedCart = JSON.parse(savedCart);
    if (!Array.isArray(parsedCart)) return [];
    
    // Validate cart items
    const validatedCart = parsedCart.filter(item => {
      return item && 
             item.id && 
             item.product && 
             item.product.id && 
             item.quantity && 
             typeof item.totalPrice === 'number';
    });
    
    console.log(`Loaded ${validatedCart.length} cart items from localStorage`);
    return validatedCart;
  } catch (error) {
    console.error('Error loading cart from localStorage:', error);
    // Clear corrupted data
    localStorage.removeItem(CART_STORAGE_KEY);
    return [];
  }
};

/**
 * Clears cart from localStorage
 */
export const clearCartFromStorage = (): void => {
  try {
    localStorage.removeItem(CART_STORAGE_KEY);
    console.log('Cart cleared from localStorage');
  } catch (error) {
    console.error('Error clearing cart from localStorage:', error);
  }
};

/**
 * Clears all POS-related localStorage data to free up space
 */
export const clearAllPOSStorage = (): void => {
  try {
    localStorage.removeItem(CART_STORAGE_KEY);
    localStorage.removeItem(CHECKOUT_DETAILS_KEY);
    localStorage.removeItem('pos-loading-parked-order');
    localStorage.removeItem('pos-loaded-parked-order-id');
    console.log('All POS storage cleared');
    toast.success('Storage cleared successfully');
  } catch (error) {
    console.error('Error clearing POS storage:', error);
    toast.error('Failed to clear storage');
  }
};

/**
 * Gets current storage usage information
 */
export const getStorageInfo = () => {
  try {
    const cartData = localStorage.getItem(CART_STORAGE_KEY);
    const checkoutData = localStorage.getItem(CHECKOUT_DETAILS_KEY);
    
    const cartSize = cartData ? new Blob([cartData]).size : 0;
    const checkoutSize = checkoutData ? new Blob([checkoutData]).size : 0;
    const totalSize = cartSize + checkoutSize;
    
    // Estimate total localStorage usage
    let totalLocalStorageSize = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        totalLocalStorageSize += localStorage[key].length + key.length;
      }
    }
    
    return {
      cartSize: (cartSize / 1024).toFixed(2) + ' KB',
      checkoutSize: (checkoutSize / 1024).toFixed(2) + ' KB',
      totalPOSSize: (totalSize / 1024).toFixed(2) + ' KB',
      totalStorageSize: (totalLocalStorageSize / 1024).toFixed(2) + ' KB',
      cartItems: cartData ? JSON.parse(cartData).length : 0,
      storageUsagePercent: ((totalLocalStorageSize / (5 * 1024 * 1024)) * 100).toFixed(1) + '%' // Assuming 5MB limit
    };
  } catch (error) {
    console.error('Error getting storage info:', error);
    return {
      cartSize: 'Unknown',
      checkoutSize: 'Unknown', 
      totalPOSSize: 'Unknown',
      totalStorageSize: 'Unknown',
      cartItems: 0,
      storageUsagePercent: 'Unknown'
    };
  }
};

/**
 * Debug function to log storage information
 */
export const debugStorageUsage = (): void => {
  const info = getStorageInfo();
  console.log('=== POS Storage Usage Debug ===');
  console.log('Cart Size:', info.cartSize);
  console.log('Checkout Size:', info.checkoutSize);
  console.log('Total POS Size:', info.totalPOSSize);
  console.log('Total Storage Size:', info.totalStorageSize);
  console.log('Storage Usage:', info.storageUsagePercent);
  console.log('Cart Items:', info.cartItems);
  console.log('==============================');
};
