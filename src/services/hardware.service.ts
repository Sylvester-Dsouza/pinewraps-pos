import { api } from '@/lib/axios';
import axios from 'axios';

// Try multiple printer proxy URLs in case one fails
// This ensures we can connect to the printer proxy regardless of where it's running
const PRINTER_PROXY_URLS = [
  process.env.NEXT_PUBLIC_PRINTER_PROXY_URL,
  'http://localhost:3005',
  'http://192.168.0.14:3005',
];

// Find the first non-empty URL from the list
const PRINTER_PROXY_URL = PRINTER_PROXY_URLS.find(url => url && url.trim() !== '') || 'http://localhost:3005';

console.log('PRINTER_PROXY_URL in hardware.service:', PRINTER_PROXY_URL);

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
      
      // Check if we have printers in the response
      if (response.data.printers && Array.isArray(response.data.printers)) {
        // Log each printer for debugging
        response.data.printers.forEach((printer: Printer) => {
          console.log(`Found printer: ${printer.name}, Type: ${printer.connectionType}, ID: ${printer.id}`);
          if (printer.connectionType === 'USB') {
            console.log(`USB Printer details: VendorID: ${printer.vendorId}, ProductID: ${printer.productId}`);
          } else if (printer.connectionType === 'NETWORK') {
            console.log(`Network Printer details: IP: ${printer.ipAddress}, Port: ${printer.port}`);
          }
        });
        
        console.log(`Total printers found: ${response.data.printers.length}`);
        return response.data.printers;
      } else {
        console.log('No printers found or invalid response format');
        return [];
      }
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

  async getCashDrawers(): Promise<CashDrawer[]> {
    return this.listCashDrawers();
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
      
      // Update the drawer to set it as disconnected
      const updatedDrawer = await this.updateCashDrawer(drawerId, {
        connected: false
      });
      
      if (updatedDrawer) {
        console.log('Drawer disconnected successfully:', updatedDrawer);
        this.isConnected = false;
        this.connectedDrawerId = null;
        
        return { 
          success: true 
        };
      } else {
        return {
          success: false,
          error: 'Failed to disconnect drawer'
        };
      }
    } catch (error) {
      console.error('Error deleting cash drawer:', error);
      let errorMessage = 'Unknown error occurred';
      
      if (error.response) {
        console.error('Error response data:', error.response.data);
        errorMessage = error.response.data.error || error.response.data?.message || `Server error: ${error.response.status}`;
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
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async disconnectDrawer(drawerId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Disconnecting drawer:', drawerId);
      
      // Update the drawer to set it as disconnected
      const updatedDrawer = await this.updateCashDrawer(drawerId, {
        connected: false
      });
      
      if (updatedDrawer) {
        console.log('Drawer disconnected successfully:', updatedDrawer);
        this.isConnected = false;
        this.connectedDrawerId = null;
        
        return { 
          success: true
        };
      } else {
        return {
          success: false,
          error: 'Failed to disconnect drawer'
        };
      }
    } catch (error) {
      console.error('Error disconnecting drawer:', error);
      let errorMessage = 'Unknown error occurred';
      
      if (error.response) {
        console.error('Error response data:', error.response.data);
        errorMessage = error.response.data.error || `Server error: ${error.response.status}`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async openCashDrawer(drawerId: string): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      console.log('Opening cash drawer:', drawerId);
      
      // First try to open the drawer directly through the printer proxy
      try {
        console.log(`Sending open-drawer request to ${PRINTER_PROXY_URL}/open-drawer`);
        
        const response = await axios.post(`${PRINTER_PROXY_URL}/open-drawer`, {
          skipConnectivityCheck: true
        });
        
        console.log('Open drawer response:', response.data);
        
        if (response.data && response.data.success) {
          console.log('Successfully opened drawer using printer proxy');
          return {
            success: true,
            details: response.data
          };
        } else {
          console.error('Failed to open drawer:', response.data?.message || 'Unknown error');
          return {
            success: false,
            error: response.data?.message || 'Unknown error'
          };
        }
      } catch (proxyError) {
        console.error('Error using printer proxy to open drawer:', proxyError.message || 'fetch failed');
        // Fall back to API method
      }
      
      // Fall back to API method if direct method fails
      const apiResponse = await api.post('/api/pos/drawer/open', {
        drawerId
      });
      
      console.log('Open drawer API response:', apiResponse.data);
      
      return {
        success: apiResponse.data.success,
        details: apiResponse.data
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
      
      // First try to print and open directly through the printer proxy
      try {
        console.log(`Sending print-and-open request to ${PRINTER_PROXY_URL}/print-and-open`);
        
        const response = await axios.post(`${PRINTER_PROXY_URL}/print-and-open`, {
          skipConnectivityCheck: true
        });
        
        console.log('Print and open response:', response.data);
        
        if (response.data && response.data.success) {
          console.log('Successfully printed receipt and opened drawer using printer proxy');
          return {
            success: true,
            details: response.data
          };
        } else {
          console.error('Failed to print receipt and open drawer:', response.data?.message || 'Unknown error');
          return {
            success: false,
            error: response.data?.message || 'Unknown error'
          };
        }
      } catch (proxyError) {
        console.error('Error using printer proxy to print and open:', proxyError.message || 'fetch failed');
        // Fall back to API method
      }
      
      // Fall back to API method if direct method fails
      const apiResponse = await api.post('/api/pos/drawer/print-and-open', {
        drawerId
      });
      
      console.log('Print and open drawer API response:', apiResponse.data);
      
      return {
        success: apiResponse.data.success,
        details: apiResponse.data
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

  async testPrinterDrawer(ip: string, port: number): Promise<boolean> {
    try {
      console.log(`Testing printer at ${ip}:${port} and opening drawer`);
      
      // First try using the printer proxy directly
      try {
        console.log(`Sending open-drawer request to ${PRINTER_PROXY_URL}/open-drawer`);
        
        const response = await axios.post(`${PRINTER_PROXY_URL}/open-drawer`, {
          ip,
          port,
          skipConnectivityCheck: false // Perform connectivity check for test
        }, {
          timeout: 10000 // 10 second timeout
        });
        
        console.log('Printer proxy response:', response.data);
        
        if (response.data && response.data.success) {
          console.log('Successfully opened drawer via printer proxy');
          return true;
        } else {
          console.error('Failed to open drawer:', response.data?.message || 'Unknown error');
          return false;
        }
      } catch (error) {
        console.error('Error using printer proxy for drawer test:', error.message || 'fetch failed');
        return false;
      }
    } catch (error) {
      console.error('Error testing printer and drawer:', error);
      return false;
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

  async getPrinterConfig(): Promise<{ ip: string; port: number; skipConnectivityCheck: boolean }> {
    try {
      // Fetch the printer configuration from the database
      const response = await api.get('/api/pos/printer/config');
      const data = response.data;
      
      if (data && data.success && data.printer) {
        console.log('Printer config from API:', data.printer);
        // Return with the parameter names that the printer proxy expects
        return { 
          ip: data.printer.ipAddress,
          port: data.printer.port,
          skipConnectivityCheck: true // Always skip connectivity check for operations
        };
      }
      
      // If no printer configuration is found, use default values
      console.warn('No printer configuration found in database, using default values');
      return { 
        ip: 'Locahost', // Default printer IP
        port: 9100,         // Default printer port
        skipConnectivityCheck: true 
      };
    } catch (error) {
      console.error('Error fetching printer config:', error);
      // If there's an error, use default values
      return { 
        ip: 'localhost', // Default printer IP
        port: 9100,         // Default printer port
        skipConnectivityCheck: true 
      };
    }
  }
}

export const hardwareService = HardwareService.getInstance();
