import { NextResponse } from 'next/server';
import { currentUser, SESSION_COOKIE } from '@/lib/auth';
import { mutate, audit } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function POST() {
  const u = await currentUser();
  if (u) await mutate((db) => audit(db, u, 'auth.logout', u.email));
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: SESSION_COOKIE, value: '', httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
