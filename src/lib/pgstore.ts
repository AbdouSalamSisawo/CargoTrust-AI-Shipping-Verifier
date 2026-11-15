/**
 * Postgres persistence for the store (used when DATABASE_URL is set).
 *
 * Records keep their JSON shape: one row per email, review case, user and
 * audit event in `ct_rows`, plus one `ct_meta` row for settings, evaluation
 * runs and a revision counter. A server instance keeps the whole workspace in
 * memory and only reloads when another instance has bumped the revision, so
 * reads cost one small query. Writes run in a transaction that locks the meta
 * row, apply the change, and write back only the records that changed.
 */
import { Pool, type PoolClient } from 'pg';
import type { DBShape } from './types';

type Kind = 'email' | 'review' | 'user' | 'audit';
const KINDS: { kind: Kind; key: 'emails' | 'reviews' | 'users' }[] = [
  { kind: 'email', key: 'emails' },
  { kind: 'review', key: 'reviews' },
  { kind: 'user', key: 'users' },
];

export const databaseUrl = () => process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function getPool(): Pool {
  if (pool) return pool;
  // TLS with certificate verification for remote databases. "require" is upgraded to the
  // equivalent "verify-full" explicitly (pg already treats it so, and warns otherwise);
  // a server with a self-signed certificate can use sslmode=no-verify in its URL.
  const url = databaseUrl().replace(/sslmode=(require|prefer|verify-ca)\b/, 'sslmode=verify-full');
  const local = /@(localhost|127\.0\.0\.1|db|postgres)(:\d+)?\//.test(url);
  const ssl = /sslmode=/.test(url) || local ? undefined : true;
  pool = new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 10_000, ssl });
  // On Vercel, close idle connections before the instance is suspended.
  if (process.env.VERCEL) {
    void import('@vercel/functions')
      .then(({ attachDatabasePool }) => attachDatabasePool(pool!))
      .catch(() => undefined);
  }
  return pool;
}

async function ensureSchema(c: PoolClient) {
  schemaReady ??= (async () => {
    // concurrent CREATE TABLE IF NOT EXISTS from two instances can collide; serialize it
    await c.query('BEGIN');
    await c.query('SELECT pg_advisory_xact_lock(427002)');
    await c.query(`
      CREATE TABLE IF NOT EXISTS ct_meta (
        id          int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        rev         bigint NOT NULL,
        version     int NOT NULL,
        settings    jsonb NOT NULL,
        sample_data boolean NOT NULL,
        eval_runs   jsonb NOT NULL,
        updated_at  timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS ct_rows (
        kind text NOT NULL,
        id   text NOT NULL,
        data jsonb NOT NULL,
        PRIMARY KEY (kind, id)
      );`);
    await c.query('COMMIT');
  })().catch(async (e) => {
    await c.query('ROLLBACK').catch(() => undefined);
    schemaReady = null;
    throw e;
  });
  await schemaReady;
}

/** A loaded workspace plus the serialized form of each record, used to find what changed. */
export interface PgState {
  db: DBShape;
  rev: number;
  snap: Map<string, string>;
  meta: string;
}

/** Key-order-independent JSON (jsonb does not keep key order), so a reload is not mistaken for a change. */
const stable = (v: unknown): string =>
  JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
const metaJson = (db: DBShape) => stable([db.version, db.settings, db.sampleData, db.evalRuns]);

function snapshot(db: DBShape): Map<string, string> {
  const snap = new Map<string, string>();
  for (const { kind, key } of KINDS) for (const [id, v] of Object.entries(db[key])) snap.set(`${kind}:${id}`, JSON.stringify(v));
  for (const ev of db.audit) snap.set(`audit:${ev.id}`, JSON.stringify(ev));
  return snap;
}

async function loadAll(c: PoolClient): Promise<{ raw: Partial<DBShape>; rev: number } | null> {
  const m = await c.query('SELECT rev, version, settings, sample_data, eval_runs FROM ct_meta WHERE id = 1');
  if (!m.rows.length) return null;
  const meta = m.rows[0];
  const raw: Partial<DBShape> = {
    version: meta.version,
    settings: meta.settings,
    sampleData: meta.sample_data,
    evalRuns: meta.eval_runs,
    emails: {},
    reviews: {},
    users: {},
    audit: [],
  };
  const rows = await c.query<{ kind: Kind; id: string; data: never }>('SELECT kind, id, data FROM ct_rows');
  for (const r of rows.rows) {
    if (r.kind === 'audit') raw.audit!.push(r.data);
    else raw[KINDS.find((k) => k.kind === r.kind)!.key]![r.id] = r.data;
  }
  raw.audit!.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return { raw, rev: Number(meta.rev) };
}

/** Write the records that differ from the snapshot, bump the revision, return the new state. */
async function persist(c: PoolClient, db: DBShape, prev: { snap: Map<string, string>; meta: string } | null, rev: number): Promise<PgState> {
  const snap = snapshot(db);
  const kinds: string[] = [];
  const ids: string[] = [];
  const data: string[] = [];
  for (const [k, json] of snap) {
    if (prev?.snap.get(k) === json) continue;
    const i = k.indexOf(':');
    kinds.push(k.slice(0, i));
    ids.push(k.slice(i + 1));
    data.push(json);
  }
  for (let i = 0; i < kinds.length; i += 200) {
    await c.query(
      `INSERT INTO ct_rows (kind, id, data)
       SELECT * FROM unnest($1::text[], $2::text[], $3::jsonb[])
       ON CONFLICT (kind, id) DO UPDATE SET data = EXCLUDED.data`,
      [kinds.slice(i, i + 200), ids.slice(i, i + 200), data.slice(i, i + 200)],
    );
  }
  if (prev) {
    const gone: Record<string, string[]> = {};
    for (const k of prev.snap.keys()) {
      if (snap.has(k)) continue;
      const i = k.indexOf(':');
      (gone[k.slice(0, i)] ??= []).push(k.slice(i + 1));
    }
    for (const [kind, list] of Object.entries(gone)) await c.query('DELETE FROM ct_rows WHERE kind = $1 AND id = ANY($2::text[])', [kind, list]);
  }
  const next = rev + 1;
  await c.query(
    `INSERT INTO ct_meta (id, rev, version, settings, sample_data, eval_runs, updated_at)
     VALUES (1, $1, $2, $3, $4, $5, now())
     ON CONFLICT (id) DO UPDATE SET rev = EXCLUDED.rev, version = EXCLUDED.version, settings = EXCLUDED.settings,
       sample_data = EXCLUDED.sample_data, eval_runs = EXCLUDED.eval_runs, updated_at = now()`,
    [next, db.version, JSON.stringify(db.settings), db.sampleData, JSON.stringify(db.evalRuns)],
  );
  return { db, rev: next, snap, meta: metaJson(db) };
}

async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await getPool().connect();
  try {
    await ensureSchema(c);
    await c.query('BEGIN');
    const out = await fn(c);
    await c.query('COMMIT');
    return out;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}

/**
 * Load the workspace. `upgrade` brings stored data to the current shape;
 * `create` builds a fresh workspace when the database is empty (first boot).
 */
export async function pgLoad(
  upgrade: (raw: Partial<DBShape>) => DBShape,
  create: () => Promise<DBShape>,
  currentVersion: number,
): Promise<PgState> {
  return tx(async (c) => {
    // one instance at a time creates or upgrades the workspace
    await c.query('SELECT pg_advisory_xact_lock(427001)');
    const got = await loadAll(c);
    if (!got) return persist(c, await create(), null, 0);
    const prev = { snap: snapshot(got.raw as DBShape), meta: '' };
    const metaBefore = metaJson(got.raw as DBShape);
    const db = upgrade(got.raw);
    const snap = snapshot(db);
    const changed = snap.size !== prev.snap.size || [...snap].some(([k, v]) => prev.snap.get(k) !== v);
    if (got.raw.version !== currentVersion || metaJson(db) !== metaBefore || changed) return persist(c, db, prev, got.rev);
    return { db, rev: got.rev, snap, meta: metaJson(db) };
  });
}

/**
 * Replace the stored workspace with `db` (one-time import from a data/db.json).
 * Refuses when a workspace already exists unless `overwrite` is set.
 */
export async function pgReplace(db: DBShape, overwrite: boolean): Promise<{ replaced: boolean }> {
  return tx(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock(427001)');
    const r = await c.query('SELECT rev FROM ct_meta WHERE id = 1 FOR UPDATE');
    if (r.rows.length && !overwrite) throw new Error('the database already holds a workspace (pass --overwrite to replace it)');
    await c.query('DELETE FROM ct_rows');
    await persist(c, db, null, r.rows.length ? Number(r.rows[0].rev) : 0);
    return { replaced: r.rows.length > 0 };
  });
}

/** Close the pool (scripts). */
export async function pgClose() {
  await pool?.end();
  pool = null;
}

/** The stored revision, or null when the workspace has not been created yet. */
export async function pgRevision(): Promise<number | null> {
  const c = await getPool().connect();
  try {
    await ensureSchema(c);
    const r = await c.query('SELECT rev FROM ct_meta WHERE id = 1');
    return r.rows.length ? Number(r.rows[0].rev) : null;
  } finally {
    c.release();
  }
}

/**
 * Apply `fn` to the latest workspace and save what changed. Holds a row lock
 * on ct_meta for the duration, so writers on different instances queue up.
 */
export async function pgMutate<T>(
  state: PgState,
  upgrade: (raw: Partial<DBShape>) => DBShape,
  fn: (db: DBShape) => Promise<T> | T,
): Promise<{ out: T; state: PgState }> {
  return tx(async (c) => {
    const r = await c.query('SELECT rev FROM ct_meta WHERE id = 1 FOR UPDATE');
    let cur = state;
    if (!r.rows.length || Number(r.rows[0].rev) !== state.rev) {
      const got = await loadAll(c);
      if (!got) throw new Error('workspace missing from the database');
      const db = upgrade(got.raw);
      cur = { db, rev: got.rev, snap: snapshot(got.raw as DBShape), meta: metaJson(got.raw as DBShape) };
    }
    const out = await fn(cur.db);
    const next = await persist(c, cur.db, cur, cur.rev);
    return { out, state: next };
  });
}
