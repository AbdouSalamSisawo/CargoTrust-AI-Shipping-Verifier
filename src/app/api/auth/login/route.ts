import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/** Demo auth: any non-empty credentials sign in (hackathon build). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const user = typeof body.user === 'string' ? body.user.trim() : '';
  const pass = typeof body.pass === 'string' ? body.pass : '';
  if (!user || !pass) {
    return NextResponse.json({ ok: false, error: 'Username and password are required.' }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true, user });
  res.cookies.set('cargotrust_auth', 'demo-session', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
