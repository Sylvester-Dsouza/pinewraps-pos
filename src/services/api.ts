'use client';

import axios from 'axios';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import Cookies from 'js-cookie';
import { nanoid } from 'nanoid';

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
          
          // Retry the original request with new token
          const originalRequest = error.config;
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          
          // Update token in body for verify endpoint
          if (originalRequest.url?.includes('/api/auth/verify') && originalRequest.method === 'post') {
            originalRequest.data = {
              ...originalRequest.data,
              token: token
            };
          }
          
          return api(originalRequest);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          // If refresh fails, redirect to login
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authApi = {
  login: async (email: string, password: string) => {
    try {
      const auth = getAuth();
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const token = await userCredential.user.getIdToken();
      
      // Verify with backend
      const response = await api.post<APIResponse<any>>('/api/auth/verify', 
        { token },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Authentication failed');
      }

      const userRole = response.data.data?.role;
      if (userRole !== 'POS_USER' && userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
        throw new Error('Not authorized for POS access');
      }

      // Store token in cookie
      Cookies.set('firebase-token', token, {
        expires: 7, // 7 days
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });

      return response.data;
    } catch (error: any) {
      console.error('Login error:', error);
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

export interface CustomImage {
  file?: File;
  url?: string;
  previewUrl?: string;
  comment: string;
}

export interface OrderCustomImage {
  url: string;
  comment?: string;
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
  visibility: 'ALL' | 'POS_ONLY' | 'WEB_ONLY' | 'APP_ONLY';
  allowCustomPrice: boolean;
  requiresDesign: boolean;  // For design team processing
  requiresKitchen: boolean; // For kitchen team processing
  allowCustomImages: boolean; // For customer custom image uploads
}

export interface ProductWithDesign extends Product {
  allowCustomPrice: boolean;
  customImages?: CustomImage[];
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

export type POSOrderStatus = 
  | "PENDING"
  | "KITCHEN_QUEUE"
  | "KITCHEN_PROCESSING"
  | "KITCHEN_READY"
  | "DESIGN_QUEUE"
  | "DESIGN_PROCESSING"
  | "DESIGN_READY"
  | "COMPLETED";

export interface POSOrderItemData {
  productId: string;
  productName: string;
  unitPrice: number;
  totalPrice?: number;
  quantity?: number;
  variations?: Record<string, any>;
  notes?: string;
  customImages?: OrderCustomImage[];
}

export interface POSOrderData {
  items: POSOrderItemData[];
  paymentMethod: 'CASH' | 'CARD';
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  paymentReference?: string;
  requiresKitchen?: boolean;
  requiresDesign?: boolean;
  status?: POSOrderStatus;
  expectedReadyTime?: Date;
  deliveryMethod: 'PICKUP' | 'DELIVERY';
  deliveryDate?: string;
  deliveryTimeSlot?: string;
  deliveryCharge?: number;
  deliveryInstructions?: string;
  streetAddress?: string;
  apartment?: string;
  emirate?: string;
  city?: string;
  pickupDate?: string;
  pickupTimeSlot?: string;
  totalAmount: number;
  paidAmount: number;
  changeAmount: number;
  couponCode?: string;
  couponDiscount?: number;
  couponType?: 'PERCENTAGE' | 'FIXED_AMOUNT';
}

// API methods
export const apiMethods = {
  products: {
    getProducts: () => 
      api.get<APIResponse<Product[]>>('/api/products/public'),
    getCategories: async () => {
      try {
        const response = await api.get<APIResponse<Category[]>>('/api/categories/public');
        if (!response.data.success) {
          throw new Error(response.data.message || 'Failed to fetch categories');
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
    
    createOrder: async (orderData: POSOrderData & { items: Array<POSOrderItemData & { customImages?: (CustomImage | OrderCustomImage)[] }> }) => {
      // Check if any items have custom images with files
      const hasCustomImages = orderData.items.some(item => 
        item.customImages?.some(img => 'file' in img && img.file instanceof File)
      );

      if (hasCustomImages) {
        // Create form data
        const formData = new FormData();
        formData.append('orderData', JSON.stringify({
          ...orderData,
          items: orderData.items.map(item => ({
            ...item,
            customImages: item.customImages?.filter(img => !('file' in img))
          }))
        }));

        // Add custom images
        orderData.items.forEach((item, itemIndex) => {
          item.customImages?.forEach((image, imageIndex) => {
            if ('file' in image && image.file instanceof File) {
              formData.append(`item_${itemIndex}_image_${imageIndex}`, image.file);
              formData.append(`item_${itemIndex}_comment_${imageIndex}`, image.comment || '');
            }
          });
        });

        // Send multipart request
        return api.post<APIResponse<any>>('/api/pos/orders', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      }

      // No custom images, send regular JSON request
      return api.post<APIResponse<any>>('/api/pos/orders', orderData);
    },

    updateOrderStatus: async (orderId: string, { status, notes, teamNotes }: { status: string, notes?: string, teamNotes?: string }) => {
      try {
        const response = await api.patch(`/api/pos/orders/${orderId}/status`, {
          status,
          notes: notes || '',
          teamNotes: teamNotes || ''
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
  }
};

// Export the configured axios instance
export { api };
