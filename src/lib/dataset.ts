import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type { EmailRecord } from './types';
import { readDocument, isScanMethod, type ReadResult } from './engine/readers';
import { transcribeScan, type AiConfig } from './engine/vision';

/**
 * File access for the engine.
 *
 *   dataset/…            the bundled sample inbox (dataset/inbox/*.json + dataset/attachments/*)
 *   uploads/<id>/<file>  documents uploaded or imported by users (stored in data/uploads/)
 *
 * Every attachment — text, PDF (text layer or scanned → OCR), Word, Excel,
 * photo — goes through engine/readers.ts. Slow reads (OCR, AI vision) are
 * cached on disk by content hash in data/cache/.
 */
const DATASET_DIR = path.join(process.cwd(), 'dataset');
export const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const CACHE_DIR = path.join(DATA_DIR, 'cache');
const READER_VERSION = 'r5';
const AI_VERSION = 'v1';

let inboxCache: EmailRecord[] | null = null;
const readCache = new Map<string, ReadResult & { size: number }>();

export async function loadInbox(): Promise<EmailRecord[]> {
  if (inboxCache) return inboxCache;
  const dir = path.join(DATASET_DIR, 'inbox');
  let files: string[] = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  } catch {
    return (inboxCache = []);
  }
  const records = await Promise.all(
    files.map(async (f) => JSON.parse(await fs.readFile(path.join(dir, f), 'utf8')) as EmailRecord),
  );
  inboxCache = records;
  return records;
}

/** Absolute path for an attachment reference, refusing anything that escapes its root. */
export function resolveAttachment(relPath: string): string | null {
  const isUpload = relPath.startsWith('uploads/');
  const root = isUpload ? UPLOAD_DIR : DATASET_DIR;
  const abs = path.resolve(root, isUpload ? relPath.slice('uploads/'.length) : relPath);
  return abs.startsWith(root + path.sep) ? abs : null;
}

/** Store an uploaded file; returns its attachment reference ("uploads/<id>/<name>"). */
export async function saveUpload(id: string, name: string, buf: Buffer): Promise<string> {
  const safe = name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/^\.+/, '').slice(0, 120) || 'document';
  const dir = path.join(UPLOAD_DIR, id);
  await fs.mkdir(dir, { recursive: true });
  let file = safe;
  for (let n = 2; ; n++) {
    try {
      await fs.access(path.join(dir, file));
      file = safe.replace(/(\.[^.]*)?$/, (ext) => `-${n}${ext}`);
    } catch {
      break;
    }
  }
  await fs.writeFile(path.join(dir, file), buf);
  return `uploads/${id}/${file}`;
}

export async function deleteUploads(id: string): Promise<void> {
  await fs.rm(path.join(UPLOAD_DIR, id), { recursive: true, force: true });
}

async function cached<T>(key: string, make: () => Promise<T>, keep: (v: T) => boolean): Promise<T> {
  const file = path.join(CACHE_DIR, `${key}.json`);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T;
  } catch {
    /* not cached */
  }
  const v = await make();
  if (keep(v)) {
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      await fs.writeFile(file, JSON.stringify(v));
    } catch {
      /* read-only filesystem: skip caching */
    }
  }
  return v;
}

/**
 * Read any attachment buffer. Scans and photos are OCR'd; when `ai` is given
 * they are also transcribed by the vision model (result attached as `.ai`).
 */
export async function readBuffer(name: string, buf: Buffer, opts: { ai?: AiConfig | null } = {}): Promise<ReadResult> {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const hash = crypto.createHash('sha1').update(buf).digest('hex');
  const base = await cached(
    `${READER_VERSION}-${hash}`,
    () => readDocument(ext, buf),
    (r) => isScanMethod(r.method),
  );
  if (!opts.ai || !isScanMethod(base.method)) return base;
  const ai = opts.ai;
  const t = await cached(
    `ai-${AI_VERSION}-${crypto.createHash('sha1').update(ai.model).update(buf).digest('hex')}`,
    () => transcribeScan(buf, ext, ai),
    (v) => v.text != null, // never cache failures (bad key, network)
  );
  return { ...base, ai: { text: t.text, model: ai.model, unclear: t.unclear, error: t.error } };
}

export async function readAttachment(relPath: string, opts: { ai?: AiConfig | null } = {}): Promise<ReadResult & { size: number }> {
  const key = `${relPath}::${opts.ai?.model ?? ''}`;
  const hit = readCache.get(key);
  if (hit) return hit;
  let out: ReadResult & { size: number };
  const abs = resolveAttachment(relPath);
  try {
    if (!abs) throw new Error('bad path');
    const buf = await fs.readFile(abs);
    out = { ...(await readBuffer(relPath, buf, opts)), size: buf.length };
  } catch {
    out = { text: null, method: 'none', error: 'attachment file not found', size: 0 };
  }
  // keep failed AI reads out of the memory cache so a retry can succeed
  if (!(opts.ai && out.ai && out.ai.text == null)) readCache.set(key, out);
  return out;
}

/** Raw bytes of an attachment (for download / preview). */
export async function attachmentBytes(relPath: string): Promise<Buffer | null> {
  const abs = resolveAttachment(relPath);
  if (!abs) return null;
  try {
    return await fs.readFile(abs);
  } catch {
    return null;
  }
}
