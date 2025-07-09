import axios from 'axios';
import { api } from '@/lib/axios';
import { toast } from '@/lib/toast-utils'; 

// Drawer Service Types
export interface DrawerOperation {
  id: string;
  sessionId: string;
  userId: string;
  type: DrawerOperationType;
  amount: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Order payment interface for till history
export interface OrderPayment {
  id: string;
  method: string;
  amount: number;
  status: string;
  isSplitPayment: boolean;
  splitFirstMethod?: string;
  splitFirstAmount?: number;
  splitSecondMethod?: string;
  splitSecondAmount?: number;
  createdAt: string;
}

// Order details interface for till history
export interface OrderDetail {
  id: string;
  orderNumber: string;
  total: number;
  createdAt: string;
  status: string;
  paymentStatus: string;
  payments: OrderPayment[];
}

export interface DrawerSession {
  id: string;
  userId: string;
  status: DrawerSessionStatus;
  openingAmount: string;
  closingAmount?: string;
  openedAt: string;
  closedAt?: string;
  operations?: DrawerOperation[];
  createdAt: string;
  updatedAt: string;
  user?: {
    firstName: string;
    lastName: string;
  };
  paymentTotals?: Record<string, number>;
  // Added for till closing report
  completedOrders?: number;
  // Order details for till history
  orderDetails?: OrderDetail[];
}

export interface DrawerLog {
  id: string;
  userId: string;
  action: string;
  timestamp: string;
  success: boolean;
  error?: string;
  notes?: string;
  ipAddress?: string;
  deviceInfo?: string;
  amount?: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

export type DrawerOperationType = 'OPENING_BALANCE' | 'CLOSING_BALANCE' | 'ADD_CASH' | 'TAKE_CASH' | 'SALE' | 'REFUND';
export type DrawerSessionStatus = 'OPEN' | 'CLOSED';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const PRINTER_PROXY_URL = process.env.NEXT_PUBLIC_PRINTER_PROXY_URL || 'http://localhost:3005';

export class DrawerService {
  private static instance: DrawerService;

  private constructor() {}

  static getInstance(): DrawerService {
    if (!DrawerService.instance) {
      DrawerService.instance = new DrawerService();
    }
    return DrawerService.instance;
  }

  async getCurrentSession(): Promise<{ data: DrawerSession | null }> {
    try {
      console.log('Getting current drawer session...');
      const response = await api.get('/api/pos/drawer-session/current');
      console.log('Current session response:', response);
      return response;
    } catch (error) {
      console.error('Error getting current session:', error);
      if (error.response) {
        console.error('Response error data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      return { data: null };
    }
  }

  async openSession(openingAmount: number): Promise<DrawerSession> {
    try {
      console.log('Opening drawer session:', { openingAmount });
      
      const payload = {
        openingAmount: openingAmount.toString()
      };
      
      console.log('Sending open session request with payload:', payload);
      
      const response = await api.post('/api/pos/drawer-session/open', payload);
      console.log('Open session response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error opening session:', error);
      if (error.response) {
        console.error('Response error data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      throw error;
    }
  }

  async closeSession(closingAmount: number): Promise<DrawerSession> {
    try {
      console.log('Closing drawer session with amount:', closingAmount);
      
      // First get the current session
      const currentSession = await this.getCurrentSession();
      console.log('Current session before closing:', currentSession);
      
      if (!currentSession || !currentSession.data) {
        throw new Error('No active drawer session found');
      }
      
      // Prepare the payload with the exact format expected by the API
      const payload = {
        closingAmount: closingAmount.toString()
      };
      
      console.log('Sending close session request with payload:', payload);
      
      // Close the session
      const response = await api.post('/api/pos/drawer-session/close', payload);
      
      console.log('Close session response:', response);
      console.log('Close session response data:', response.data);
      
      if (!response.data) {
        throw new Error('No data returned from close session API');
      }
      
      // Refresh the session data
      await this.getCurrentSession();
      
      // Return the response data
      return response.data;
    } catch (error) {
      console.error('Error closing session:', error);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
  }

  async payIn(amount: number, notes?: string): Promise<DrawerOperation> {
    try {
      const response = await api.post('/api/pos/drawer-session/operation/add', {
        amount: amount.toString(),
        notes
      });
      
      return response.data;
    } catch (error) {
      console.error('Error in pay in:', error);
      throw error;
    }
  }

  async payOut(amount: number, notes?: string): Promise<DrawerOperation> {
    try {
      const response = await api.post('/api/pos/drawer-session/operation/remove', {
        amount: amount.toString(),
        notes
      });
      
      return response.data;
    } catch (error) {
      console.error('Error in pay out:', error);
      throw error;
    }
  }

  async getSessionHistory(limit: number = 10): Promise<DrawerSession[]> {
    try {
      console.log(`Fetching session history with limit: ${limit}`);
      
      // Use the all-history endpoint to get sessions from all users
      const response = await api.get(`/api/pos/drawer-session/all-history?limit=${limit}`);
      console.log('Session history API response:', response);
      
      // Check if the response data is in the expected format
      if (response.data && Array.isArray(response.data.sessions)) {
        console.log(`Found ${response.data.sessions.length} sessions in response`);
        return response.data.sessions;
      } else if (Array.isArray(response.data)) {
        console.log(`Found ${response.data.length} sessions in direct response array`);
        return response.data;
      } else {
        console.warn('Unexpected session history response format:', response.data);
        return [];
      }
    } catch (error) {
      console.error('Error getting session history:', error);
      return [];
    }
  }

  async getLogs(limit = 100, offset = 0): Promise<{ logs: DrawerLog[], totalCount: number }> {
    try {
      console.log(`Fetching drawer logs with limit: ${limit}, offset: ${offset}`);
      const response = await api.get(`/api/pos/drawer/logs?limit=${limit}&offset=${offset}`);
      console.log('Drawer logs API response:', response);
      
      // Check if the response data is in the expected format
      if (response.data && Array.isArray(response.data)) {
        // Direct array response
        console.log(`Found ${response.data.length} drawer logs in direct response array`);
        return { 
          logs: response.data, 
          totalCount: response.data.length 
        };
      } else if (response.data && Array.isArray(response.data.logs)) {
        // Object with logs array
        console.log(`Found ${response.data.logs.length} drawer logs in response.data.logs`);
        return response.data;
      } else {
        console.warn('Unexpected drawer logs response format:', response.data);
        return { logs: [], totalCount: 0 };
      }
    } catch (error) {
      console.error('Error getting drawer logs:', error);
      return { logs: [], totalCount: 0 };
    }
  }

  async getTransactionHistory(limit = 100, offset = 0, sessionId?: string): Promise<{ transactions: DrawerOperation[], totalCount: number }> {
    try {
      const currentSession = sessionId ? { data: { id: sessionId } } : await this.getCurrentSession();
      
      if (!currentSession.data || !currentSession.data.id) {
        console.log('No active session found for transaction history');
        return { transactions: [], totalCount: 0 };
      }
      
      console.log('Fetching transactions for session:', currentSession.data.id);
      
      const response = await api.get(`/api/pos/drawer-session/${currentSession.data.id}/operations?limit=${limit}&offset=${offset}`);
      
      console.log('Transaction history response:', response.data);
      
      return {
        transactions: response.data.operations || [],
        totalCount: response.data.totalCount || 0
      };
    } catch (error) {
      console.error('Error getting transaction history:', error);
      if (error.response) {
        console.error('Response error data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      return { transactions: [], totalCount: 0 };
    }
  }

  async getAllTransactions(limit: number = 10, offset: number = 0): Promise<{
    sessions: any[];
    totalCount: number;
    hasMore: boolean;
    currentPage: number;
    totalPages: number;
  }> {
    try {
      console.log('Fetching all transactions with pagination:', { limit, offset });

      const response = await api.get(`/api/pos/drawer-session/all-transactions?limit=${limit}&offset=${offset}`);

      console.log('All transactions response:', response.data);

      return {
        sessions: response.data.sessions || [],
        totalCount: response.data.totalCount || 0,
        hasMore: response.data.hasMore || false,
        currentPage: response.data.currentPage || 1,
        totalPages: response.data.totalPages || 1
      };
    } catch (error) {
      console.error('Error getting all transactions:', error);
      if (error.response) {
        console.error('Response error data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      return {
        sessions: [],
        totalCount: 0,
        hasMore: false,
        currentPage: 1,
        totalPages: 1
      };
    }
  }
}

export const drawerService = DrawerService.getInstance();
