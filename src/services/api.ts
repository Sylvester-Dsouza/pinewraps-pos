'use client';

import axios from 'axios';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import Cookies from 'js-cookie';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to add auth token
api.interceptors.request.use(async (config) => {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  } catch (error) {
    console.error('Error adding auth token:', error);
    return config;
  }
});

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized error (e.g., redirect to login)
      const auth = getAuth();
      await auth.signOut();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authApi = {
  login: async (email: string, password: string) => {
    try {
      // Login with Firebase first
      const auth = getAuth();
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      const token = await user.getIdToken();

      // Set the token in cookie
      Cookies.set('firebase-token', token, { expires: 7 }); // 7 days expiry

      // Add token to request
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // Then verify with our backend
      const response = await api.post('/api/pos-auth/login', { 
        email, 
        password 
      });

      return response.data;
    } catch (error: any) {
      console.error('Login error:', error.response?.data || error.message);
      throw error;
    }
  },
  
  resetPassword: async (email: string) => {
    try {
      const response = await api.post('/api/pos-auth/reset-password', { email });
      return response.data;
    } catch (error: any) {
      console.error('Reset password error:', error.response?.data || error.message);
      throw error;
    }
  },
  pinLogin: async (pin: string) => 
    api.post('/api/pos-auth/pin-login', { pin }),
  verify: async () => {
    return api.post('/api/pos-auth/verify');
  },
  logout: async () => {
    return api.post('/api/pos-auth/logout');
  }
};

// Types
export interface APIResponse<T> {
  success: boolean;
  data: T;
  message?: string;
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

export interface DesignImage {
  file?: File;  // Make file optional since uploaded images won't have it
  url?: string; // Add url for uploaded images
  comment: string;
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
  options: ProductOption[];
  variants: ProductVariant[];
  images: ProductImage[];
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

// Types for custom products
export interface CustomProductData {
  name: string;
  price: number;
  isCustom: boolean;
  designImages?: DesignImage[];
}

export interface CustomProductResponse {
  id: string;
  name: string;
  price: number;
  isCustom: boolean;
  designImages: Array<{
    url: string;
    comment: string;
  }>;
}

// API methods
export const apiMethods = {
  products: {
    getProducts: () => 
      api.get<APIResponse<Product[]>>('/api/products/public'),
    getCategories: async () => {
      try {
        const response = await api.get('/api/categories/all');
        return {
          success: true,
          data: Array.isArray(response.data) ? response.data : []
        };
      } catch (error: any) {
        console.error('Error fetching categories:', error);
        return {
          success: false,
          message: error.response?.data?.message || 'Failed to fetch categories',
          data: []
        };
      }
    },
    getProduct: (id: string) =>
      api.get<APIResponse<Product>>(`/api/products/public/${id}`),
    getProductBySlug: (slug: string) =>
      api.get<APIResponse<Product>>(`/api/products/public/${slug}`)
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
            productName: string;
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
    // Get products
    getProducts: async () => {
      try {
        const response = await api.get<APIResponse<Product[]>>('/api/products/public');
        if (!response.data.success) {
          throw new Error(response.data.message || 'Failed to fetch products');
        }
        return {
          success: true,
          data: response.data.data
        };
      } catch (error: any) {
        console.error('Error fetching products:', error);
        return {
          success: false,
          message: error.response?.data?.message || 'Failed to fetch products',
          data: []
        };
      }
    },
    
    // Create custom product
    createCustomProduct: async (data: FormData): Promise<APIResponse<CustomProductResponse>> => {
      try {
        const response = await api.post('/api/pos/custom-products', data, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        return response.data;
      } catch (error: any) {
        console.error('Create custom product error:', error.response?.data || error.message);
        throw error;
      }
    },
    createOrder: async (orderData: {
      items: Array<{
        productId?: string;  
        productName: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        variations: any;
        requiresDesign: boolean;
        designDetails?: string;
        kitchenNotes?: string;
        designImages?: DesignImage[];
      }>;
      customerName: string;
      customerPhone: string;
      customerEmail?: string;
      paymentMethod: 'CASH' | 'CREDIT_CARD';
      totalAmount: number;
      paidAmount: number;
      changeAmount: number;
      requiresKitchen?: boolean;
      requiresDesign?: boolean;
      kitchenNotes?: string;
      designNotes?: string;
      internalNotes?: string;
      expectedReadyTime?: Date;
    }) => {
      try {
        const formData = new FormData();
        const hasDesignImages = orderData.items.some(item => 
          Array.isArray(item.designImages) && item.designImages.length > 0
        );

        // Add order data
        formData.append('orderData', JSON.stringify({
          ...orderData,
          // Remove design images from JSON data as they'll be handled separately
          items: orderData.items.map(item => ({
            ...item,
            designImages: undefined
          }))
        }));

        // Handle design images if any
        if (hasDesignImages) {
          let imageCount = 0;
          orderData.items.forEach((item, itemIndex) => {
            if (Array.isArray(item.designImages) && item.designImages.length > 0) {
              item.designImages.forEach(image => {
                if (image.file instanceof Blob) {
                  formData.append(`image_${imageCount}`, image.file);
                  formData.append(`comment_${imageCount}`, image.comment || '');
                  formData.append(`itemIndex_${imageCount}`, itemIndex.toString());
                  imageCount++;
                }
              });
            }
          });
          formData.append('imageCount', imageCount.toString());
        }

        const response = await api.post('/api/pos/orders', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        return response.data;
      } catch (error: any) {
        console.error('Create order error:', error.response?.data || error.message);
        throw error;
      }
    },

    updateOrderStatus: async (orderId: string, { status, notes }: { status: string, notes?: string }) => {
      try {
        const response = await api.patch(`/api/pos/orders/${orderId}/status`, {
          status,
          notes: notes || ''
        });
        return response.data;
      } catch (error: any) {
        console.error('Error updating order status:', error);
        return {
          success: false,
          message: error.response?.data?.message || 'Failed to update order status'
        };
      }
    },

    getOrders: async (status?: string) => {
      try {
        console.log('Fetching orders with status:', status);
        const url = '/api/pos/orders';
        const config = {
          params: status ? { status } : undefined,
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

    uploadDesignImages: async (orderId: string, orderItemId: string, images: DesignImage[]) => {
      try {
        const formData = new FormData();
        formData.append('orderId', orderId);
        formData.append('orderItemId', orderItemId);
        formData.append('imageCount', images.length.toString());

        images.forEach((image, index) => {
          if (image.file) {
            formData.append(`image_${index}`, image.file);
            formData.append(`comment_${index}`, image.comment || '');
          }
        });

        const response = await api.post('/api/pos/design-images', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        return response.data;
      } catch (error: any) {
        console.error('Upload design images error:', error.response?.data || error.message);
        throw error;
      }
    },

    deleteDesignImage: async (imageId: string) => {
      const response = await api.delete(`/api/pos/design-images/${imageId}`);
      return response;
    },

    getOrderItemDesignImages: async (orderItemId: string) => {
      const response = await api.get(`/api/pos/design-images/order-item/${orderItemId}`);
      return response;
    }
  }
};

// Export the configured axios instance
export { api };
