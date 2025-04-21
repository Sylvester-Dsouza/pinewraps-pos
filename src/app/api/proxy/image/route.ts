import { NextRequest, NextResponse } from 'next/server';

/**
 * This API route acts as a proxy for images from Firebase Storage
 * It helps bypass CORS restrictions when loading images
 */
export async function GET(request: NextRequest) {
  try {
    // Get the URL from the query parameter
    const url = request.nextUrl.searchParams.get('url');
    
    if (!url) {
      return new NextResponse('Missing URL parameter', { status: 400 });
    }
    
    // Only allow proxying Firebase Storage URLs for security
    if (!url.includes('firebasestorage.googleapis.com')) {
      return new NextResponse('Only Firebase Storage URLs are supported', { status: 400 });
    }
    
    console.log(`Proxying image from: ${url}`);
    
    // Fetch the image from Firebase Storage
    const response = await fetch(url, {
      headers: {
        'Accept': 'image/*',
      },
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      return new NextResponse(`Failed to fetch image: ${response.status}`, { status: response.status });
    }
    
    // Get the image data and content type
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // Return the image with appropriate headers
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error proxying image:', error);
    return new NextResponse('Error proxying image', { status: 500 });
  }
}
