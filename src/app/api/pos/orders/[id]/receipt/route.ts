import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { generateReceiptLines } from '@/services/printer';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Verify authentication
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Get order ID from params
    const { id } = params;
    if (!id) {
      return NextResponse.json({ success: false, message: 'Order ID is required' }, { status: 400 });
    }

    // Get order from database
    const order = await db.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            variations: true,
            product: true
          }
        },
        payments: true,
        createdBy: true
      }
    });

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
