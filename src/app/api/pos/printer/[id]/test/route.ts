import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase';

/**
 * POST /api/pos/printer/[id]/test
 * Test a specific printer
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the printer from the database via API
    const printerResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/printers/${params.id}`, {
      headers: {
        Authorization: `Bearer ${await currentUser.getIdToken()}`
      }
    });

    if (!printerResponse.ok) {
      if (printerResponse.status === 404) {
        return NextResponse.json({ error: 'Printer not found' }, { status: 404 });
      }
      throw new Error('Failed to fetch printer from API');
    }

    const printerData = await printerResponse.json();
    const printer = printerData.printer;

    // Get the request body to check if this is a print-and-open or just a connection test
    const data = await req.json().catch(() => ({}));
    const action = data.action || 'test'; // Default to 'test' if no action specified

    // Determine the proxy URL - try to use the one from environment variables
    const proxyUrl = process.env.PRINTER_PROXY_URL || 'http://localhost:3005';
    
    // First, check if the printer is reachable
    const checkEndpoint = '/check-connection';
    console.log(`Testing connection to printer ${printer.name} at ${printer.ipAddress}:${printer.port}`);
    
    const checkResponse = await fetch(`${proxyUrl}${checkEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ip: printer.ipAddress,
        port: printer.port
      })
    });
    
    const checkResult = await checkResponse.json();
    
    // If the printer is not reachable, return an error
    if (!checkResponse.ok || !checkResult.success) {
      console.error(`Printer ${printer.name} at ${printer.ipAddress}:${printer.port} is not reachable: ${checkResult.message || 'Unknown error'}`);
      return NextResponse.json({ 
        success: false, 
        error: checkResult.message || 'Printer is not reachable',
        printer: {
          id: printer.id,
          name: printer.name,
          ipAddress: printer.ipAddress,
          port: printer.port
        }
      }, { status: checkResponse.ok ? 200 : 500 });
    }
    
    // If this is just a connection test, return success
    if (action === 'test') {
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
        message: `Printer ${printer.name} at ${printer.ipAddress}:${printer.port} is reachable`,
        printer: {
          id: printer.id,
          name: printer.name,
          ipAddress: printer.ipAddress,
          port: printer.port,
          connected: true
        }
      });
    }
    
    // If this is a print test, send a print command
    if (action === 'print') {
      const printEndpoint = '/test-print';
      const printResponse = await fetch(`${proxyUrl}${printEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ip: printer.ipAddress,
          port: printer.port
        })
      });
      
      const printResult = await printResponse.json();
      
      if (!printResponse.ok) {
        console.error(`Error printing test receipt: ${printResult.error || 'Unknown error'}`);
        return NextResponse.json({ 
          success: false, 
          error: printResult.error || 'Failed to print test receipt',
          printer: {
            id: printer.id,
            name: printer.name,
            ipAddress: printer.ipAddress,
            port: printer.port
          }
        }, { status: printResponse.status });
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
        message: printResult.message || 'Test receipt printed successfully',
        printer: {
          id: printer.id,
          name: printer.name,
          ipAddress: printer.ipAddress,
          port: printer.port,
          connected: true
        }
      });
    }
    
    // If this is a print and open test, send a print and open command
    if (action === 'print-and-open') {
      const printAndOpenEndpoint = '/print-and-open';
      const printAndOpenResponse = await fetch(`${proxyUrl}${printAndOpenEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'test',
          data: {
            ip: printer.ipAddress,
            port: printer.port
          }
        })
      });
      
      const printAndOpenResult = await printAndOpenResponse.json();
      
      if (!printAndOpenResponse.ok) {
        console.error(`Error printing and opening drawer: ${printAndOpenResult.error || 'Unknown error'}`);
        return NextResponse.json({ 
          success: false, 
          error: printAndOpenResult.error || 'Failed to print and open drawer',
          printer: {
            id: printer.id,
            name: printer.name,
            ipAddress: printer.ipAddress,
            port: printer.port
          }
        }, { status: printAndOpenResponse.status });
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
        message: printAndOpenResult.message || 'Test receipt printed and drawer opened successfully',
        printer: {
          id: printer.id,
          name: printer.name,
          ipAddress: printer.ipAddress,
          port: printer.port,
          connected: true
        }
      });
    }
    
    // If we get here, it means the action is not supported
    return NextResponse.json({ 
      success: false, 
      error: `Unsupported action: ${action}`,
      printer: {
        id: printer.id,
        name: printer.name,
        ipAddress: printer.ipAddress,
        port: printer.port
      }
    }, { status: 400 });
  } catch (error: any) {
    console.error('Error testing printer:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to test printer' 
    }, { status: 500 });
  }
}
