import { parkedOrderService } from '@/services/parked-order.service';
import { api } from '@/services/api';
import { ParkedOrder, ParkedOrderData } from '@/types/parked-order';
import { APIResponse } from '@/types/api';

// Mock the API module
jest.mock('@/services/api', () => ({
  api: {
    post: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('parkedOrderService', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parkOrder', () => {
    it('should successfully park an order', async () => {
      // Mock data
      const mockOrderData: ParkedOrderData = {
        customerName: 'Test Customer',
        customerPhone: '1234567890',
        items: [
          {
            productId: 'prod123',
            productName: 'Test Product',
            unitPrice: 10,
            quantity: 2,
            totalPrice: 20,
          },
        ],
        totalAmount: 20,
      };

      const mockResponse: APIResponse<ParkedOrder> = {
        success: true,
        data: {
          id: 'order123',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          customerName: 'Test Customer',
          customerPhone: '1234567890',
          items: [
            {
              productId: 'prod123',
              productName: 'Test Product',
              unitPrice: 10,
              quantity: 2,
              totalPrice: 20,
            },
          ],
          totalAmount: 20,
        },
      };

      // Mock API response
      (api.post as jest.Mock).mockResolvedValue({ data: mockResponse });

      // Call the service method
      const result = await parkedOrderService.parkOrder(mockOrderData);

      // Assertions
      expect(api.post).toHaveBeenCalledWith('/api/pos/parked-orders', mockOrderData);
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors when parking an order', async () => {
      // Mock data
      const mockOrderData: ParkedOrderData = {
        customerName: 'Test Customer',
        items: [
          {
            productId: 'prod123',
            productName: 'Test Product',
            unitPrice: 10,
            quantity: 2,
            totalPrice: 20,
          },
        ],
        totalAmount: 20,
      };

      // Mock API error
      const mockError = new Error('Network error');
      (api.post as jest.Mock).mockRejectedValue(mockError);

      // Call the service method and expect it to throw
      await expect(parkedOrderService.parkOrder(mockOrderData)).rejects.toThrow('Network error');

      // Assertions
      expect(api.post).toHaveBeenCalledWith('/api/pos/parked-orders', mockOrderData);
    });
  });

  describe('getParkedOrders', () => {
    it('should fetch all parked orders', async () => {
      // Mock response
      const mockResponse: APIResponse<ParkedOrder[]> = {
        success: true,
        data: [
          {
            id: 'order123',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            customerName: 'Test Customer',
            items: [
              {
                productId: 'prod123',
                productName: 'Test Product',
                unitPrice: 10,
                quantity: 2,
                totalPrice: 20,
              },
            ],
            totalAmount: 20,
          },
        ],
      };

      // Mock API response
      (api.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      // Call the service method
      const result = await parkedOrderService.getParkedOrders();

      // Assertions
      expect(api.get).toHaveBeenCalledWith('/api/pos/parked-orders');
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors when fetching parked orders', async () => {
      // Mock API error
      const mockError = new Error('Network error');
      (api.get as jest.Mock).mockRejectedValue(mockError);

      // Call the service method and expect it to throw
      await expect(parkedOrderService.getParkedOrders()).rejects.toThrow('Network error');

      // Assertions
      expect(api.get).toHaveBeenCalledWith('/api/pos/parked-orders');
    });
  });

  describe('getParkedOrderById', () => {
    it('should fetch a parked order by ID', async () => {
      // Mock data
      const orderId = 'order123';
      const mockResponse: APIResponse<ParkedOrder> = {
        success: true,
        data: {
          id: orderId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          customerName: 'Test Customer',
          items: [
            {
              productId: 'prod123',
              productName: 'Test Product',
              unitPrice: 10,
              quantity: 2,
              totalPrice: 20,
            },
          ],
          totalAmount: 20,
        },
      };

      // Mock API response
      (api.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      // Call the service method
      const result = await parkedOrderService.getParkedOrderById(orderId);

      // Assertions
      expect(api.get).toHaveBeenCalledWith(`/api/pos/parked-orders/${orderId}`);
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors when fetching a parked order by ID', async () => {
      // Mock data
      const orderId = 'order123';

      // Mock API error
      const mockError = new Error('Network error');
      (api.get as jest.Mock).mockRejectedValue(mockError);

      // Call the service method and expect it to throw
      await expect(parkedOrderService.getParkedOrderById(orderId)).rejects.toThrow('Network error');

      // Assertions
      expect(api.get).toHaveBeenCalledWith(`/api/pos/parked-orders/${orderId}`);
    });
  });

  describe('deleteParkedOrder', () => {
    it('should delete a parked order', async () => {
      // Mock data
      const orderId = 'order123';
      const mockResponse: APIResponse<void> = {
        success: true,
        data: undefined,
        message: 'Order deleted successfully',
      };

      // Mock API response
      (api.delete as jest.Mock).mockResolvedValue({ data: mockResponse });

      // Call the service method
      const result = await parkedOrderService.deleteParkedOrder(orderId);

      // Assertions
      expect(api.delete).toHaveBeenCalledWith(`/api/pos/parked-orders/${orderId}`);
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors when deleting a parked order', async () => {
      // Mock data
      const orderId = 'order123';

      // Mock API error
      const mockError = new Error('Network error');
      (api.delete as jest.Mock).mockRejectedValue(mockError);

      // Call the service method and expect it to throw
      await expect(parkedOrderService.deleteParkedOrder(orderId)).rejects.toThrow('Network error');

      // Assertions
      expect(api.delete).toHaveBeenCalledWith(`/api/pos/parked-orders/${orderId}`);
    });
  });
});