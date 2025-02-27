import { api } from '@/lib/axios';

export interface Port {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  locationId?: string;
  vendorId?: string;
  productId?: string;
}

export class HardwareService {
  private static instance: HardwareService;
  private isConnected: boolean = false;

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

  async connectDrawer(portPath: string): Promise<boolean> {
    try {
      console.log('Connecting to drawer at:', portPath);
      const response = await api.post('/api/pos/drawer/hardware/drawer/connect', { portPath });
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
      const response = await api.post('/api/pos/drawer/hardware/drawer/open');
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
      await api.post('/api/pos/drawer/hardware/drawer/disconnect');
      this.isConnected = false;
    } catch (error) {
      console.error('Error disconnecting drawer:', error);
    }
  }

  isDrawerConnected(): boolean {
    return this.isConnected;
  }
}
