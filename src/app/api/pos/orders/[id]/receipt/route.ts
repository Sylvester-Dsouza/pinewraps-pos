import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase';
import { api } from '@/lib/axios';
import { generateReceiptLines } from '@/services/printer';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Verify authentication
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Get order ID from params
    const { id } = params;
    if (!id) {
      return NextResponse.json({ success: false, message: 'Order ID is required' }, { status: 400 });
    }

    // Get order from API
    const response = await api.get(`/api/pos/orders/${id}`, {
      params: {
        include: 'items.variations,items.product,payments,createdBy'
      }
    });
    
    const order = response.data;

    if (!order) {
      return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
    }

    // Generate receipt lines
    const lines = generateReceiptLines(order);

    return NextResponse.json({
      success: true,
      data: {
        lines,
        order
      }
    });
  } catch (error) {
    console.error('Error generating receipt:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
