import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase';

/**
 * POST /api/pos/printer/print-and-open
 * Print a receipt and open the cash drawer using the default printer
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    
    // Get the default printer or the specified printer
    let printer;
    
    if (data.printerId) {
      // Fetch the specific printer from the API
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
    
    console.log(`Sending print-and-open request to printer ${printer.name} at ${printer.ipAddress}:${printer.port}`);
    
    // Prepare the payload based on the data
    const payload: any = {
      type: data.type || 'receipt',
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
      payload.type = 'split_payment';
      payload.data.amount = data.amount;
    }
    
    // Send the request to the printer proxy
    const response = await fetch(`${proxyUrl}/print-and-open`, {
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
        error: result.error || 'Failed to communicate with printer proxy',
        printer: {
          id: printer.id,
          name: printer.name,
          ipAddress: printer.ipAddress,
          port: printer.port
        }
      }, { status: response.status });
    }
    
    // Update the printer connected status via API
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/printers/${printer.id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await currentUser.getIdToken()}`
      },
      body: JSON.stringify({ connected: true })
    }).catch(err => console.error('Failed to update printer status:', err));
    
    return NextResponse.json({ 
      success: true, 
      message: result.message || 'Print and open operation completed successfully',
      printer: {
        id: printer.id,
        name: printer.name,
        ipAddress: printer.ipAddress,
        port: printer.port,
        connected: true
      }
    });
  } catch (error: any) {
    console.error('Error in print-and-open operation:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to process print-and-open operation' 
    }, { status: 500 });
  }
}
