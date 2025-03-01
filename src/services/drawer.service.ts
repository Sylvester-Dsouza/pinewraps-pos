import { api } from '@/lib/axios';

// Drawer Service Types
export interface DrawerOperation {
  id: string;
  amount: number;
  type: 'ADD' | 'REMOVE';
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

export class DrawerService {
  private static instance: DrawerService;

  private constructor() {}

  static getInstance(): DrawerService {
    if (!DrawerService.instance) {
      DrawerService.instance = new DrawerService();
    }
    return DrawerService.instance;
  }

  async getCurrentSession(): Promise<DrawerSession | null> {
    try {
      const response = await api.get('/api/pos/drawer/session/current');
      return response.data || null;
    } catch (error) {
      console.error('Error getting current session:', error);
      return null;
    }
  }

  async openDrawer(drawerId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await api.post('/api/pos/drawer/open', { drawerId });
      return { 
        success: true,
        error: undefined
      };
    } catch (error) {
      console.error('Error opening drawer:', error);
      let errorMessage = 'Unknown error occurred';
      
      if (error.response) {
        errorMessage = error.response.data?.error || `Server error: ${error.response.status}`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return { success: false, error: errorMessage };
    }
  }

  async openSession(openAmount: number, drawerId: string): Promise<DrawerSession | null> {
    try {
      const response = await api.post('/api/pos/drawer/session/open', { openAmount, drawerId });
      return response.data;
    } catch (error) {
      console.error('Error opening session:', error);
      throw error;
    }
  }

  async closeSession(closeAmount: number): Promise<DrawerSession | null> {
    try {
      const response = await api.post('/api/pos/drawer/session/close', { closeAmount });
      return response.data;
    } catch (error) {
      console.error('Error closing session:', error);
      throw error;
    }
  }

  async addCash(amount: number, notes?: string): Promise<DrawerOperation | null> {
    try {
      const response = await api.post('/api/pos/drawer/operation/add', { amount, notes });
      return response.data;
    } catch (error) {
      console.error('Error adding cash:', error);
      throw error;
    }
  }

  async removeCash(amount: number, notes?: string): Promise<DrawerOperation | null> {
    try {
      const response = await api.post('/api/pos/drawer/operation/remove', { amount, notes });
      return response.data;
    } catch (error) {
      console.error('Error removing cash:', error);
      throw error;
    }
  }

  async getSessionHistory(limit: number = 10): Promise<DrawerSession[]> {
    try {
      const response = await api.get(`/api/pos/drawer/session/history?limit=${limit}`);
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
}

export const drawerService = DrawerService.getInstance();
