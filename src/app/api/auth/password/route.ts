import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { guarded, verifyPassword, hashPassword, passwordProblem } from '@/lib/auth';
import { mutate, audit } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** Change your own password. */
export const POST = guarded('viewer', async (user, req: NextRequest) => {
  if (user.demo) return NextResponse.json({ ok: false, error: 'The demo account is shared, so its password cannot be changed.' }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { current?: string; next?: string };
  if (!body.current || !verifyPassword(body.current, user.passwordHash)) {
    return NextResponse.json({ ok: false, error: 'Your current password is incorrect.' }, { status: 400 });
  }
  const next = body.next ?? '';
  const problem = passwordProblem(next);
  if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 400 });
  if (next === body.current) return NextResponse.json({ ok: false, error: 'Choose a password you have not used here.' }, { status: 400 });
  await mutate((db) => {
    const u = db.users[user.id];
    u.passwordHash = hashPassword(next);
    u.mustChangePassword = false;
    audit(db, u, 'user.password_changed', u.email);
  });
  return NextResponse.json({ ok: true });
});
