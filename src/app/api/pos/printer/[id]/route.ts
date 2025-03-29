import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase';

/**
 * GET /api/pos/printer/[id]
 * Get a specific printer by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the printer from the API
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/printers/${params.id}`, {
      headers: {
        Authorization: `Bearer ${await currentUser.getIdToken()}`
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Printer not found' }, { status: 404 });
      }
      throw new Error('Failed to fetch printer from API');
    }

    const data = await response.json();
    return NextResponse.json({ printer: data.printer });
  } catch (error) {
    console.error('Error fetching printer:', error);
    return NextResponse.json({ error: 'Failed to fetch printer' }, { status: 500 });
  }
}

/**
 * PUT /api/pos/printer/[id]
 * Update a printer
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();

    // Validate required fields
    if (!data.name || !data.ipAddress) {
      return NextResponse.json({ error: 'Name and IP address are required' }, { status: 400 });
    }

    // Update the printer via API
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/printers/${params.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await currentUser.getIdToken()}`
      },
      body: JSON.stringify({
        name: data.name,
        ipAddress: data.ipAddress,
        port: data.port || 9100,
        isDefault: !!data.isDefault,
        isActive: data.isActive !== undefined ? data.isActive : true
      })
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Printer not found' }, { status: 404 });
      }
      throw new Error('Failed to update printer via API');
    }

    const result = await response.json();
    return NextResponse.json({ printer: result.printer });
  } catch (error) {
    console.error('Error updating printer:', error);
    return NextResponse.json({ error: 'Failed to update printer' }, { status: 500 });
  }
}

/**
 * DELETE /api/pos/printer/[id]
 * Delete a printer
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete the printer via API
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/printers/${params.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${await currentUser.getIdToken()}`
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Printer not found' }, { status: 404 });
      }
      throw new Error('Failed to delete printer via API');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting printer:', error);
    return NextResponse.json({ error: 'Failed to delete printer' }, { status: 500 });
  }
}
