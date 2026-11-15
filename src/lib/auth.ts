/**
 * Accounts and sessions.
 *
 * - Passwords: scrypt with a per-user random salt, compared in constant time.
 * - Sessions: an HMAC-SHA256 signed cookie (`ct_session`) carrying the user id
 *   and expiry. The signing key is AUTH_SECRET from the environment, or a
 *   random key generated on first boot and kept in data/.auth-secret.
 * - Every API route calls requireUser(); the role decides what it may do:
 *     viewer   read everything
 *     operator viewer + upload/import documents, resolve reviews, re-run checks
 *     admin    operator + users, settings, workspace data
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { PublicUser, Role, User } from './types';
import { getDB } from './store';

export const SESSION_COOKIE = 'ct_session';
const SESSION_DAYS = 7;
const RANK: Record<Role, number> = { viewer: 0, operator: 1, admin: 2 };

/* ------------------------------------------------------------------ secret */

let secret: Buffer | null = null;
function signingKey(): Buffer {
  if (secret) return secret;
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16) {
    secret = Buffer.from(process.env.AUTH_SECRET, 'utf8');
    return secret;
  }
  const file = path.join(process.cwd(), 'data', '.auth-secret');
  try {
    secret = Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'hex');
    if (secret.length >= 32) return secret;
  } catch {
    /* first boot */
  }
  secret = crypto.randomBytes(32);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, secret.toString('hex'), { mode: 0o600 });
  } catch {
    /* read-only filesystem: sessions last until restart */
  }
  return secret;
}

export { hashPassword, verifyPassword, passwordProblem, generatePassword } from './passwords';

/* ---------------------------------------------------------------- sessions */

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function createSessionToken(userId: string): { token: string; maxAge: number } {
  const maxAge = SESSION_DAYS * 24 * 3600;
  const payload = b64url(Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + maxAge * 1000 })));
  const sig = b64url(crypto.createHmac('sha256', signingKey()).update(payload).digest());
  return { token: `${payload}.${sig}`, maxAge };
}

function readSessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const want = b64url(crypto.createHmac('sha256', signingKey()).update(payload).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (typeof uid !== 'string' || typeof exp !== 'number' || exp < Date.now()) return null;
    return uid;
  } catch {
    return null;
  }
}

/**
 * `secure` follows the request: HTTPS (directly or behind a TLS proxy) gets a
 * Secure cookie; plain HTTP on a LAN (e.g. http://192.168.1.20:3000 for a demo)
 * still works, because browsers drop Secure cookies on non-local HTTP.
 */
export function sessionCookie(token: string, maxAge: number, secure: boolean) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge,
  };
}

export function toPublic(u: User): PublicUser {
  const { passwordHash: _ignored, ...rest } = u;
  void _ignored;
  return rest;
}

/** The signed-in user, or null. */
export async function currentUser(): Promise<User | null> {
  const uid = readSessionToken(cookies().get(SESSION_COOKIE)?.value);
  if (!uid) return null;
  const db = await getDB();
  const u = db.users[uid];
  return u && u.active ? u : null;
}

export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
  }
}

/** Throws AuthError unless a signed-in user with at least `role` is present. */
export async function requireUser(role: Role = 'viewer'): Promise<User> {
  const u = await currentUser();
  if (!u) throw new AuthError(401, 'Please sign in.');
  if (RANK[u.role] < RANK[role]) throw new AuthError(403, `This action needs the ${role} role.`);
  return u;
}

/** Wrap a route handler: converts AuthError into a 401/403 JSON response. */
export function guarded<A extends unknown[]>(
  role: Role,
  handler: (user: User, ...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      const user = await requireUser(role);
      return await handler(user, ...args);
    } catch (e) {
      if (e instanceof AuthError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
      throw e;
    }
  };
}

/* ------------------------------------------------------- login rate limit */

const attempts = new Map<string, { n: number; until: number }>();

/** Returns seconds to wait, or 0 when another attempt is allowed. */
export function loginBlocked(key: string): number {
  const a = attempts.get(key);
  if (!a || a.until < Date.now()) return 0;
  return a.n >= 5 ? Math.ceil((a.until - Date.now()) / 1000) : 0;
}

export function loginFailed(key: string) {
  const a = attempts.get(key);
  const now = Date.now();
  if (!a || a.until < now) attempts.set(key, { n: 1, until: now + 15 * 60_000 });
  else a.n++;
}

export function loginSucceeded(key: string) {
  attempts.delete(key);
}
