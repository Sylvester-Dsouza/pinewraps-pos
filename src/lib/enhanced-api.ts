'use client';

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import TokenManager from './token-manager';
import { toast } from 'sonner';

interface RequestQueueItem {
  config: AxiosRequestConfig;
  resolve: (value: AxiosResponse) => void;
  reject: (error: any) => void;
}

class EnhancedApiClient {
  private static instance: EnhancedApiClient;
  private api: AxiosInstance;
  private tokenManager: TokenManager;
  private requestQueue: RequestQueueItem[] = [];
  private isProcessingQueue = false;
  private connectionStatus: 'online' | 'offline' | 'checking' = 'online';

  private constructor() {
    this.tokenManager = TokenManager.getInstance();
    this.api = this.createAxiosInstance();
    this.setupInterceptors();
    this.setupConnectionMonitoring();
  }

  static getInstance(): EnhancedApiClient {
    if (!EnhancedApiClient.instance) {
      EnhancedApiClient.instance = new EnhancedApiClient();
    }
    return EnhancedApiClient.instance;
  }

  private createAxiosInstance(): AxiosInstance {
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    return axios.create({
      baseURL,
      timeout: 30000, // 30 seconds timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.api.interceptors.request.use(
      async (config) => {
        try {
          // Get valid token before making request
          const token = await this.tokenManager.getValidToken();
          config.headers['Authorization'] = `Bearer ${token}`;
          
          // Add token to body for verify endpoint
          if (config.url?.includes('/api/auth/verify') && config.method === 'post') {
            config.data = {
              ...config.data,
              token: token
            };
          }
          
          return config;
        } catch (error) {
          console.error('Error in request interceptor:', error);
          return Promise.reject(error);
        }
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => {
        // Reset connection status on successful response
        if (this.connectionStatus !== 'online') {
          this.connectionStatus = 'online';
          this.processRequestQueue();
        }
        return response;
      },
      async (error) => {
        const originalRequest = error.config;
        
        // Handle different types of errors
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          return this.handleTimeoutError(error, originalRequest);
        }
        
        if (error.response?.status === 401) {
          return this.handleAuthError(error, originalRequest);
        }
        
        if (error.response?.status >= 500) {
          return this.handleServerError(error, originalRequest);
        }
        
        if (!error.response) {
          return this.handleNetworkError(error, originalRequest);
        }
        
        return Promise.reject(error);
      }
    );
  }

  private async handleAuthError(error: any, originalRequest: any): Promise<any> {
    // Prevent infinite retry loops
    if (originalRequest._retryCount >= 2) {
      console.error('Max auth retry attempts reached');
      await this.tokenManager.logout();
      return Promise.reject(error);
    }

    originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;

    try {
      console.log('Handling 401 error, refreshing token...');
      const newToken = await this.tokenManager.refreshToken();
      
      // Update the original request with new token
      originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
      
      // Update token in body for verify endpoint
      if (originalRequest.url?.includes('/api/auth/verify') && originalRequest.method === 'post') {
        originalRequest.data = {
          ...JSON.parse(originalRequest.data || '{}'),
          token: newToken
        };
      }
      
      return this.api(originalRequest);
    } catch (refreshError) {
      console.error('Token refresh failed in auth error handler:', refreshError);
      await this.tokenManager.logout();
      return Promise.reject(refreshError);
    }
  }

  private async handleTimeoutError(error: any, originalRequest: any): Promise<any> {
    const maxRetries = 3;
    const retryCount = originalRequest._retryCount || 0;
    
    if (retryCount >= maxRetries) {
      toast.error('Request timed out. Please check your connection.', {
        duration: 5000,
      });
      return Promise.reject(error);
    }
    
    originalRequest._retryCount = retryCount + 1;
    
    // Exponential backoff
    const delay = Math.pow(2, retryCount) * 1000;
    console.log(`Retrying request after timeout (attempt ${retryCount + 1}/${maxRetries}) in ${delay}ms`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    return this.api(originalRequest);
  }

  private async handleServerError(error: any, originalRequest: any): Promise<any> {
    const maxRetries = 2;
    const retryCount = originalRequest._retryCount || 0;
    
    if (retryCount >= maxRetries) {
      toast.error('Server error. Please try again later.', {
        duration: 5000,
      });
      return Promise.reject(error);
    }
    
    originalRequest._retryCount = retryCount + 1;
    
    // Wait before retrying server errors
    const delay = (retryCount + 1) * 2000; // 2s, 4s
    console.log(`Retrying request after server error (attempt ${retryCount + 1}/${maxRetries}) in ${delay}ms`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    return this.api(originalRequest);
  }

  private async handleNetworkError(error: any, originalRequest: any): Promise<any> {
    console.log('Network error detected, queuing request');
    this.connectionStatus = 'offline';
    
    // Queue the request for later
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        config: originalRequest,
        resolve,
        reject
      });
      
      // Show offline notification
      toast.error('Connection lost. Request will be retried when connection is restored.', {
        duration: 5000,
      });
    });
  }

  private setupConnectionMonitoring(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('Connection restored');
        this.connectionStatus = 'online';
        toast.success('Connection restored. Processing queued requests.', {
          duration: 3000,
        });
        this.processRequestQueue();
      });

      window.addEventListener('offline', () => {
        console.log('Connection lost');
        this.connectionStatus = 'offline';
        toast.error('Connection lost. Requests will be queued.', {
          duration: 5000,
        });
      });
    }
  }

  private async processRequestQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    console.log(`Processing ${this.requestQueue.length} queued requests`);

    const queueCopy = [...this.requestQueue];
    this.requestQueue = [];

    for (const item of queueCopy) {
      try {
        const response = await this.api(item.config);
        item.resolve(response);
      } catch (error) {
        item.reject(error);
      }
    }

    this.isProcessingQueue = false;
  }

  // Public API methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.api.get<T>(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.api.post<T>(url, data, config);
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.api.put<T>(url, data, config);
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.api.patch<T>(url, data, config);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.api.delete<T>(url, config);
  }

  getConnectionStatus(): string {
    return this.connectionStatus;
  }

  getQueueLength(): number {
    return this.requestQueue.length;
  }

  clearQueue(): void {
    this.requestQueue.forEach(item => {
      item.reject(new Error('Request queue cleared'));
    });
    this.requestQueue = [];
  }
}

export default EnhancedApiClient;
