import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { mutate, getDB, audit } from '@/lib/store';
import { createSessionToken, sessionCookie, verifyPassword, toPublic, loginBlocked, loginFailed, loginSucceeded } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) {
    return NextResponse.json({ ok: false, error: 'Email and password are required.' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const key = `${ip}|${email}`;
  const wait = loginBlocked(key);
  if (wait) {
    return NextResponse.json({ ok: false, error: `Too many failed attempts. Try again in ${Math.ceil(wait / 60)} min.` }, { status: 429 });
  }

  const db = await getDB();
  const user = Object.values(db.users).find((u) => u.email === email);
  // verify even when the user is unknown, so timing does not reveal which emails exist
  const ok = verifyPassword(password, user?.passwordHash ?? 'scrypt$00$00') && !!user?.active;
  if (!ok || !user) {
    loginFailed(key);
    await mutate((d) => audit(d, null, 'auth.failed', email, `Failed sign-in from ${ip}`));
    return NextResponse.json({ ok: false, error: 'Incorrect email or password.' }, { status: 401 });
  }
  loginSucceeded(key);
  const fresh = await mutate((d) => {
    const u = d.users[user.id];
    u.lastLoginAt = new Date().toISOString();
    audit(d, u, 'auth.login', u.email);
    return u;
  });
  const { token, maxAge } = createSessionToken(user.id);
  const res = NextResponse.json({ ok: true, user: toPublic(fresh) });
  const https = req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
  res.cookies.set(sessionCookie(token, maxAge, https));
  return res;
}
