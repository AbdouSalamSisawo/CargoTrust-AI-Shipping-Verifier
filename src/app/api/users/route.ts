import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import crypto from 'crypto';
import { guarded, toPublic, hashPassword, generatePassword, passwordProblem } from '@/lib/auth';
import { getDB, mutate, audit } from '@/lib/store';
import type { Role } from '@/lib/types';

export const dynamic = 'force-dynamic';

const ROLES: Role[] = ['admin', 'operator', 'viewer'];

export const GET = guarded('admin', async () => {
  const db = await getDB();
  const users = Object.values(db.users)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(toPublic);
  return NextResponse.json({ ok: true, users });
});

/** Create a user. Without a password, a temporary one is generated and returned once. */
export const POST = guarded('admin', async (admin, req: NextRequest) => {
  const body = (await req.json().catch(() => ({}))) as { name?: string; email?: string; role?: Role; password?: string };
  const name = body.name?.trim() ?? '';
  const email = body.email?.trim().toLowerCase() ?? '';
  const role = body.role ?? 'operator';
  if (!name) return NextResponse.json({ ok: false, error: 'Name is required.' }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ ok: false, error: 'Enter a valid email address.' }, { status: 400 });
  if (!ROLES.includes(role)) return NextResponse.json({ ok: false, error: 'Unknown role.' }, { status: 400 });
  const generated = !body.password;
  const password = body.password || generatePassword();
  if (!generated) {
    const p = passwordProblem(password);
    if (p) return NextResponse.json({ ok: false, error: p }, { status: 400 });
  }
  const out = await mutate((db) => {
    if (Object.values(db.users).some((u) => u.email === email)) return { error: 'A user with this email already exists.' };
    const id = crypto.randomUUID();
    db.users[id] = {
      id,
      name,
      email,
      role,
      passwordHash: hashPassword(password),
      active: true,
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
    };
    audit(db, admin, 'user.created', email, `Role: ${role}`);
    return { user: toPublic(db.users[id]) };
  });
  if ('error' in out) return NextResponse.json({ ok: false, error: out.error }, { status: 409 });
  return NextResponse.json({ ok: true, user: out.user, temporaryPassword: password });
});
