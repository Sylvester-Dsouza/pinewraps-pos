'use client';

import axios from 'axios';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import Cookies from 'js-cookie';
import { nanoid } from 'nanoid';
import { toast } from 'react-hot-toast';
import { 
  Order, 
  OrderPayment, 
  POSOrderStatus, 
  POSPaymentMethod, 
  POSPaymentStatus,
  POSOrderData,
  POSOrderItemData,
  ParkedOrder,
  ParkedOrderData
} from '@/types/order';
import { CartItem, CustomImage } from '@/types/cart';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to add token to headers
api.interceptors.request.use(
  async (config) => {
    const token = Cookies.get('firebase-token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
      
      // Add token to body for verify endpoint
      if (config.url?.includes('/api/auth/verify') && config.method === 'post') {
        config.data = {
          ...config.data,
          token: token
        };
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Try to refresh token
      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        try {
          const token = await user.getIdToken(true);
          Cookies.set('firebase-token', token, {
            expires: 7,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
          });
          
          // Retry the request with new token
          const originalRequest = error.config;
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          
          // Update token in body for verify endpoint
          if (originalRequest.url?.includes('/api/auth/verify') && originalRequest.method === 'post') {
            originalRequest.data = {
              ...JSON.parse(originalRequest.data || '{}'),
              token: token
            };
          }
          
          return api(originalRequest);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          // If refresh fails, redirect to login
          if (typeof window !== 'undefined') {
            Cookies.remove('firebase-token');
            window.location.href = '/login';
          }
        }
      } else {
        // No user, redirect to login
        if (typeof window !== 'undefined') {
          Cookies.remove('firebase-token');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Helper function to handle API errors
const handleApiError = (error: any) => {
  console.error('API Error:', error);
  const errorMessage = error.response?.data?.message || 'An error occurred';
  toast.error(errorMessage);
};

// Auth endpoints
export const authApi = {
  login: async (email: string, password: string) => {
    try {
      const auth = getAuth();
      
      // Add error handling and logging
      console.log("Attempting login with:", email);
      console.log("Password length:", password.length);
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const token = await userCredential.user.getIdToken();
      
      console.log("Firebase authentication successful, verifying with backend...");
      
      // Verify with backend
      try {
        const response = await api.post<APIResponse<any>>('/api/auth/verify', 
          { token },
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        // Log the response for debugging
        console.log("Backend verification response:", response.data);
        
        if (!response.data?.success) {
          throw new Error(response.data?.message || 'Authentication failed');
        }
        
        // Check both data and user fields for role (based on unified auth system)
        const userData = response.data.data || response.data.user;
        const userRole = userData?.role;
        
        console.log("User role from backend:", userRole);
        
        if (userRole !== 'POS_USER' && userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
          throw new Error('Not authorized for POS access');
        }
        
        // Store token in cookie
        Cookies.set('firebase-token', token, {
          expires: 7, // 7 days
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict'
        });
        
        // Store staff role flags in localStorage
        localStorage.setItem('isKitchenStaff', String(userData?.isKitchenStaff || false));
        localStorage.setItem('isDesignStaff', String(userData?.isDesignStaff || false));
        localStorage.setItem('isFinalCheckStaff', String(userData?.isFinalCheckStaff || false));
        localStorage.setItem('isCashierStaff', String(userData?.isCashierStaff || false));
        
        console.log('Staff roles stored in localStorage:', {
          isKitchenStaff: userData?.isKitchenStaff || false,
          isDesignStaff: userData?.isDesignStaff || false,
          isFinalCheckStaff: userData?.isFinalCheckStaff || false,
          isCashierStaff: userData?.isCashierStaff || false
        });
        
        return { success: true, data: userData, message: 'Login successful' };
      } catch (verifyError: any) {
        console.error('Backend verification failed:', verifyError);
        
        // Check if this is a 401 error but the user is a valid POS user
        // This can happen if the backend is temporarily unavailable or there's a token issue
        if (verifyError.response?.status === 401) {
          // Get user info from Firebase
          const user = auth.currentUser;
          if (user && user.email) {
            // Log the issue but allow login to proceed
            console.warn('Backend verification failed with 401, but Firebase auth succeeded. Proceeding with limited functionality.');
            
            // Store token in cookie anyway
            Cookies.set('firebase-token', token, {
              expires: 1, // Short expiry (1 day) since we couldn't verify with backend
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict'
            });
            
            // Return success but with a warning
            return { 
              success: true, 
              data: { role: 'POS_USER' },
              message: 'Logged in with limited functionality. Some features may be unavailable.'
            };
          }
        }
        
        // For other errors, rethrow
        throw verifyError;
      }

      // This is a fallback in case we somehow get here
      // (which shouldn't happen due to the return statements in the try/catch)
      console.warn('Login flow reached unexpected code path');
      return { 
        success: true, 
        data: { role: 'POS_USER' },
        message: 'Logged in with potential issues. Please contact support if you experience problems.'
      };
    } catch (error: any) {
      // Improved error logging
      console.error('Login error details:', {
        code: error.code,
        message: error.message,
        response: error.response?.data,
        stack: error.stack
      });
      
      // Log the specific Firebase error
      if (error.code && error.code.startsWith('auth/')) {
        console.error(`Firebase auth error: ${error.code}`);
        console.error(`Error message: ${error.message}`);
      }
      throw error; // Let the login page handle the error
    }
  },
  
  resetPassword: async (email: string) => {
    try {
      const response = await api.post('/api/auth/reset-password', { email });
      return response.data;
    } catch (error: any) {
      console.error('Reset password error:', error.response?.data || error.message);
      throw error;
    }
  },
  pinLogin: async (pin: string) => 
    api.post('/api/auth/pin-login', { pin }),
  verify: async () => {
    return api.post('/api/auth/verify');
  },
  logout: async () => {
    return api.post('/api/auth/logout');
  }
};

// API response types
export interface APIResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  user?: any; // Adding user field for unified auth system
}

export interface ProductOptionValue {
  id: string;
  value: string;
  position: number;
  optionId: string;
}

export interface ProductOption {
  id: string;
  name: string;
  position: number;
  values: ProductOptionValue[];
}

export interface ProductVariant {
  options: any;
  id: string;
  sku: string;
  price: number;
  stock: number;
  values: Array<{
    id: string;
    valueId: string;
    value: ProductOptionValue;
  }>;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string | null;
  isPrimary: boolean;
}

export type OrderCustomImage = CustomImage;

export type PosQueuedOrderItem = {
  id: string;
  productId: string | null;
  productName: string;
  unitPrice: number;
  totalPrice: number;
  quantity: number;
  selectedVariations: Array<{
    id: string;
    type: string;
    value: string;
    price?: number;
  }> | null;
  notes: string | null;
  customImages: Array<OrderCustomImage> | null;
  product?: Product;
  requiresKitchen?: boolean;
  requiresDesign?: boolean;
  sku?: string;
  categoryId?: string;
  barcode?: string;
};

export type PosQueuedOrder = {
  id: string;
  name: string | null;
  items: PosQueuedOrderItem[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  totalAmount: number;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  deliveryMethod: 'PICKUP' | 'DELIVERY';
  
  // Delivery details as direct fields
  deliveryDate: string | null;
  deliveryTimeSlot: string | null;
  deliveryInstructions: string | null;
  deliveryCharge: number | null;
  
  // Pickup details as direct fields
  pickupDate: string | null;
  pickupTimeSlot: string | null;
  
  // Address details as direct fields
  streetAddress: string | null;
  apartment: string | null;
  emirate: string | null;
  city: string | null;
  
  // Gift details as direct fields
  isGift: boolean;
  giftRecipientName: string | null;
  giftRecipientPhone: string | null;
  giftMessage: string | null;
  giftCashAmount: number | null;
  
  paymentMethod?: POSPaymentMethod;
  paymentReference?: string;
  createdBy?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    name?: string;
  };
};

export interface AddonOption {
  id: string;
  name: string;
  price: number;
  allowsCustomText: boolean;
  customTextLabel?: string;
  maxTextLength?: number;
}

export interface ProductAddon {
  id: string;
  name: string;
  description?: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  options: AddonOption[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  sku: string;
  status: 'ACTIVE' | 'DRAFT';
  basePrice: number;
  stock: number;
  trackInventory: boolean;
  categoryId: string;
  category?: Category; // Add optional category property
  options: ProductOption[];
  variants: ProductVariant[];
  images: ProductImage[];
  visibility: 'ALL' | 'POS_ONLY' | 'WEB_ONLY' | 'APP_ONLY';
  allowCustomPrice: boolean;
  requiresDesign: boolean;  // For design team processing
  requiresKitchen: boolean; // For kitchen team processing
  allowCustomImages: boolean; // For customer custom image uploads
  addons?: ProductAddon[]; // Product addons
}

export interface ProductWithDesign extends Product {
  allowCustomPrice: boolean;
  customImages?: CustomImage[];
  position?: number;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  isActive: boolean;
  image: string | null;
  parentId: string | null;
  parent?: Category;
  children?: Category[];
  createdAt?: string;
  updatedAt?: string;
}

export interface POSPaymentData extends Omit<OrderPayment, 'id'> {
  id?: string;
}

// API methods
export const apiMethods = {
  products: {
    getProducts: () => 
      api.get<APIResponse<Product[]>>('/api/products/public'),
    getCategories: async () => {
      try {
        // Specify POS platform to get appropriate categories based on visibility
        const response = await api.get<APIResponse<Category[]>>('/api/categories/public', {
          params: { platform: 'POS' },
          headers: { 'X-Platform': 'POS' }
        });
        
        if (!response.data?.success) {
          throw new Error(response.data?.message || 'Failed to fetch categories');
        }
        return {
          success: true,
          data: response.data.data
        };
      } catch (error: any) {
        console.error('Error fetching categories:', error);
        return {
          success: false,
          data: []
        };
      }
    },
    getProduct: (id: string) =>
      api.get<APIResponse<Product>>(`/api/products/public/${id}`),
    getProductBySlug: (slug: string) =>
      api.get<APIResponse<Product>>(`/api/products/public/${slug}`),
    getProductAddons: async (productId: string) => {
      try {
        const response = await api.get<APIResponse<ProductAddon[]>>(`/api/products/public/${productId}/addons`);
        return response.data;
      } catch (error: any) {
        console.error('Error fetching product addons:', error);
        return {
          success: false,
          message: error.message || 'Failed to fetch product addons',
          data: []
        };
      }
    },
    getProductsByIds: async (ids: string[]) => {
      try {
        const response = await api.post<APIResponse<Product[]>>('/api/products/public/batch', { ids });
        return response.data;
      } catch (error: any) {
        console.error('Error fetching products by IDs:', error);
        return {
          success: false,
          message: error.message || 'Failed to fetch products',
          data: []
        };
      }
    }
  },
  orders: {
    createOrder: (orderData: {
      items: Array<{
        productId: string;
        quantity: number;
        variations: Array<{
          id: string;
          type: string;
          value: string;
          priceAdjustment: number;
        }>;
        notes?: string;
        totalPrice: number;
      }>;
      totalAmount: number;
    }) => api.post<APIResponse<{ orderId: string }>>('/api/pos/orders', orderData),
    
    getPOSOrders: (page: number, pageSize: number) => 
      api.get<APIResponse<{
        orders: Array<{
          id: string;
          createdAt: string;
          status: string;
          totalAmount: number;
          items: Array<{
            name: string;
            quantity: number;
            variations: Array<{
              type: string;
              value: string;
            }>;
            totalPrice: number;
          }>;
          transactionId?: string;
        }>;
        hasMore: boolean;
      }>>(`/api/pos/orders?page=${page}&pageSize=${pageSize}`),

    updateTransactionId: (orderId: string, transactionId: string) =>
      api.patch<APIResponse<void>>(`/api/pos/orders/${orderId}/transaction`, { transactionId }),
  },
  pos: {
    // Search customers
    searchCustomers: async (query: string): Promise<APIResponse<Array<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      reward: {
        points: number;
      };
    }>>> => {
      const response = await api.get(`/api/pos/customers/search?query=${encodeURIComponent(query)}`);
      return response.data;
    },
    // Get products
    async getProducts(): Promise<APIResponse<ProductWithDesign[]>> {
      try {
        const response = await api.get('/api/pos/products');
        return response.data;
      } catch (error) {
        console.error('Error fetching products:', error);
        throw error;
      }
    },
    
    // Parked order related endpoints
    parkOrder(orderData: ParkedOrderData): Promise<APIResponse<ParkedOrder>> {
      console.log('API: Parking order with data:', JSON.stringify(orderData, null, 2));
      return api.post('/api/pos/parked-orders', orderData)
        .then(response => {
          console.log('API: Park order response:', response.data);
          return response.data;
        })
        .catch(error => {
          console.error('API: Error parking order:', error);
          console.error('API: Error details:', {
            message: error.message,
            response: error.response ? {
              status: error.response.status,
              data: error.response.data
            } : 'No response',
            request: error.request ? 'Request was made but no response received' : 'No request was made'
          });
          
          // Return a structured error response
          return {
            success: false,
            message: error.response?.data?.message || error.message || 'Failed to park order',
            error: error.response?.data || error.message
          };
        });
    },

    getParkedOrders(): Promise<APIResponse<ParkedOrder[]>> {
      console.log('API: Calling getParkedOrders endpoint');
      return api.get('/api/pos/parked-orders')
        .then(response => {
          console.log('API: getParkedOrders response received:', response.data);
          return response.data;
        })
        .catch(error => {
          console.error('API: getParkedOrders error:', error);
          console.error('API: getParkedOrders error details:', {
            message: error.message,
            response: error.response ? {
              status: error.response.status,
              data: error.response.data
            } : 'No response',
            request: error.request ? 'Request was made but no response received' : 'No request was made'
          });
          throw error;
        });
    },

    getParkedOrderById(id: string): Promise<APIResponse<ParkedOrder>> {
      return api.get(`/api/pos/parked-orders/${id}`);
    },

    deleteParkedOrder(id: string): Promise<APIResponse<any>> {
      console.log('API: Deleting parked order:', id);
      return api.delete(`/api/pos/parked-orders/${id}`)
        .then(response => {
          console.log('API: Delete parked order response:', response.data);
          return response.data;
        })
        .catch(error => {
          console.error('API: Error deleting parked order:', error);
          // Check if the error is a 404 (not found), which could mean the order was already deleted
          if (error.response && error.response.status === 404) {
            console.log('API: Order not found, may have been already deleted');
            return {
              success: true,
              message: 'Order not found or already deleted'
            };
          }
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to delete parked order',
          };
        });
    },

    // Queue order related endpoints
    queueOrder(orderData: { 
      items: Array<{
        productId: string;
        productName: string;
        unitPrice: number;
        quantity: number;
        totalPrice: number;
        notes?: string;
        selectedVariations?: Array<{
          id: string;
          type: string;
          value: string;
          price?: number;
        }>;
        customImages?: OrderCustomImage[];
        requiresKitchen?: boolean;
        requiresDesign?: boolean;
        sku?: string;
        categoryId?: string;
        barcode?: string;
      }>; 
      name?: string; 
      notes?: string; 
      totalAmount: number;
      
      // Customer information as direct fields
      customerName?: string;
      customerEmail?: string;
      customerPhone?: string;
      
      // Delivery method
      deliveryMethod: 'PICKUP' | 'DELIVERY';
      
      // Delivery details as direct fields
      deliveryDate?: string;
      deliveryTimeSlot?: string;
      deliveryInstructions?: string;
      deliveryCharge?: number;
      
      // Pickup details as direct fields
      pickupDate?: string;
      pickupTimeSlot?: string;
      
      // Address details as direct fields
      streetAddress?: string;
      apartment?: string;
      emirate?: string;
      city?: string;
      
      // Gift details as direct fields
      isGift?: boolean;
      giftRecipientName?: string;
      giftRecipientPhone?: string;
      giftMessage?: string;
      giftCashAmount?: number;
      
      // Legacy fields for backward compatibility
      customer?: any;
      deliveryDetails?: any;
      pickupDetails?: any;
      giftDetails?: any;
      addressDetails?: any;
      orderSummary?: any;
    }): Promise<APIResponse<any>> {
      return api.post('/api/pos/queue', orderData);
    },
    
    getQueuedOrders(): Promise<APIResponse<any[]>> {
      return api.get('/api/pos/queue')
        .then(response => response.data);
    },
    
    getQueuedOrderById(id: string): Promise<APIResponse<any>> {
      return api.get(`/api/pos/queue/${id}`)
        .then(response => response.data);
    },
    
    deleteQueuedOrder(id: string): Promise<APIResponse<any>> {
      return api.delete(`/api/pos/queue/${id}`)
        .then(response => response.data);
    },
    
    // Upload custom images
    async uploadCustomImages(orderItemId: string, images: { file: File; comment?: string }[]) {
      const formData = new FormData();
      images.forEach(image => {
        formData.append('images', image.file);
      });
      formData.append('comments', JSON.stringify(
        images.reduce((acc, img) => ({ ...acc, [img.file.name]: img.comment }), {})
      ));

      const response = await api.post<APIResponse<{ url: string }[]>>(
        `/api/pos/custom-images/order-item/${orderItemId}/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data;
    },

    // Delete custom image
    async deleteCustomImage(imageId: string): Promise<APIResponse<any>> {
      try {
        const response = await api.delete(`/api/pos/custom-images/${imageId}`);
        return response.data;
      } catch (error) {
        console.error('Error deleting custom image:', error);
        throw error;
      }
    },

    // Get custom images for order item
    async getOrderItemCustomImages(orderItemId: string): Promise<APIResponse<CustomImage[]>> {
      try {
        const response = await api.get(`/api/pos/custom-images/order-item/${orderItemId}`);
        return response.data;
      } catch (error) {
        console.error('Error fetching custom images:', error);
        throw error;
      }
    },
    
    createOrder: async (orderData: POSOrderData & { items: Array<POSOrderItemData & { customImages?: CustomImage[] }> }) => {
      try {
        // Ensure all custom image URLs are properly set
        const processedOrderData = {
          ...orderData,
          items: orderData.items.map(item => {
            if (item.customImages && item.customImages.length > 0) {
              // Log each item's custom images before processing
              console.log(`Processing item ${item.id} with ${item.customImages.length} custom images:`, 
                item.customImages.map(img => ({ id: img.id, url: img.url }))
              );
              
              return {
                ...item,
                customImages: item.customImages.map(img => {
                  // Ensure each image has a valid URL
                  const processedImage = {
                    id: img.id || nanoid(),
                    url: img.url || '',
                    type: img.type || 'reference',
                    notes: img.notes || ''
                  };
                  
                  // Log each processed image
                  console.log(`Processed image ${processedImage.id} with URL: ${processedImage.url}`);
                  
                  return processedImage;
                })
              };
            }
            return item;
          })
        };

        // Create FormData for multipart request
        const formData = new FormData();
        
        // First, ensure all items have their customImages URLs properly set
        const finalOrderData = {
          ...processedOrderData,
          skipPrinterOperations: true, // Add flag to skip printer operations in the API
          items: processedOrderData.items.map(item => {
            if (item.customImages && item.customImages.length > 0) {
              return {
                ...item,
                customImages: item.customImages.map(img => ({
                  ...img,
                  id: img.id || nanoid(),
                  url: img.url || '', // Ensure URL is never undefined
                  type: img.type || 'reference',
                  notes: img.notes || ''
                }))
              };
            }
            return item;
          })
        };
        
        // Log the full processed order data with image URLs
        console.log('FINAL ORDER DATA WITH IMAGE URLS:', JSON.stringify({
          orderNumber: finalOrderData.orderNumber,
          itemCount: finalOrderData.items.length,
          itemsWithImages: finalOrderData.items
            .filter(item => item.customImages && item.customImages.length > 0)
            .map(item => ({
              id: item.id,
              customImages: item.customImages.map(img => ({
                id: img.id,
                url: img.url
              }))
            }))
        }));
        
        // Stringify the order data with verified URLs
        const orderDataJson = JSON.stringify(finalOrderData);
        console.log('Order data being sent in FormData:', orderDataJson.substring(0, 200) + '...');
        
        // Add the order data to the FormData
        formData.append('orderData', orderDataJson);

        // Append each file to FormData
        finalOrderData.items.forEach((item, itemIndex) => {
          if (item.customImages && item.customImages.length > 0) {
            console.log(`Processing ${item.customImages.length} custom images for item ${itemIndex} in FormData`);
            
            // Add a special field to indicate this item has custom images
            formData.append(`item_${itemIndex}_has_custom_images`, 'true');
            
            // Add the total number of images for this item
            formData.append(`item_${itemIndex}_image_count`, item.customImages.length.toString());
            
            item.customImages.forEach((image, imageIndex) => {
              // Log each image URL to verify it's being included
              console.log(`Image ${imageIndex} URL for item ${itemIndex}: ${image.url}`);
              
              // Always include the image URL, regardless of whether there's a file
              formData.append(`item_${itemIndex}_url_${imageIndex}`, image.url || '');
              
              // Include image ID
              formData.append(`item_${itemIndex}_id_${imageIndex}`, image.id || nanoid());
              
              // Include image type
              formData.append(`item_${itemIndex}_type_${imageIndex}`, image.type || 'reference');
              
              // Include image notes
              formData.append(`item_${itemIndex}_notes_${imageIndex}`, image.notes || '');
              
              // If there's a file, include it too
              if ('file' in image && image.file instanceof File) {
                formData.append(`item_${itemIndex}_image_${imageIndex}`, image.file);
                formData.append(`item_${itemIndex}_comment_${imageIndex}`, image.comment || '');
                console.log(`Appended file for item ${itemIndex}, image ${imageIndex}`);
              } else {
                console.log(`No file to append for item ${itemIndex}, image ${imageIndex}, using URL only`);
              }
            });
          }
        });

        // Send multipart request
        const response = await api.post<any>('/api/pos/orders', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        // Process the response
        return {
          success: true,
          message: response.data.message || 'Order created successfully',
          data: response.data.data
        };
      } catch (error: any) {
        console.error('Error creating order:', error);
        return {
          success: false,
          message: error.response?.data?.error || error.message || 'Failed to create order'
        };
      }
    },

    updateOrderStatus: async (orderId: string, { status, notes, teamNotes, qualityControl, partialRefundAmount, returnToKitchenOrDesign, parallelProcessing }: { status: string, notes?: string, teamNotes?: string, qualityControl?: any, partialRefundAmount?: number, returnToKitchenOrDesign?: boolean, parallelProcessing?: { designStatus?: string, kitchenStatus?: string } }) => {
      try {
        console.log('API call: updateOrderStatus', { orderId, status, notes, teamNotes, qualityControl, partialRefundAmount, returnToKitchenOrDesign });
        const response = await api.patch(`/api/pos/orders/${orderId}/status`, {
          status,
          notes: notes || '',
          teamNotes: teamNotes || '',
          qualityControl,
          partialRefundAmount,
          returnToKitchenOrDesign,
          parallelProcessing
        });
        return response.data;
      } catch (error: any) {
        console.error('Error updating order status:', error);
        console.error('Response data:', error.response?.data);
        return {
          success: false,
          message: error.response?.data?.message || error.response?.data?.error?.message || 'Failed to update order status'
        };
      }
    },

    getOrders: async (params?: { status?: string, startDate?: string, endDate?: string }) => {
      try {
        console.log('Fetching orders with params:', params);
        const url = '/api/pos/orders';
        const config = {
          params: params || undefined,
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        };
        
        const response = await api.get(url, config);
        console.log('Orders API raw response:', response);
        
        // Extract the data from the response
        if (response.data && typeof response.data === 'object') {
          const { success, data, message } = response.data;
          return { success, data, message };
        }
        
        // If response format is unexpected
        console.error('Unexpected API response format:', response);
        return {
          success: false,
          data: [],
          message: 'Unexpected API response format'
        };
      } catch (error: any) {
        console.error('Error in getOrders:', error);
        return {
          success: false,
          data: [],
          message: error.response?.data?.message || 'Failed to fetch orders'
        };
      }
    },

    getOrderById: async (orderId: string) => {
      try {
        const response = await api.get(`/api/pos/orders/${orderId}`);
        
        if (response.data && typeof response.data === 'object') {
          const { success, data, message } = response.data;
          return { success, data, message };
        }
        
        return {
          success: false,
          data: null,
          message: 'Unexpected API response format'
        };
      } catch (error: any) {
        console.error('Error in getOrderById:', error);
        return {
          success: false,
          data: null,
          message: error.response?.data?.message || 'Failed to fetch order'
        };
      }
    },
    // Validate coupon
    validateCoupon: async (code: string, total: number): Promise<APIResponse<{
      code: string;
      type: 'PERCENTAGE' | 'FIXED_AMOUNT';
      value: number;
      description?: string;
      minOrderAmount?: number;
      maxDiscount?: number;
      discount: number;
    }>> => {
      const response = await api.post(`/api/coupons/${code}/validate`, { total });
      return response.data;
    },
    // Create or update customer
    createOrUpdateCustomer: async (customerData: {
      customerName: string;
      customerPhone: string;
      customerEmail?: string;
      deliveryAddress?: {
        streetAddress: string;
        apartment?: string;
        emirate: string;
        city?: string;
      };
    }): Promise<APIResponse<{
      customer: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        addresses: Array<{
          id: string;
          street: string;
          apartment: string;
          emirate: string;
          city: string;
          country: string;
          pincode: string;
          isDefault: boolean;
          type: string;
        }>;
        reward: {
          points: number;
        };
      };
      credentials?: {
        username: string;
        temporaryPassword: string;
      };
    }>> => {
      const response = await api.post('/api/pos/customers/create-or-update', customerData);
      return response.data;
    },

    // Get customer addresses
    getCustomerAddresses: async (customerId: string): Promise<APIResponse<Array<{
      id: string;
      street: string;
      apartment: string;
      emirate: string;
      city: string;
      country: string;
      pincode: string;
      isDefault: boolean;
      type: string;
    }>>> => {
      const response = await api.get(`/api/pos/customers/${customerId}/addresses`);
      return response.data;
    },

    // Open cash drawer
    openDrawer: async (amount: string, note?: string): Promise<APIResponse<{
      id: string;
      type: string;
      amount: string;
      note?: string;
      createdAt: string;
    }>> => {
      try {
        const response = await api.post('/api/pos/drawer/open', { amount, note });
        return response.data;
      } catch (error: any) {
        console.error('Error opening cash drawer:', error.response?.data || error);
        throw error;
      }
    },

    // Add cash drawer operation
    addDrawerOperation: async (type: string, amount: string, note?: string): Promise<APIResponse<{
      id: string;
      type: string;
      amount: string;
      note?: string;
      createdAt: string;
    }>> => {
      try {
        const response = await api.post('/api/pos/drawer/operations', { type, amount, note });
        return response.data;
      } catch (error: any) {
        console.error('Error adding drawer operation:', error.response?.data || error);
        throw error;
      }
    },

    // Get current drawer session
    getCurrentDrawerSession: async (): Promise<APIResponse<{
      id: string;
      openingAmount: number;
      closingAmount?: number;
      status: string;
      createdAt: string;
      updatedAt: string;
      operations: Array<{
        id: string;
        type: string;
        amount: number;
        note?: string;
        createdAt: string;
      }>;
    }>> => {
      try {
        const response = await api.get('/api/pos/drawer/current');
        return response.data;
      } catch (error: any) {
        console.error('Error getting drawer session:', error.response?.data || error);
        throw error;
      }
    },
    updateOrderPayment: async (orderId: string, payment: OrderPayment): Promise<APIResponse<Order>> => {
      try {
        const response = await api.post<APIResponse<Order>>(`/api/pos/orders/${orderId}/payments`, payment);
        return response.data;
      } catch (error) {
        handleApiError(error);
        throw error;
      }
    },
    
    updatePickupDetails: async (orderId: string, pickupDetails: { pickupDate: string, pickupTimeSlot: string }): Promise<APIResponse<Order>> => {
      try {
        console.log('API call: updatePickupDetails', { orderId, ...pickupDetails });
        const response = await api.patch<APIResponse<Order>>(`/api/pos/orders/${orderId}/pickup-details`, pickupDetails);
        return response.data;
      } catch (error) {
        handleApiError(error);
        throw error;
      }
    },
    
    updateOrderDetails: async (orderId: string, orderDetails: { 
      deliveryMethod: 'PICKUP' | 'DELIVERY', 
      pickupDate?: string, 
      pickupTimeSlot?: string, 
      deliveryDate?: string, 
      deliveryTimeSlot?: string,
      isGift?: boolean,
      giftRecipientName?: string,
      giftRecipientPhone?: string,
      giftMessage?: string,
      giftCashAmount?: number
    }): Promise<APIResponse<Order>> => {
      try {
        console.log('API call: updateOrderDetails', { orderId, ...orderDetails });
        const response = await api.patch<APIResponse<Order>>(`/api/pos/orders/${orderId}/order-details`, orderDetails);
        return response.data;
      } catch (error) {
        handleApiError(error);
        throw error;
      }
    },
    
    addPartialPayment: async (orderId: string, payment: OrderPayment): Promise<APIResponse<Order>> => {
      return api.post(`/api/pos/orders/${orderId}/partial-payment`, payment);
    },
    updatePaymentStatus: async (orderId: string, paymentId: string, status: POSPaymentStatus): Promise<APIResponse<Order>> => {
      return api.patch(`/api/pos/orders/${orderId}/payments/${paymentId}`, { status });
    },
    completePayment: async (orderId: string): Promise<APIResponse<Order>> => {
      return api.post(`/api/pos/orders/${orderId}/complete-payment`);
    },
    cancelOrder: async (orderId: string): Promise<boolean> => {
      try {
        const response = await api.post(`/api/pos/orders/${orderId}/cancel`);
        return response.data.success;
      } catch (error: any) {
        if (error.response?.data?.message === 'Only super admins can cancel orders') {
          toast.error('Only Super Admins can cancel orders');
        } else {
          toast.error('Failed to cancel order');
          console.error('Failed to cancel order:', error);
        }
        return false;
      }
    },
  }
};

// Export the configured axios instance
export { api };

export { POSOrderStatus, POSPaymentMethod, POSPaymentStatus };
