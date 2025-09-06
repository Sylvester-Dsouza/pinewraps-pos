'use client';

import { ParkedOrder, ParkedOrderData } from '@/types/parked-order';
import { api } from './api';
import { APIResponse } from '@/types/api';

/**
 * Service for handling parked orders
 */
export const parkedOrderService = {
  /**
   * Park an order for later processing
   * @param orderData The order data to park
   * @returns API response with the parked order
   */
  parkOrder: async (orderData: ParkedOrderData): Promise<APIResponse<ParkedOrder>> => {
    try {
      const response = await api.post<APIResponse<ParkedOrder>>('/api/pos/parked-orders', orderData);
      return response.data;
    } catch (error) {
      console.error('Error parking order:', error);
      throw error;
    }
  },

  /**
   * Get all parked orders
   * @returns API response with the parked orders
   */
  getParkedOrders: async (): Promise<APIResponse<ParkedOrder[]>> => {
    try {
      const response = await api.get<APIResponse<ParkedOrder[]>>('/api/pos/parked-orders');
      return response.data;
    } catch (error) {
      console.error('Error fetching parked orders:', error);
      throw error;
    }
  },

  /**
   * Get a parked order by ID
   * @param id The ID of the parked order
   * @returns API response with the parked order
   */
  getParkedOrderById: async (id: string): Promise<APIResponse<ParkedOrder>> => {
    try {
      const response = await api.get<APIResponse<ParkedOrder>>(`/api/pos/parked-orders/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching parked order:', error);
      throw error;
    }
  },

  /**
   * Delete a parked order
   * @param id The ID of the parked order to delete
   * @returns API response
   */
  deleteParkedOrder: async (id: string): Promise<APIResponse<void>> => {
    try {
      const response = await api.delete<APIResponse<void>>(`/api/pos/parked-orders/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting parked order:', error);
      throw error;
    }
  }
};