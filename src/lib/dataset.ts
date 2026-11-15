import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type { EmailRecord } from './types';
import { readDocument, isScanMethod, type ReadResult } from './engine/readers';
import { transcribeScan, type AiConfig } from './engine/vision';
import { putFile, getFile, fileExists, deletePrefix } from './files';

/**
 * File access for the engine.
 *
 *   dataset/…            the bundled sample inbox (dataset/inbox/*.json + dataset/attachments/*)
 *   uploads/<id>/<file>  documents uploaded or imported by users (files.ts: data/ or private Blob)
 *
 * Every attachment — text, PDF (text layer or scanned → OCR), Word, Excel,
 * photo — goes through engine/readers.ts. Slow reads (OCR, AI vision) are
 * cached by content hash under cache/ in the same file storage.
 */
const DATASET_DIR = path.join(process.cwd(), 'dataset');
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

/** Absolute path of a bundled sample attachment, refusing anything that escapes the dataset folder. */
function datasetPath(relPath: string): string | null {
  const abs = path.resolve(DATASET_DIR, relPath);
  return abs.startsWith(DATASET_DIR + path.sep) ? abs : null;
}

const isUploadRef = (relPath: string) => relPath.startsWith('uploads/') && !relPath.split('/').includes('..');

/** Store an uploaded file; returns its attachment reference ("uploads/<id>/<name>"). */
export async function saveUpload(id: string, name: string, buf: Buffer): Promise<string> {
  const safe = name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/^\.+/, '').slice(0, 120) || 'document';
  let file = safe;
  for (let n = 2; await fileExists(`uploads/${id}/${file}`); n++) {
    file = safe.replace(/(\.[^.]*)?$/, (ext) => `-${n}${ext}`);
  }
  const ref = `uploads/${id}/${file}`;
  await putFile(ref, buf);
  return ref;
}

export async function deleteUploads(id: string): Promise<void> {
  if (!/^[\w.-]+$/.test(id)) return;
  await deletePrefix(`uploads/${id}/`);
}

async function cached<T>(key: string, make: () => Promise<T>, keep: (v: T) => boolean): Promise<T> {
  const ref = `cache/${key}.json`;
  const hit = await getFile(ref);
  if (hit) {
    try {
      return JSON.parse(hit.toString('utf8')) as T;
    } catch {
      /* corrupt entry: read again */
    }
  }
  const v = await make();
  if (keep(v)) {
    try {
      await putFile(ref, Buffer.from(JSON.stringify(v)), 'application/json');
    } catch {
      /* storage unavailable: skip caching */
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
  try {
    const buf = await attachmentBytes(relPath);
    if (!buf) throw new Error('not found');
    out = { ...(await readBuffer(relPath, buf, opts)), size: buf.length };
  } catch {
    out = { text: null, method: 'none', error: 'attachment file not found', size: 0 };
  }
  // keep failed AI reads out of the memory cache so a retry can succeed
  if (!(opts.ai && out.ai && out.ai.text == null)) readCache.set(key, out);
  return out;
}

/** Raw bytes of an attachment (for reading, download and preview). */
export async function attachmentBytes(relPath: string): Promise<Buffer | null> {
  if (relPath.startsWith('uploads/')) return isUploadRef(relPath) ? getFile(relPath) : null;
  const abs = datasetPath(relPath);
  if (!abs) return null;
  try {
    return await fs.readFile(abs);
  } catch {
    return null;
  }
}
