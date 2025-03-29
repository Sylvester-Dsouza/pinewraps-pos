import { NextResponse } from 'next/server';
import { api } from '@/lib/axios';

/**
 * GET /api/pos/customers
 * 
 * Get all customers
 */
export async function GET(request: Request) {
  try {
    // Get customers from the external API
    const response = await api.get('/api/customers');
    const apiCustomers = response.data.data || [];
    
    console.log(`Retrieved ${apiCustomers.length} customers from API`);
    
    // Transform the data to match the expected format
    const customers = apiCustomers.map(customer => ({
      id: customer.id,
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      email: customer.email || '',
      phone: customer.phone || '',
      reward: {
        points: customer.rewardPoints || 0,
      },
    }));
    
    // Return the customers
    return NextResponse.json({
      success: true,
      data: customers,
    });
  } catch (error: any) {
    console.error('Error getting customers:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get customers',
      message: error.message,
    }, { status: 500 });
  }
}
