import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateSession, getRoleHomePath, isPathAllowedForRole } from '@/lib/auth-utils';

const PUBLIC_PATHS = ['/login', '/privacy', '/terms', '/open-data'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Eski open-webui / boshqa tizim URL larini login ga yo'naltirish
  if (pathname === '/error' || pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const token = request.cookies.get('token')?.value;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    if (token && pathname === '/login') {
      const session = await validateSession(token);
      if (session) {
        return NextResponse.redirect(new URL(getRoleHomePath(session.role), request.url));
      }
    }
    return NextResponse.next();
  }

  if (pathname === '/') return NextResponse.next();

  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/ut') ||
    pathname.startsWith('/admin');

  if (!token && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token && isProtected) {
    const session = await validateSession(token);
    if (!session) {
      const res = NextResponse.redirect(new URL('/login', request.url));
      res.cookies.delete('token');
      return res;
    }
    if (!isPathAllowedForRole(pathname, session.role)) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|favicon.svg|service-worker.js|api).*)'],
};
