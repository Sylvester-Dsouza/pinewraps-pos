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

  async connectDrawer(portPathOrDrawerId: string): Promise<boolean> {
    try {
      console.log('Connecting to drawer:', portPathOrDrawerId);
      
      // Check if this is a drawer ID (UUID format) or a port path
      const isDrawerId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(portPathOrDrawerId) || 
                         /^[0-9a-f]{25}$/i.test(portPathOrDrawerId); // For CUID format
      
      let payload;
      if (isDrawerId) {
        payload = { drawerId: portPathOrDrawerId };
        this.connectedDrawerId = portPathOrDrawerId;
      } else {
        payload = { portPath: portPathOrDrawerId };
      }
      
      const response = await api.post('/api/pos/drawer/hardware/drawer/connect', payload);
      console.log('Connect response:', response.data);
      this.isConnected = response.data.success;
      return response.data.success;
    } catch (error) {
      console.error('Error connecting drawer:', error);
      return false;
    }
  }

  async openDrawer(): Promise<boolean> {
    try {
      console.log('Opening drawer...');
      const payload = this.connectedDrawerId ? { drawerId: this.connectedDrawerId } : {};
      const response = await api.post('/api/pos/drawer/hardware/drawer/open', payload);
      console.log('Open response:', response.data);
      return response.data.success;
    } catch (error) {
      console.error('Error opening drawer:', error);
      return false;
    }
  }

  async disconnectDrawer(): Promise<void> {
    try {
      console.log('Disconnecting drawer...');
      const payload = this.connectedDrawerId ? { drawerId: this.connectedDrawerId } : {};
      await api.post('/api/pos/drawer/hardware/drawer/disconnect', payload);
      this.isConnected = false;
      this.connectedDrawerId = undefined;
    } catch (error) {
      console.error('Error disconnecting drawer:', error);
    }
  }

  isDrawerConnected(): boolean {
    return this.isConnected;
  }
}
