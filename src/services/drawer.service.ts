import axios from 'axios';
import { getApiConfig } from '@/lib/api-config';
import { api } from '@/lib/axios';
import { toast } from '@/lib/toast-utils'; 

// Drawer Service Types
export interface DrawerOperation {
  id: string;
  amount: number;
  type: 'OPENING_BALANCE' | 'CLOSING_BALANCE' | 'ADD_CASH' | 'TAKE_CASH' | 'SALE';
  notes?: string;
  sessionId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DrawerSession {
  id: string;
  openAmount: number;
  closeAmount?: number;
  status: 'OPEN' | 'CLOSED';
  userId: string;
  drawerId: string;
  operations?: DrawerOperation[];
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface CashDrawer {
  id: string;
  name: string;
  ipAddress?: string;
  port?: number;
  connectionType: 'SERIAL' | 'NETWORK' | 'PRINTER';
  serialPath?: string;
  printerId?: string;
  isActive: boolean;
  locationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DrawerLog {
  id: string;
  userId: string;
  drawerId?: string;
  action: string;
  timestamp: string;
  success: boolean;
  error?: string;
  ipAddress?: string;
  deviceInfo?: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
    name: string;
  };
}

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

  async getCurrentSession(): Promise<any> {
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

  async openSession(openingAmount: number): Promise<any> {
    try {
      console.log('Opening drawer session:', { openingAmount });
      
      const payload = {
        openingAmount
      };
      
      console.log('Sending open session request with payload:', payload);
      
      try {
        const response = await api.post('/api/pos/drawer-session/open', payload);
        console.log('Open session response:', response.data);
        
        // Don't print and open drawer here since we already did it in handleOpenTillClick
        return response.data;
      } catch (apiError) {
        console.error('API error in openSession:', apiError);
        if (apiError.response) {
          console.error('Response status:', apiError.response.status);
          console.error('Response data:', apiError.response.data);
        }
        throw apiError;
      }
    } catch (error) {
      console.error('Error opening session:', error);
      if (error.response) {
        console.error('Response error data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      throw error;
    }
  }

  async closeSession(closingAmount: number): Promise<any> {
    try {
      console.log('Closing drawer session with amount:', closingAmount);
      
      // First get the current session to get the drawer ID
      const currentSession = await this.getCurrentSession();
      if (!currentSession || !currentSession.data) {
        throw new Error('No active drawer session found');
      }
      
      // Close the session
      const response = await api.post('/api/pos/drawer-session/close', {
        closingAmount
      });
      
      // Don't print and open drawer here since we already did it in handleCloseTillClick
      
      // Ensure we return null for currentSession after closing
      await this.getCurrentSession();
      return response.data;
    } catch (error) {
      console.error('Error closing session:', error);
      throw error;
    }
  }

  async payIn(amount: number, notes?: string): Promise<any> {
    try {
      const response = await api.post('/api/pos/drawer-session/operation/add', {
        amount,
        notes
      });
      
      // Print the pay in receipt and open drawer
      try {
        await axios.post(`${PRINTER_PROXY_URL}/print-and-open`, {
          type: 'pay_in',
          data: {
            amount,
            notes,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error('Error printing pay in receipt:', error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error in pay in:', error);
      throw error;
    }
  }

  async payOut(amount: number, notes?: string): Promise<any> {
    try {
      const response = await api.post('/api/pos/drawer-session/operation/remove', {
        amount,
        notes
      });
      
      // Print the pay out receipt and open drawer
      try {
        await axios.post(`${PRINTER_PROXY_URL}/print-and-open`, {
          type: 'pay_out',
          data: {
            amount,
            notes,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error('Error printing pay out receipt:', error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error in pay out:', error);
      throw error;
    }
  }

  async addCash(amount: number, notes?: string): Promise<DrawerOperation | null> {
    try {
      console.log('Adding cash:', { amount, notes });
      const response = await api.post('/api/pos/drawer-session/operation/add', { 
        amount, 
        notes,
        type: 'ADD_CASH'
      });
      return response.data;
    } catch (error) {
      console.error('Error adding cash:', error);
      throw error;
    }
  }

  async removeCash(amount: number, notes?: string): Promise<DrawerOperation | null> {
    try {
      console.log('Removing cash:', { amount, notes });
      const response = await api.post('/api/pos/drawer-session/operation/remove', { 
        amount, 
        notes,
        type: 'TAKE_CASH'
      });
      return response.data;
    } catch (error) {
      console.error('Error removing cash:', error);
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

  async getDrawers(): Promise<CashDrawer[]> {
    try {
      const response = await api.get('/api/pos/drawer/drawers');
      return response.data || [];
    } catch (error) {
      console.error('Error getting drawers:', error);
      return [];
    }
  }

  async getDrawerLogs(drawerId?: string, limit = 100, offset = 0): Promise<{ logs: DrawerLog[], totalCount: number }> {
    try {
      let url = `/api/pos/drawer/logs?limit=${limit}&offset=${offset}`;
      if (drawerId) {
        url += `&drawerId=${drawerId}`;
      }
      
      const response = await api.get(url);
      return response.data;
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

  async recordCashSale(amount: number, notes?: string, orderNumber?: string): Promise<DrawerOperation | null> {
    try {
      console.log('Recording cash sale transaction:', { amount, notes, orderNumber });
      
      const response = await api.post('/api/pos/drawer-session/operation/sale', {
        amount,
        notes,
        orderNumber
      });
      
      console.log('Cash sale transaction recorded:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error recording cash sale transaction:', error);
      if (error.response) {
        console.error('Response error data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      return null;
    }
  }
}

export const drawerService = DrawerService.getInstance();
