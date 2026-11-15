import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDB, mutate, audit } from '@/lib/store';
import { createSessionToken, sessionCookie, toPublic } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * One-click sign-in to the shared read-only demo account (configured with
 * DEMO_EMAIL / DEMO_PASSWORD). GET says whether a demo account exists, so the
 * sign-in page can offer it; POST signs in as that account. The account has the
 * viewer role: it can open every result but cannot upload, change or delete.
 */
async function demoUser() {
  // removing DEMO_EMAIL from the environment switches the one-click demo off
  const email = (process.env.DEMO_EMAIL || '').trim().toLowerCase();
  if (!email) return null;
  const db = await getDB();
  return Object.values(db.users).find((u) => u.email === email && u.demo && u.active && u.role === 'viewer') ?? null;
}

export async function GET() {
  return NextResponse.json({ available: !!(await demoUser()) });
}

export async function POST(req: NextRequest) {
  const user = await demoUser();
  if (!user) return NextResponse.json({ ok: false, error: 'There is no demo account on this server.' }, { status: 404 });
  const fresh = await mutate((d) => {
    const u = d.users[user.id];
    u.lastLoginAt = new Date().toISOString();
    audit(d, u, 'auth.login', u.email, 'Read-only demo');
    return u;
  });
  const { token, maxAge } = await createSessionToken(user.id);
  const res = NextResponse.json({ ok: true, user: toPublic(fresh) });
  const https = req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
  res.cookies.set(sessionCookie(token, maxAge, https));
  return res;
}
