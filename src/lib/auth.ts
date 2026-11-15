/**
 * Accounts and sessions.
 *
 * - Passwords: scrypt with a per-user random salt, compared in constant time.
 * - Sessions: an HMAC-SHA256 signed cookie (`ct_session`) carrying the user id
 *   and expiry. The signing key is AUTH_SECRET from the environment; without
 *   it, a random key generated on first boot and kept in data/.auth-secret
 *   (file storage) or in the database (Postgres, shared by every instance).
 * - Sign-in throttling counts recent failed attempts in the audit log, so it
 *   holds across restarts and server instances.
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
import type { DBShape, PublicUser, Role, User } from './types';
import { getDB, storageBackend } from './store';

export const SESSION_COOKIE = 'ct_session';
const SESSION_DAYS = 7;
const RANK: Record<Role, number> = { viewer: 0, operator: 1, admin: 2 };

/* ------------------------------------------------------------------ secret */

let secret: Buffer | null = null;
async function signingKey(): Promise<Buffer> {
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16) return Buffer.from(process.env.AUTH_SECRET, 'utf8');
  if (storageBackend() === 'postgres') {
    const key = (await getDB()).settings.authSecret;
    if (!key) throw new Error('session key missing from the database');
    return Buffer.from(key, 'hex');
  }
  if (secret) return secret;
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

export async function createSessionToken(userId: string): Promise<{ token: string; maxAge: number }> {
  const maxAge = SESSION_DAYS * 24 * 3600;
  const payload = b64url(Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + maxAge * 1000 })));
  const sig = b64url(crypto.createHmac('sha256', await signingKey()).update(payload).digest());
  return { token: `${payload}.${sig}`, maxAge };
}

async function readSessionToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const want = b64url(crypto.createHmac('sha256', await signingKey()).update(payload).digest());
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
  const uid = await readSessionToken(cookies().get(SESSION_COOKIE)?.value);
  if (!uid) return null;
  const db = await getDB();
  const u = db.users[uid];
  if (!u || !u.active) return null;
  // the shared demo account is read-only whatever role it has been given
  return u.demo && u.role !== 'viewer' ? { ...u, role: 'viewer' } : u;
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

const LOCK_AFTER = 5;
const WINDOW_MS = 15 * 60_000;

/**
 * Seconds to wait before another attempt for this email from this address,
 * or 0. Counts `auth.failed` events in the last 15 minutes since the last
 * successful sign-in, so the limit survives restarts and holds across instances.
 */
export function loginBlocked(db: DBShape, email: string, ip: string): number {
  const since = Date.now() - WINDOW_MS;
  const from = `Failed sign-in from ${ip}`;
  let n = 0;
  let newest = 0;
  for (const ev of db.audit) {
    const t = Date.parse(ev.at);
    if (t < since) break; // newest first
    if (ev.target !== email) continue;
    if (ev.action === 'auth.login') break;
    if (ev.action === 'auth.failed' && ev.detail === from) {
      n++;
      newest ||= t;
    }
  }
  return n >= LOCK_AFTER ? Math.max(1, Math.ceil((newest + WINDOW_MS - Date.now()) / 1000)) : 0;
}
