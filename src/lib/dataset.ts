import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type { EmailRecord } from './types';
import { readDocument, type ReadResult } from './engine/readers';

/**
 * Server-side access to the SDOC participant dataset that ships with this repo
 * (dataset/inbox/*.json + dataset/attachments/*). Mirrors loader.py semantics,
 * extended for the advanced stage: every attachment — text, PDF (text layer or
 * scanned → OCR), Word, Excel — goes through engine/readers.ts.
 *
 * Slow reads (OCR) are cached on disk by content hash in data/cache/.
 */
const DATASET_DIR = path.join(process.cwd(), 'dataset');
const CACHE_DIR = path.join(process.cwd(), 'data', 'cache');
const READER_VERSION = 'r3';

let inboxCache: EmailRecord[] | null = null;
const readCache = new Map<string, ReadResult & { size: number }>();

export async function loadInbox(): Promise<EmailRecord[]> {
  if (inboxCache) return inboxCache;
  const dir = path.join(DATASET_DIR, 'inbox');
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  const records = await Promise.all(
    files.map(async (f) => JSON.parse(await fs.readFile(path.join(dir, f), 'utf8')) as EmailRecord),
  );
  inboxCache = records;
  return records;
}

/** Read any attachment buffer, using the on-disk cache for expensive (OCR) reads. */
export async function readBuffer(name: string, buf: Buffer): Promise<ReadResult> {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const hash = crypto.createHash('sha1').update(READER_VERSION).update(buf).digest('hex');
  const cacheFile = path.join(CACHE_DIR, `${hash}.json`);
  try {
    return JSON.parse(await fs.readFile(cacheFile, 'utf8')) as ReadResult;
  } catch {
    /* not cached */
  }
  const res = await readDocument(ext, buf);
  if (res.method === 'pdf-ocr') {
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      await fs.writeFile(cacheFile, JSON.stringify(res));
    } catch {
      /* read-only filesystem: skip caching */
    }
  }
  return res;
}

export async function readAttachment(relPath: string): Promise<ReadResult & { size: number }> {
  const hit = readCache.get(relPath);
  if (hit) return hit;
  let out: ReadResult & { size: number };
  try {
    const buf = await fs.readFile(path.join(DATASET_DIR, relPath));
    out = { ...(await readBuffer(relPath, buf)), size: buf.length };
  } catch (e) {
    out = { text: null, method: 'none', error: 'attachment not found in the dataset', size: 0 };
    void e;
  }
  readCache.set(relPath, out);
  return out;
}
