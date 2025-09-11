import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Handle Server Actions requests in Replit environment
  if (request.method === 'POST' && request.headers.get('next-action')) {
    const response = NextResponse.next()
    
    // Fix header mismatch issues in Replit
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
    if (host) {
      response.headers.set('x-forwarded-host', host)
    }
    
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}