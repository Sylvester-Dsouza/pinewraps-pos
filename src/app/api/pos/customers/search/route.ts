import { NextResponse } from 'next/server';
import { api } from '@/lib/axios';

/**
 * GET /api/pos/customers/search
 * 
 * Search for customers by name, email, or phone
 */
export async function GET(request: Request) {
  try {
    // Get the search query from the URL
    const url = new URL(request.url);
    const query = url.searchParams.get('query') || '';
    
    console.log(`Searching for customers with query: "${query}"`);
    
    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        success: false,
        error: 'Search query must be at least 2 characters long',
      }, { status: 400 });
    }
    
    // Search for customers via the external API
    const response = await api.get(`/api/customers/search?query=${encodeURIComponent(query)}`);
    const apiCustomers = response.data.data || [];
    
    console.log(`Found ${apiCustomers.length} customers matching query "${query}"`);
    
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
    console.error('Error searching customers:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to search customers',
      message: error.message,
    }, { status: 500 });
  }
}
