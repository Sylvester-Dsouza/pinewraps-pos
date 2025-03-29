import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define public routes that don't require authentication
const publicRoutes = ['/login', '/reset-password'];
// Define protected routes that require authentication
const protectedRoutes = ['/pos', '/orders', '/kitchen', '/drawer'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for Firebase ID token in cookies
  const token = request.cookies.get('firebase-token')?.value;

  // Handle root path specifically
  if (pathname === '/') {
    if (token) {
      return NextResponse.redirect(new URL('/pos', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Skip middleware for static files and API routes
  if (pathname.startsWith('/_next') || 
      pathname.startsWith('/api') || 
      pathname.includes('favicon.ico')) {
    return NextResponse.next();
  }

  // If on a public route and have token, redirect to POS
  if (publicRoutes.includes(pathname) && token) {
    return NextResponse.redirect(new URL('/pos', request.url));
  }

  // If no token and on a protected route, redirect to login
  if (!token && protectedRoutes.some(route => pathname.startsWith(route))) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Configure paths that require middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
