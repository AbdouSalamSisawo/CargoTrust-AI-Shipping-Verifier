import fs from 'fs/promises';
import path from 'path';
import type { EmailRecord } from './types';
import { extractTextFromBinary } from './engine/binary';

/**
 * Server-side access to the SDOC participant dataset that ships with this repo
 * (dataset/inbox/*.json + dataset/attachments/*). Mirrors loader.py semantics,
 * extended for the advanced stage: PDF (text layer), Excel and Word
 * attachments are parsed to text; image-only scans stay unreadable.
 */
const DATASET_DIR = path.join(process.cwd(), 'dataset');

let inboxCache: EmailRecord[] | null = null;
const textCache = new Map<string, { text: string | null; size: number }>();

const PARSEABLE = new Set(['pdf', 'xlsx', 'xls', 'docx']);

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

export async function readAttachment(relPath: string): Promise<{ text: string | null; size: number }> {
  const hit = textCache.get(relPath);
  if (hit) return hit;
  try {
    const buf = await fs.readFile(path.join(DATASET_DIR, relPath));
    const ext = (relPath.split('.').pop() || '').toLowerCase();
    let text: string | null = null;
    if (ext === 'txt') text = buf.toString('utf8');
    else if (PARSEABLE.has(ext)) text = await extractTextFromBinary(ext, buf);
    const out = { text, size: buf.length };
    textCache.set(relPath, out);
    return out;
  } catch {
    const out = { text: null, size: 0 };
    textCache.set(relPath, out);
    return out;
  }
}
