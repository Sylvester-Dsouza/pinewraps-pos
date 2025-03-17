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

  async openDrawer(drawerId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Opening drawer with ID:', drawerId);

      // Send the open command directly to the printer proxy
      const response = await axios.post(`${PRINTER_PROXY_URL}/print-and-open`, {
        type: 'open_drawer'
      });

      console.log('Drawer open response:', response.data);
      return { 
        success: true,
        error: undefined
      };
    } catch (error: any) {
      console.error('Error opening drawer:', error);
      let errorMessage = 'Failed to open drawer';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return { success: false, error: errorMessage };
    }
  }

  async openSession(drawerId: string, openingAmount: number): Promise<any> {
    try {
      console.log('Opening drawer session:', { drawerId, openingAmount });
      
      // Check if we're in development mode
      const isDevelopment = process.env.NODE_ENV === 'development';
      console.log('Running in development mode:', isDevelopment);
      
      // In development, we can send an empty drawer ID and the backend will handle it
      const payload = {
        cashDrawerId: isDevelopment && (!drawerId || drawerId.trim() === '') ? '' : drawerId,
        openingAmount
      };
      
      console.log('Sending open session request with payload:', payload);
      console.log('API URL:', `${api.defaults.baseURL}/pos/drawer-session/open`);
      
      try {
        const response = await api.post('/api/pos/drawer-session/open', payload);
        console.log('Open session response:', response.data);
        
        // After successfully opening the session, try to open the physical drawer
        // But only if we're not in development mode or if a drawer ID was provided
        if (response.data && response.data.id && (!isDevelopment || (drawerId && drawerId.trim() !== ''))) {
          try {
            await this.openDrawer(drawerId);
            console.log('Cash drawer opened after session creation');
          } catch (drawerError) {
            console.error('Failed to open physical drawer after session creation:', drawerError);
            // We don't throw here because the session was created successfully
          }
        } else if (isDevelopment) {
          console.log('Skipping physical drawer open in development mode');
        }
        
        // Print the opening receipt
        try {
          await axios.post(`${PRINTER_PROXY_URL}/print-and-open`, {
            type: 'till_open',
            data: {
              amount: openingAmount,
              sessionId: response.data.id,
              openedAt: response.data.openedAt
            }
          });
        } catch (error) {
          console.error('Error printing till open receipt:', error);
          // Don't throw error as the session was created successfully
        }
        
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
      
      const session = currentSession.data;
      const drawerId = session.drawerId || session.cashDrawerId;
      
      // Calculate expected amount
      const transactions = session.operations || [];
      const summary = transactions.reduce((acc: any, tx: any) => {
        switch (tx.type) {
          case 'SALE':
            acc.sales += tx.amount;
            break;
          case 'ADD_CASH':
            acc.payIns += tx.amount;
            break;
          case 'TAKE_CASH':
            acc.payOuts += tx.amount;
            break;
        }
        return acc;
      }, { sales: 0, refunds: 0, payIns: 0, payOuts: 0 });

      const expectedAmount = session.openingAmount + summary.sales - summary.refunds + summary.payIns - summary.payOuts;
      const difference = closingAmount - expectedAmount;

      // Close the session first
      const response = await api.post('/api/pos/drawer-session/close', { 
        closingAmount,
        expectedAmount,
        difference,
        type: 'CLOSING_BALANCE'
      });
      console.log('Close session response:', response.data);
      
      // Then print receipt and open drawer
      try {
        // First open the drawer
        if (drawerId) {
          try {
            await this.openDrawer(drawerId);
            console.log('Cash drawer opened for closing session');
          } catch (drawerError) {
            console.error('Failed to open physical drawer before closing session:', drawerError);
            // Don't throw, continue with printing
          }
        }

        // Then print the receipt
        await axios.post(`${PRINTER_PROXY_URL}/print-and-open`, {
          type: 'till_close',
          data: {
            openingAmount: session.openingAmount,
            closingAmount,
            expectedAmount,
            difference,
            transactions: session.operations,
            sessionId: session.id,
            openedAt: session.openedAt,
            closedAt: new Date()
          }
        });
      } catch (error) {
        console.error('Error printing till close receipt:', error);
        // Don't throw since session was closed successfully
      }
      
      return response.data;
    } catch (error: any) {
      console.error('Error closing session:', error);
      if (error.response) {
        console.error('Response error data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      throw new Error(error.response?.data?.message || error.message || 'Failed to close till');
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
  
  // Alias for addCash to make the API more intuitive
  async payIn(amount: number, note: string): Promise<DrawerOperation | null> {
    try {
      // First get the current session to get the drawer ID
      const currentSession = await this.getCurrentSession();
      if (!currentSession || !currentSession.data) {
        throw new Error('No active drawer session found');
      }
      
      const drawerId = currentSession.data.drawerId || currentSession.data.cashDrawerId;
      
      // Open the drawer for the pay-in operation
      if (drawerId) {
        try {
          await this.openDrawer(drawerId);
          console.log('Cash drawer opened for pay-in operation');
        } catch (drawerError) {
          console.error('Failed to open physical drawer for pay-in:', drawerError);
          // We don't throw here because we still want to process the pay-in
        }
      }
      
      const response = await api.post('/api/pos/drawer-session/pay-in', {
        amount,
        note
      });

      // Print pay-in receipt and open drawer
      try {
        await api.post(`${PRINTER_PROXY_URL}/print-and-open`, {
          type: 'cash_movement',
          data: {
            type: 'PAY_IN',
            amount,
            note,
            date: new Date(),
            sessionId: response.data.sessionId
          }
        });
      } catch (error) {
        console.error('Error printing pay-in receipt:', error);
      }

      return response.data;
    } catch (error) {
      console.error('Error during pay-in operation:', error);
      throw error;
    }
  }
  
  // Alias for removeCash to make the API more intuitive
  async payOut(amount: number, note: string): Promise<DrawerOperation | null> {
    try {
      // First get the current session to get the drawer ID
      const currentSession = await this.getCurrentSession();
      if (!currentSession || !currentSession.data) {
        throw new Error('No active drawer session found');
      }
      
      const drawerId = currentSession.data.drawerId || currentSession.data.cashDrawerId;
      
      // Open the drawer for the pay-out operation
      if (drawerId) {
        try {
          await this.openDrawer(drawerId);
          console.log('Cash drawer opened for pay-out operation');
        } catch (drawerError) {
          console.error('Failed to open physical drawer for pay-out:', drawerError);
          // We don't throw here because we still want to process the pay-out
        }
      }
      
      const response = await api.post('/api/pos/drawer-session/pay-out', {
        amount,
        note
      });

      // Print pay-out receipt and open drawer
      try {
        await api.post(`${PRINTER_PROXY_URL}/print-and-open`, {
          type: 'cash_movement',
          data: {
            type: 'PAY_OUT',
            amount,
            note,
            date: new Date(),
            sessionId: response.data.sessionId
          }
        });
      } catch (error) {
        console.error('Error printing pay-out receipt:', error);
      }

      return response.data;
    } catch (error) {
      console.error('Error during pay-out operation:', error);
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

  // Get transaction history for the current session or a specific session
  async getTransactionHistory(limit = 100, offset = 0, sessionId?: string): Promise<{ transactions: DrawerOperation[], totalCount: number }> {
    try {
      // First check if there's a current session
      const currentSession = sessionId ? { data: { id: sessionId } } : await this.getCurrentSession();
      
      if (!currentSession.data || !currentSession.data.id) {
        console.log('No active session found for transaction history');
        return { transactions: [], totalCount: 0 };
      }
      
      console.log('Fetching transactions for session:', currentSession.data.id);
      
      // Get the transactions for the session
      const response = await api.get(`/api/pos/drawer-session/${currentSession.data.id}/operations?limit=${limit}&offset=${offset}`);
      
      // Log the response for debugging
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

  // Record a cash sale transaction in the drawer session
  async recordCashSale(amount: number, notes?: string, orderNumber?: string): Promise<DrawerOperation | null> {
    try {
      console.log('Recording cash sale transaction:', { amount, notes, orderNumber });
      
      // Call the new endpoint for recording cash sales
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
