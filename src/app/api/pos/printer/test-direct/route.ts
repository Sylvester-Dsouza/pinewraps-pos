import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase';

/**
 * POST /api/pos/printer/test-direct
 * Test a printer connection with a specific IP address and port
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    
    // Validate required fields
    if (!data.ipAddress) {
      return NextResponse.json({ error: 'IP address is required' }, { status: 400 });
    }

    const ipAddress = data.ipAddress;
    const port = data.port || '9100';
    
    // Determine the proxy URL - try to use the one from environment variables
    const proxyUrl = process.env.PRINTER_PROXY_URL || 'http://localhost:3005';
    
    console.log(`Testing printer connection at ${ipAddress}:${port} via proxy at ${proxyUrl}`);
    
    // First, check if the printer is reachable
    const checkEndpoint = '/api/printer/status';
    const checkResponse = await fetch(`${proxyUrl}${checkEndpoint}?ip=${encodeURIComponent(ipAddress)}&port=${parseInt(port, 10)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const checkResult = await checkResponse.json();
    
    // If the printer is not reachable, return an error
    if (!checkResponse.ok || !checkResult.connected) {
      console.error(`Printer at ${ipAddress}:${port} is not reachable: ${checkResult.message || 'Unknown error'}`);
      return NextResponse.json({ 
        success: false, 
        error: checkResult.message || 'Printer is not reachable' 
      }, { status: checkResponse.ok ? 200 : 500 });
    }
    
    // If this is a print test, send a print command
    if (data.action === 'print') {
      const printEndpoint = '/test-print';
      const printResponse = await fetch(`${proxyUrl}${printEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ip: ipAddress,
          port: parseInt(port, 10),
          skipConnectivityCheck: true
        })
      });
      
      const printResult = await printResponse.json();
      
      if (!printResponse.ok) {
        console.error(`Error printing test receipt: ${printResult.error || 'Unknown error'}`);
        return NextResponse.json({ 
          success: false, 
          error: printResult.error || 'Failed to print test receipt' 
        }, { status: printResponse.status });
      }
      
      return NextResponse.json({ 
        success: true, 
        message: printResult.message || 'Test receipt printed successfully' 
      });
    }
    
    // If this is a print and open test, send a print and open command
    if (data.action === 'print-and-open') {
      const printAndOpenEndpoint = '/print-and-open-test';
      const printAndOpenResponse = await fetch(`${proxyUrl}${printAndOpenEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          printerIp: ipAddress,
          printerPort: parseInt(port, 10),
          skipConnectivityCheck: true
        })
      });
      
      const printAndOpenResult = await printAndOpenResponse.json();
      
      if (!printAndOpenResponse.ok) {
        console.error(`Error printing and opening drawer: ${printAndOpenResult.error || 'Unknown error'}`);
        return NextResponse.json({ 
          success: false, 
          error: printAndOpenResult.error || 'Failed to print and open drawer' 
        }, { status: printAndOpenResponse.status });
      }
      
      return NextResponse.json({ 
        success: true, 
        message: printAndOpenResult.message || 'Test receipt printed and drawer opened successfully' 
      });
    }
    
    // If we get here, it means the printer is reachable but no action was specified
    return NextResponse.json({ 
      success: true, 
      message: `Printer at ${ipAddress}:${port} is reachable` 
    });
  } catch (error: any) {
    console.error('Error testing printer connection:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to test printer connection' 
    }, { status: 500 });
  }
}
