import { api } from '@/lib/axios';

export interface Port {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  locationId?: string;
  vendorId?: string;
  productId?: string;
}

export interface Printer {
  id: string;
  name: string;
  connectionType: 'USB' | 'NETWORK' | 'BLUETOOTH';
  ipAddress?: string;
  port?: number;
  vendorId?: string;
  productId?: string;
  serialPath?: string;
  isDefault: boolean;
  printerType: 'RECEIPT' | 'KITCHEN' | 'LABEL';
}

export interface CashDrawer {
  id: string;
  name: string;
  ipAddress?: string;
  port?: number;
  connectionType: 'SERIAL' | 'NETWORK' | 'PRINTER';
  serialPath?: string;
  printerId?: string;
  printer?: Printer;
  isActive: boolean;
  connected?: boolean;
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
      return response.data || [];
    } catch (error) {
      console.error('Error listing ports:', error);
      return [];
    }
  }

  async listPrinters(): Promise<Printer[]> {
    try {
      console.log('Fetching printers...');
      const response = await api.get('/api/pos/printer');
      console.log('Printers response:', response.data.printers);
      return response.data.printers || [];
    } catch (error) {
      console.error('Error listing printers:', error);
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

  async updateCashDrawer(id: string, drawer: Partial<CashDrawer>): Promise<CashDrawer> {
    try {
      console.log('Updating cash drawer:', drawer);
      const response = await api.put(`/api/pos/drawer/drawers/${id}`, drawer);
      console.log('Update drawer response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error updating cash drawer:', error);
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
        payload = { serialPath: portPathOrDrawerId };
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

  async openCashDrawer(drawerId: string): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      console.log('Opening cash drawer:', drawerId);
      
      const response = await api.post('/api/pos/drawer/open', {
        drawerId
      });
      
      console.log('Open drawer response:', response.data);
      
      return {
        success: response.data.success,
        details: response.data
      };
    } catch (error) {
      console.error('Error opening cash drawer:', error);
      
      let errorMessage = 'Unknown error occurred';
      let details = undefined;
      
      if (error.response && error.response.data) {
        errorMessage = error.response.data.error || 'Server error';
        details = error.response.data.details || undefined;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage,
        details: details
      };
    }
  }

  async printReceiptAndOpenDrawer(drawerId: string): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      console.log('Printing receipt and opening cash drawer:', drawerId);
      
      const response = await api.post('/api/pos/drawer/print-and-open', {
        drawerId
      });
      
      console.log('Print and open drawer response:', response.data);
      
      return {
        success: response.data.success,
        details: response.data
      };
    } catch (error) {
      console.error('Error printing receipt and opening cash drawer:', error);
      let errorMessage = 'Unknown error occurred';
      
      if (error.response) {
        console.error('Error response data:', error.response.data);
        errorMessage = error.response.data.error || error.response.data.details || `Server error: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = 'No response from server. Check your network connection.';
      } else {
        errorMessage = error.message || 'Error setting up request';
      }
      
      return { 
        success: false, 
        error: errorMessage,
        details: error.response?.data
      };
    }
  }

  async testPrinter(printerId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Testing printer:', printerId);
      const response = await api.post(`/api/pos/printer/${printerId}/test`);
      console.log('Test printer response:', response.data);
      return { 
        success: response.data.success,
        error: response.data.error || undefined
      };
    } catch (error) {
      console.error('Error testing printer:', error);
      let errorMessage = 'Unknown error occurred';
      
      if (error.response) {
        errorMessage = error.response.data?.error || `Server error: ${error.response.status}`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return { success: false, error: errorMessage };
    }
  }

  async testPrinterDrawer(printerId: string): Promise<any> {
    try {
      const response = await api.post('/api/pos/printer/test-printer-drawer', {
        printerId
      });
      return response.data;
    } catch (error) {
      console.error('Error testing printer drawer:', error);
      throw error;
    }
  }

  async scanForNetworkPrinters(): Promise<Printer[]> {
    try {
      console.log('Scanning for network printers...');
      const response = await api.get('/api/pos/printer/scan');
      console.log('Network printers scan response:', response.data.printers);
      return response.data.printers || [];
    } catch (error) {
      console.error('Error scanning for network printers:', error);
      return [];
    }
  }
}

export const hardwareService = HardwareService.getInstance();
