import { NextResponse } from 'next/server';

// Teruskan pathname ke layout via request header agar script iklan
// bisa dimatikan total di /admin (server-side, sebelum render).
export function middleware(req) {
  const headers = new Headers(req.headers);
  headers.set('x-pathname', req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}
