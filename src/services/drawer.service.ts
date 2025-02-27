import { api } from '@/lib/axios';

export interface DrawerOperation {
  id: string;
  sessionId: string;
  type: 'OPEN' | 'CLOSE' | 'ADD' | 'TAKE';
  amount: number;
  note?: string;
  userId: string;
  createdAt: string;
}

export interface DrawerSession {
  id: string;
  openingAmount: number;
  closingAmount?: number;
  status: 'OPEN' | 'CLOSED';
  userId: string;
  operations: DrawerOperation[];
  createdAt: string;
  updatedAt: string;
}

export const drawerService = {
  getCurrentSession: async (): Promise<DrawerSession | null> => {
    try {
      const response = await api.get('/api/pos/drawer/current');
      return response.data;
    } catch (error) {
      console.error('Error getting current session:', error);
      return null;
    }
  },

  openSession: async (openingAmount: number, note?: string): Promise<DrawerSession> => {
    try {
      const response = await api.post('/api/pos/drawer/open', { openingAmount, note });
      return response.data;
    } catch (error) {
      console.error('Error opening session:', error);
      throw error;
    }
  },

  closeSession: async (closingAmount: number, note?: string): Promise<DrawerSession> => {
    try {
      const response = await api.post('/api/pos/drawer/close', { closingAmount, note });
      return response.data;
    } catch (error) {
      console.error('Error closing session:', error);
      throw error;
    }
  },

  addCash: async (amount: number, note?: string): Promise<DrawerOperation> => {
    try {
      const response = await api.post('/api/pos/drawer/add', { amount, note });
      return response.data;
    } catch (error) {
      console.error('Error adding cash:', error);
      throw error;
    }
  },

  takeCash: async (amount: number, note?: string): Promise<DrawerOperation> => {
    try {
      const response = await api.post('/api/pos/drawer/take', { amount, note });
      return response.data;
    } catch (error) {
      console.error('Error taking cash:', error);
      throw error;
    }
  }
};
