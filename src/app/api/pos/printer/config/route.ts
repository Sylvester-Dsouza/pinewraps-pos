import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('DEPRECATED: API printer config endpoint should not be used. Client should fetch printer config directly');
    
    // Determine the proxy URL - try to use the one from environment variables
    const proxyUrl = process.env.PRINTER_PROXY_URL || 'http://localhost:3005';
    
    // Return a default printer config and a message about using the printer proxy directly
    return NextResponse.json({
      success: true,
      message: 'DEPRECATED: This endpoint is deprecated. Please update your code to use the printer proxy directly.',
      printer: {
        ipAddress: 'localhost',
        port: 9100,
        name: 'Default Printer (Fallback)',
        isDefault: true,
        isActive: true
      },
      proxyUrl: proxyUrl
    });
  } catch (error: any) {
    console.error('Error in printer config endpoint:', error.message);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: 'This endpoint is deprecated. Please update your code to use the printer proxy directly.'
    }, { status: 500 });
  }
}
