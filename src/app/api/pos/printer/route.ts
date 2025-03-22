import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase';
import { api } from '@/lib/axios';

/**
 * GET /api/pos/printer
 * Get all printers
 */
export async function GET(req: NextRequest) {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Make API call to the web service to get printers
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/printers`, {
      headers: {
        Authorization: `Bearer ${await currentUser.getIdToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch printers from API');
    }

    const data = await response.json();
    return NextResponse.json({ printers: data.printers || [] });
  } catch (error) {
    console.error('Error fetching printers:', error);
    return NextResponse.json({ error: 'Failed to fetch printers' }, { status: 500 });
  }
}

/**
 * POST /api/pos/printer
 * Create a new printer
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    
    // If this is a printer test request, handle it differently
    if (data.action === 'print-and-open' || data.action === 'print-only') {
      return handlePrinterAction(data);
    }
    
    // Validate required fields
    if (!data.name || !data.ipAddress) {
      return NextResponse.json({ error: 'Name and IP address are required' }, { status: 400 });
    }

    // Make API call to create a printer
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/printers`, {
      method: 'POST',
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
      throw new Error('Failed to create printer via API');
    }

    const result = await response.json();
    return NextResponse.json({ printer: result.printer });
  } catch (error) {
    console.error('Error creating printer:', error);
    return NextResponse.json({ error: 'Failed to create printer' }, { status: 500 });
  }
}

/**
 * Handle printer actions (print-and-open, print-only)
 */
async function handlePrinterAction(data: any) {
  try {
    // Get the default printer or the first active printer
    let printer;
    
    if (data.printerId) {
      // If a specific printer ID is provided, fetch that printer
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Unauthorized');
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/printers/${data.printerId}`, {
        headers: {
          Authorization: `Bearer ${await currentUser.getIdToken()}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch printer from API');
      }
      
      const result = await response.json();
      printer = result.printer;
    } else {
      // Get all printers and find the default one
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Unauthorized');
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/printers`, {
        headers: {
          Authorization: `Bearer ${await currentUser.getIdToken()}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch printers from API');
      }
      
      const result = await response.json();
      const printers = result.printers || [];
      
      // Find the default printer
      printer = printers.find((p: any) => p.isDefault && p.isActive);
      
      // If no default printer, get the first active printer
      if (!printer) {
        printer = printers.find((p: any) => p.isActive);
      }
    }
    
    if (!printer) {
      return NextResponse.json({ 
        success: false, 
        error: 'No active printer found' 
      }, { status: 404 });
    }
    
    // Determine the proxy URL - try to use the one from environment variables
    const proxyUrl = process.env.PRINTER_PROXY_URL || 'http://localhost:3005';
    
    // Prepare the endpoint based on the action
    const endpoint = data.action === 'print-and-open' ? '/print-and-open' : '/test-print';
    
    // Prepare the payload based on the action and data
    const payload: any = {
      type: data.type || 'test',
      data: {
        ip: printer.ipAddress,
        port: printer.port
      }
    };
    
    // If this is an order receipt, add the order ID
    if (data.orderId) {
      payload.data.orderId = data.orderId;
    }
    
    // If this is a split payment, add the amount
    if (data.amount) {
      payload.data.amount = data.amount;
    }
    
    console.log(`Sending ${data.action} request to printer proxy at ${proxyUrl}${endpoint}`, payload);
    
    // Send the request to the printer proxy
    const response = await fetch(`${proxyUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error(`Error from printer proxy: ${result.error || 'Unknown error'}`);
      return NextResponse.json({ 
        success: false, 
        error: result.error || 'Failed to communicate with printer proxy' 
      }, { status: response.status });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: result.message || 'Operation completed successfully',
      printer: {
        id: printer.id,
        name: printer.name,
        ipAddress: printer.ipAddress,
        port: printer.port
      }
    });
  } catch (error: any) {
    console.error('Error handling printer action:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to process printer action' 
    }, { status: 500 });
  }
}
