/**
 * Persistence: one JSON document (data/db.json) written through a serialized
 * write chain. Holds processed emails, review cases, users, the audit log and
 * settings. Every consumer goes through getDB() / mutate(), so the module can
 * be swapped for Postgres without touching routes or the engine.
 *
 * First boot creates an administrator account (credentials written to
 * data/admin-credentials.txt) and, unless disabled, loads the bundled sample
 * inbox so the console has data to show.
 */
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { loadInbox, readAttachment, DATA_DIR } from './dataset';
import { processEmail, detectAttachmentKinds } from './engine/pipeline';
import { buildReviewCase } from './engine/review';
import { DEFAULT_AI_MODEL, type AiConfig } from './engine/vision';
import { hashPassword, generatePassword } from './passwords';
import type { ReadResult } from './engine/readers';
import type { AuditEvent, DBShape, EmailRecord, ProcessedEmail, ReviewCase, Settings, User } from './types';

const DB_FILE = path.join(DATA_DIR, 'db.json');
const DB_VERSION = 3;
const AUDIT_CAP = 5000;

export const DEFAULT_SETTINGS: Settings = {
  autoApproveThreshold: 90,
  spamFilter: true,
  requireEvidence: true,
  notifyOnMismatch: true,
  notifyOnReview: true,
  digest: false,
  organisation: 'CargoTrust',
  aiEnabled: true,
  aiModel: DEFAULT_AI_MODEL,
  aiScanPolicy: 'confirm',
};

/* ------------------------------------------------------------------ AI cfg */

/** AI reading is on when enabled in Settings and a key exists (env first, then Settings). */
export function aiConfigFrom(settings: Settings): AiConfig | null {
  if (!settings.aiEnabled) return null;
  const apiKey = process.env.ANTHROPIC_API_KEY || settings.aiApiKey;
  if (!apiKey) return null;
  return { apiKey, model: process.env.CARGOTRUST_AI_MODEL || settings.aiModel || DEFAULT_AI_MODEL };
}

export function aiStatus(settings: Settings) {
  return {
    enabled: settings.aiEnabled,
    keySource: process.env.ANTHROPIC_API_KEY ? ('environment' as const) : settings.aiApiKey ? ('settings' as const) : null,
    keyHint: (process.env.ANTHROPIC_API_KEY || settings.aiApiKey || '').slice(-4) || null,
    model: process.env.CARGOTRUST_AI_MODEL || settings.aiModel || DEFAULT_AI_MODEL,
    modelFromEnv: !!process.env.CARGOTRUST_AI_MODEL,
    active: !!aiConfigFrom(settings),
    policy: settings.aiScanPolicy,
  };
}

/* -------------------------------------------------------------- processing */

/** Read every attachment and run the pipeline (no persistence). */
export async function runPipeline(rec: EmailRecord, settings: Settings): Promise<ProcessedEmail> {
  const ai = aiConfigFrom(settings);
  const reads: Record<string, ReadResult & { size: number }> = {};
  for (const p of rec.attachments) reads[p] = await readAttachment(p, { ai });
  const hints = { ...detectAttachmentKinds(rec.attachments, reads), ...(rec.attachmentKinds ?? {}) };
  const withHints: EmailRecord = Object.keys(hints).length ? { ...rec, attachmentKinds: hints } : rec;
  const out = processEmail(withHints, reads, { aiScanPolicy: settings.aiScanPolicy });
  for (const a of out.attachments) a.size = reads[a.path]?.size ?? a.size;
  return out;
}

export function recordOf(e: ProcessedEmail & { attachmentKinds?: Record<string, 'SI' | 'BL'> }): EmailRecord {
  const kinds: Record<string, 'SI' | 'BL'> = {};
  for (const a of e.attachments) if (a.kind !== 'other') kinds[a.path] = a.kind;
  return {
    email_id: e.id,
    from: e.from,
    subject: e.subject,
    body: e.body,
    attachments: e.attachments.map((a) => a.path),
    attachmentKinds: e.source === 'sample' ? undefined : kinds,
    receivedAt: e.receivedAt,
  };
}

/** Insert or replace an email and keep its review case in sync. */
export function upsertEmail(db: DBShape, fresh: ProcessedEmail) {
  const prev = db.emails[fresh.id];
  fresh.seq = prev?.seq ?? Math.max(0, ...Object.values(db.emails).map((e) => e.seq)) + 1;
  db.emails[fresh.id] = fresh;
  const open = Object.values(db.reviews).find((r) => r.emailId === fresh.id && r.status === 'open');
  if (fresh.status === 'NEEDS_REVIEW') {
    const rc = buildReviewCase(fresh);
    if (open) Object.assign(open, { ...rc, id: open.id });
    else db.reviews[rc.id] = rc;
  } else if (open) {
    open.status = 'resolved';
    open.resolution = { action: 'approve', note: 'Auto-closed: re-processing produced a decision.' };
  }
}

/* ------------------------------------------------------------------- audit */

export function audit(db: DBShape, user: Pick<User, 'id' | 'name'> | null, action: string, target?: string, detail?: string) {
  const ev: AuditEvent = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    userId: user?.id ?? null,
    userName: user?.name ?? 'System',
    action,
    target,
    detail,
  };
  db.audit.unshift(ev);
  if (db.audit.length > AUDIT_CAP) db.audit.length = AUDIT_CAP;
}

/* -------------------------------------------------------------- bootstrap */

async function sampleEmails(settings: Settings): Promise<{ emails: Record<string, ProcessedEmail>; reviews: Record<string, ReviewCase> }> {
  const inbox = await loadInbox();
  const emails: Record<string, ProcessedEmail> = {};
  const reviews: Record<string, ReviewCase> = {};
  let seq = 0;
  for (const rec of inbox) {
    const processed = await runPipeline(rec, settings);
    processed.seq = ++seq;
    processed.source = 'sample';
    emails[processed.id] = processed;
    if (processed.status === 'NEEDS_REVIEW') {
      const rc = buildReviewCase(processed);
      reviews[rc.id] = rc;
    }
  }
  return { emails, reviews };
}

function seedAdmin(db: DBShape) {
  if (Object.keys(db.users).length) return;
  const email = (process.env.ADMIN_EMAIL || 'admin@cargotrust.local').toLowerCase();
  const fromEnv = !!process.env.ADMIN_PASSWORD;
  const password = process.env.ADMIN_PASSWORD || generatePassword();
  const id = crypto.randomUUID();
  db.users[id] = {
    id,
    name: process.env.ADMIN_NAME || 'Administrator',
    email,
    role: 'admin',
    passwordHash: hashPassword(password),
    active: true,
    mustChangePassword: !fromEnv,
    createdAt: new Date().toISOString(),
  };
  audit(db, null, 'user.created', email, 'First administrator account created on first boot');
  if (!fromEnv) {
    const note = `CargoTrust first-run administrator\n\nEmail:    ${email}\nPassword: ${password}\n\nSign in and change this password under Settings → Account.\nDelete this file afterwards.\n`;
    try {
      fsSync.mkdirSync(DATA_DIR, { recursive: true });
      fsSync.writeFileSync(path.join(DATA_DIR, 'admin-credentials.txt'), note, { mode: 0o600 });
    } catch {
      /* read-only filesystem */
    }
    console.log(`\n[cargotrust] ${note.replace(/\n+/g, ' | ')}\n`);
  }
}

/** Bring a db.json written by an older version up to the current shape. */
function migrate(raw: Partial<DBShape>): DBShape {
  const db: DBShape = {
    version: DB_VERSION,
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) },
    emails: raw.emails ?? {},
    reviews: raw.reviews ?? {},
    evalRuns: raw.evalRuns ?? [],
    users: raw.users ?? {},
    audit: raw.audit ?? [],
    sampleData: raw.sampleData ?? true,
  };
  delete db.settings.sdocServerUrl;
  // v3: the default AI model moved from Opus to Haiku; installs still on the old default follow it
  if ((raw.version ?? 0) < 3 && db.settings.aiModel === 'claude-opus-5-5') db.settings.aiModel = DEFAULT_AI_MODEL;
  for (const e of Object.values(db.emails)) e.source ??= 'sample';
  seedAdmin(db);
  return db;
}

let dbPromise: Promise<DBShape> | null = null;

async function writeDB(db: DBShape) {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
  const tmp = `${DB_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db));
  await fs.rename(tmp, DB_FILE); // atomic replace: a crash never leaves a half-written file
}

export async function getDB(): Promise<DBShape> {
  if (!dbPromise) {
    dbPromise = (async () => {
      let raw: Partial<DBShape> | null = null;
      try {
        raw = JSON.parse(await fs.readFile(DB_FILE, 'utf8')) as Partial<DBShape>;
      } catch {
        raw = null;
      }
      if (raw) {
        const db = migrate(raw);
        if (raw.version !== DB_VERSION) await writeDB(db);
        return db;
      }
      const db = migrate({ sampleData: process.env.SAMPLE_DATA !== '0' });
      if (db.sampleData) Object.assign(db, await sampleEmails(db.settings));
      await writeDB(db);
      return db;
    })();
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

/* serialized write chain — avoids interleaved fs writes */
let chain: Promise<unknown> = Promise.resolve();

export async function mutate<T>(fn: (db: DBShape) => Promise<T> | T): Promise<T> {
  await getDB();
  const run = async (): Promise<T> => {
    const db = await getDB();
    const out = await fn(db);
    await writeDB(db);
    return out;
  };
  const p = chain.then(run, run);
  chain = p.catch(() => undefined);
  return p;
}

/* ---------------------------------------------------------- workspace ops */

/** Remove the sample inbox (uploads and imported email stay). */
export function removeSampleData(db: DBShape) {
  for (const [id, e] of Object.entries(db.emails)) if (e.source === 'sample') delete db.emails[id];
  for (const [id, r] of Object.entries(db.reviews)) if (!db.emails[r.emailId]) delete db.reviews[id];
  db.evalRuns = [];
  db.sampleData = false;
}

/** (Re)load the sample inbox from scratch. */
export async function loadSampleData(db: DBShape) {
  removeSampleData(db);
  const { emails, reviews } = await sampleEmails(db.settings);
  const offset = Math.max(0, ...Object.values(db.emails).map((e) => e.seq));
  for (const e of Object.values(emails)) {
    e.seq += offset;
    db.emails[e.id] = e;
  }
  Object.assign(db.reviews, reviews);
  db.sampleData = true;
}

/** New id for uploaded / imported items: CT-YYMMDD-XXXX. */
export function newCaseId(db: DBShape): string {
  const d = new Date();
  const stamp = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  for (;;) {
    const id = `CT-${stamp}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    if (!db.emails[id]) return id;
  }
}
