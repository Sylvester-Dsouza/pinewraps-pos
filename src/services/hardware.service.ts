import { api } from '@/lib/axios';

export interface Port {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  locationId?: string;
  vendorId?: string;
  productId?: string;
}

export interface CashDrawer {
  id: string;
  name: string;
  ipAddress?: string;
  port?: number;
  connectionType: 'SERIAL' | 'NETWORK' | 'USB';
  serialPath?: string;
  isActive: boolean;
  locationId?: string;
  createdAt: string;
  updatedAt: string;
}

export class HardwareService {
  private static instance: HardwareService;
  private isConnected: boolean = false;
  private connectedDrawerId?: string;

  private constructor() {}

  static getInstance(): HardwareService {
    if (!HardwareService.instance) {
      HardwareService.instance = new HardwareService();
    }
    return HardwareService.instance;
  }

  async listPorts(): Promise<Port[]> {
    try {
      console.log('Fetching ports...');
      const response = await api.get('/api/pos/drawer/hardware/ports');
      console.log('Ports response:', response.data);
      return response.data.ports || [];
    } catch (error) {
      console.error('Error listing ports:', error);
      return [];
    }
  }

  async listCashDrawers(): Promise<CashDrawer[]> {
    try {
      console.log('Fetching cash drawers...');
      const response = await api.get('/api/pos/drawer/drawers');
      console.log('Cash drawers response:', response.data);
      return response.data || [];
    } catch (error) {
      console.error('Error listing cash drawers:', error);
      return [];
    }
  }

  async saveCashDrawer(drawer: Partial<CashDrawer>): Promise<CashDrawer> {
    try {
      console.log('Saving cash drawer:', drawer);
      const response = await api.post('/api/pos/drawer/drawers', drawer);
      console.log('Save drawer response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error saving cash drawer:', error);
      throw error;
    }
  }

  async deleteCashDrawer(drawerId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Deleting cash drawer:', drawerId);
      const response = await api.delete(`/api/pos/drawer/drawers/${drawerId}`);
      console.log('Delete drawer response:', response.data);
      return { 
        success: true 
      };
    } catch (error) {
      console.error('Error deleting cash drawer:', error);
      let errorMessage = 'Unknown error occurred';
      
      if (error.response) {
        errorMessage = error.response.data?.error || error.response.data?.message || `Server error: ${error.response.status}`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async connectDrawer(portPathOrDrawerId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Connecting to drawer:', portPathOrDrawerId);
      
      // Check if this is a drawer ID (UUID format) or a port path
      const isDrawerId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(portPathOrDrawerId) || 
                         /^[a-z0-9]{25}$/i.test(portPathOrDrawerId); // For CUID format
      
      console.log('Is drawer ID:', isDrawerId);
      
      let payload;
      if (isDrawerId) {
        payload = { drawerId: portPathOrDrawerId };
        this.connectedDrawerId = portPathOrDrawerId;
      } else {
        payload = { portPath: portPathOrDrawerId };
      }
      
      console.log('Connect payload:', payload);
      const response = await api.post('/api/pos/drawer/hardware/drawer/connect', payload);
      console.log('Connect response:', response.data);
      this.isConnected = response.data.success;
      return { 
        success: response.data.success,
        error: response.data.error || undefined
      };
    } catch (error) {
      console.error('Error connecting drawer:', error);
      let errorMessage = 'Unknown error occurred';
      
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Error response data:', error.response.data);
        errorMessage = error.response.data.error || `Server error: ${error.response.status}`;
      } else if (error.request) {
        // The request was made but no response was received
        errorMessage = 'No response from server. Check your network connection.';
      } else {
        // Something happened in setting up the request that triggered an Error
        errorMessage = error.message || 'Error setting up request';
      }
      
      return { success: false, error: errorMessage };
    }
  }

  async openDrawer(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Opening drawer...');
      const payload = this.connectedDrawerId ? { drawerId: this.connectedDrawerId } : {};
      const response = await api.post('/api/pos/drawer/hardware/drawer/open', payload);
      console.log('Open response:', response.data);
      return { 
        success: response.data.success,
        error: response.data.error || undefined
      };
    } catch (error) {
      console.error('Error opening drawer:', error);
      let errorMessage = 'Unknown error occurred';
      
      if (error.response) {
        errorMessage = error.response.data.error || `Server error: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = 'No response from server. Check your network connection.';
      } else {
        errorMessage = error.message || 'Error setting up request';
      }
      
      return { success: false, error: errorMessage };
    }
  }

  async disconnectDrawer(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Disconnecting drawer...');
      const payload = this.connectedDrawerId ? { drawerId: this.connectedDrawerId } : {};
      const response = await api.post('/api/pos/drawer/hardware/drawer/disconnect', payload);
      this.isConnected = false;
      this.connectedDrawerId = undefined;
      return { 
        success: true,
        error: undefined
      };
    } catch (error) {
      console.error('Error disconnecting drawer:', error);
      let errorMessage = 'Unknown error occurred';
      
      if (error.response) {
        errorMessage = error.response.data.error || `Server error: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = 'No response from server. Check your network connection.';
      } else {
        errorMessage = error.message || 'Error setting up request';
      }
      
      return { success: false, error: errorMessage };
    }
  }

  isDrawerConnected(): boolean {
    return this.isConnected;
  }
}
