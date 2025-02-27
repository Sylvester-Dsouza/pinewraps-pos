export class MockHardwareService {
  private static instance: MockHardwareService;
  private isConnected: boolean = false;
  private currentStatus: 'open' | 'closed' | 'unknown' = 'closed';
  private mockPorts = [
    { path: 'COM1', manufacturer: 'Mock Drawer 1' },
    { path: 'COM2', manufacturer: 'Mock Drawer 2' },
    { path: 'COM3', manufacturer: 'Mock Receipt Printer' },
  ];

  private constructor() {}

  static getInstance(): MockHardwareService {
    if (!MockHardwareService.instance) {
      MockHardwareService.instance = new MockHardwareService();
    }
    return MockHardwareService.instance;
  }

  async listPorts(): Promise<any[]> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return this.mockPorts;
  }

  async connectDrawer(portPath: string): Promise<boolean> {
    // Simulate network delay and connection process
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate success for COM1 and COM2, failure for others
    const success = portPath === 'COM1' || portPath === 'COM2';
    this.isConnected = success;
    return success;
  }

  async openDrawer(): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Simulate drawer opening
    this.currentStatus = 'open';
    
    // Simulate drawer closing after 3 seconds
    setTimeout(() => {
      this.currentStatus = 'closed';
    }, 3000);

    return true;
  }

  disconnectDrawer(): void {
    this.isConnected = false;
    this.currentStatus = 'unknown';
  }

  async getDrawerStatus(): Promise<'open' | 'closed' | 'unknown'> {
    if (!this.isConnected) {
      return 'unknown';
    }

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    return this.currentStatus;
  }
}
