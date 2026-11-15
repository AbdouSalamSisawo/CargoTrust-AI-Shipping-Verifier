import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { guarded, toPublic, hashPassword, generatePassword } from '@/lib/auth';
import { mutate, audit } from '@/lib/store';
import type { Role } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

/** Update name / role / active, or reset the password ({ resetPassword: true }). */
export const PATCH = guarded('admin', async (admin, req: NextRequest, { params }: Ctx) => {
  const body = (await req.json().catch(() => ({}))) as { name?: string; role?: Role; active?: boolean; resetPassword?: boolean };
  const out = await mutate((db) => {
    const u = db.users[params.id];
    if (!u) return { status: 404, error: 'User not found.' };
    const admins = Object.values(db.users).filter((x) => x.role === 'admin' && x.active);
    const losingAdmin =
      u.role === 'admin' && u.active && ((body.role && body.role !== 'admin') || body.active === false);
    if (losingAdmin && admins.length <= 1) return { status: 400, error: 'There must always be at least one active administrator.' };
    if (u.id === admin.id && body.active === false) return { status: 400, error: 'You cannot deactivate your own account.' };

    const changes: string[] = [];
    if (typeof body.name === 'string' && body.name.trim() && body.name.trim() !== u.name) {
      u.name = body.name.trim();
      changes.push(`name → ${u.name}`);
    }
    if (body.role && ['admin', 'operator', 'viewer'].includes(body.role) && body.role !== u.role) {
      u.role = body.role;
      changes.push(`role → ${u.role}`);
    }
    if (typeof body.active === 'boolean' && body.active !== u.active) {
      u.active = body.active;
      changes.push(u.active ? 'reactivated' : 'deactivated');
    }
    let temporaryPassword: string | undefined;
    if (body.resetPassword) {
      temporaryPassword = generatePassword();
      u.passwordHash = hashPassword(temporaryPassword);
      u.mustChangePassword = true;
      changes.push('password reset');
    }
    if (changes.length) audit(db, admin, 'user.updated', u.email, changes.join(', '));
    return { user: toPublic(u), temporaryPassword };
  });
  if ('error' in out) return NextResponse.json({ ok: false, error: out.error }, { status: out.status });
  return NextResponse.json({ ok: true, ...out });
});
