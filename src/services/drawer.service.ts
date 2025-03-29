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
      if (!currentSession || !currentSession.data) {
        throw new Error('No active drawer session found');
      }
      
      // Close the session
      const response = await api.post('/api/pos/drawer-session/close', {
        closingAmount: closingAmount.toString()
      });
      
      // Ensure we return null for currentSession after closing
      await this.getCurrentSession();
      return response.data;
    } catch (error) {
      console.error('Error closing session:', error);
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
      const response = await api.get(`/api/pos/drawer-session/history?limit=${limit}`);
      return response.data || [];
    } catch (error) {
      console.error('Error getting session history:', error);
      return [];
    }
  }

  async getLogs(limit = 100, offset = 0): Promise<{ logs: DrawerLog[], totalCount: number }> {
    try {
      const response = await api.get(`/api/pos/drawer/logs?limit=${limit}&offset=${offset}`);
      return response.data || { logs: [], totalCount: 0 };
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
}

export const drawerService = DrawerService.getInstance();
