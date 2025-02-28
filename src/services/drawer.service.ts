import { api } from '@/lib/axios';
import { CashDrawer } from './hardware.service';

export interface DrawerOperation {
  id: string;
  type: 'ADD' | 'REMOVE';
  amount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DrawerSession {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openingAmount: number;
  closingAmount?: number;
  openedAt: string;
  closedAt?: string;
  operations?: DrawerOperation[];
  cashDrawerId?: string;
  cashDrawer?: CashDrawer;
}

class DrawerService {
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

  async openSession(openingAmount: number, cashDrawerId?: string, notes?: string): Promise<DrawerSession | null> {
    try {
      const payload = {
        openingAmount,
        cashDrawerId,
        notes
      };
      const response = await api.post('/api/pos/drawer/session/open', payload);
      return response.data;
    } catch (error) {
      console.error('Error opening session:', error);
      throw error;
    }
  }

  async closeSession(closingAmount: number, notes?: string): Promise<DrawerSession | null> {
    try {
      const response = await api.post('/api/pos/drawer/session/close', { closingAmount, notes });
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
