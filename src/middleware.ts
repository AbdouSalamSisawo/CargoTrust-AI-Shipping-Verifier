import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * First line of defence: no session cookie → no console page, no API.
 * The cookie's signature, expiry and the user's role are verified on the
 * server by requireUser() in every route and by the console layout.
 */
const PUBLIC_API = ['/api/auth/login', '/api/health'];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC_API.some((p) => pathname === p)) return NextResponse.next();
  if (req.cookies.get('ct_session')?.value) return NextResponse.next();
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/api/:path*', '/dashboard/:path*', '/emails/:path*', '/reviews/:path*', '/new/:path*', '/activity/:path*', '/evaluation/:path*', '/settings/:path*'],
};
