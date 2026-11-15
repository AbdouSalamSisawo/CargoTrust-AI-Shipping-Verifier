/**
 * JSON-file persistence (data/db.json). The dataset is processed once by the
 * engine on first boot; reviewer decisions, evaluation runs and settings are
 * persisted on top of it. Swap this module for Prisma/Postgres in production —
 * every consumer goes through getDB()/mutate().
 */
import fs from 'fs/promises';
import path from 'path';
import { loadInbox, readAttachment } from './dataset';
import { processEmail } from './engine/pipeline';
import { buildReviewCase } from './engine/review';
import type { DBShape, ProcessedEmail, ReviewCase, Settings } from './types';

const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

export const DEFAULT_SETTINGS: Settings = {
  autoApproveThreshold: 90,
  spamFilter: true,
  requireEvidence: true,
  notifyOnMismatch: true,
  notifyOnReview: true,
  digest: false,
  sdocServerUrl: 'http://localhost:8080',
};

let dbPromise: Promise<DBShape> | null = null;

async function buildFromDataset(): Promise<DBShape> {
  const inbox = await loadInbox();
  const emails: Record<string, ProcessedEmail> = {};
  const reviews: Record<string, ReviewCase> = {};
  let seq = 0;
  for (const rec of inbox) {
    const texts: Record<string, string | null> = {};
    for (const p of rec.attachments) texts[p] = (await readAttachment(p)).text;
    const processed = processEmail(rec, texts);
    processed.seq = ++seq;
    emails[processed.id] = processed;
    if (processed.status === 'NEEDS_REVIEW') {
      const rc = buildReviewCase(processed);
      reviews[rc.id] = rc;
    }
  }
  return { version: 1, settings: { ...DEFAULT_SETTINGS }, emails, reviews, evalRuns: [] };
}

export async function getDB(): Promise<DBShape> {
  if (!dbPromise) {
    dbPromise = (async () => {
      try {
        const raw = await fs.readFile(DB_FILE, 'utf8');
        return JSON.parse(raw) as DBShape;
      } catch {
        const db = await buildFromDataset();
        await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
        await fs.writeFile(DB_FILE, JSON.stringify(db));
        return db;
      }
    })();
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
    await fs.writeFile(DB_FILE, JSON.stringify(db));
    return out;
  };
  const p = chain.then(run, run);
  chain = p.catch(() => undefined);
  return p;
}

export async function resetDB(): Promise<void> {
  dbPromise = buildFromDataset();
  const db = await dbPromise;
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db));
}
