/**
 * Durable file storage for uploaded documents and cached reads.
 *
 *   disk  data/<key> on the server (default: laptop, Docker volume)
 *   blob  a private Vercel Blob store, used when BLOB_READ_WRITE_TOKEN or
 *         BLOB_STORE_ID is set (serverless hosting, where local disk is temporary)
 *
 * Keys look like "uploads/<case id>/<file>" or "cache/<hash>.json". Blobs are
 * always private: documents are served only through the signed-in
 * /api/emails/[id]/source route, never by public URL.
 */
import fs from 'fs/promises';
import path from 'path';

export const DATA_DIR = path.join(process.cwd(), 'data');

export const filesBackend = (): 'blob' | 'disk' =>
  process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID ? 'blob' : 'disk';

function diskPath(key: string): string | null {
  const abs = path.resolve(DATA_DIR, key);
  return abs.startsWith(DATA_DIR + path.sep) ? abs : null;
}

const blob = () => import('@vercel/blob');

export async function putFile(key: string, buf: Buffer, contentType?: string): Promise<void> {
  if (filesBackend() === 'blob') {
    const { put } = await blob();
    await put(key, buf, { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType });
    return;
  }
  const abs = diskPath(key);
  if (!abs) throw new Error('bad file key');
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buf);
}

export async function getFile(key: string): Promise<Buffer | null> {
  if (filesBackend() === 'blob') {
    const { get } = await blob();
    try {
      const r = await get(key, { access: 'private' });
      if (!r || r.statusCode !== 200) return null;
      return Buffer.from(await new Response(r.stream).arrayBuffer());
    } catch {
      return null;
    }
  }
  const abs = diskPath(key);
  if (!abs) return null;
  try {
    return await fs.readFile(abs);
  } catch {
    return null;
  }
}

export async function fileExists(key: string): Promise<boolean> {
  if (filesBackend() === 'blob') {
    const { head } = await blob();
    try {
      await head(key);
      return true;
    } catch {
      return false;
    }
  }
  const abs = diskPath(key);
  if (!abs) return false;
  try {
    await fs.access(abs);
    return true;
  } catch {
    return false;
  }
}

/** Delete every file under a folder-like prefix ("uploads/<id>/"). */
export async function deletePrefix(prefix: string): Promise<void> {
  if (!prefix.endsWith('/')) prefix += '/';
  if (filesBackend() === 'blob') {
    const { list, del } = await blob();
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      if (page.blobs.length) await del(page.blobs.map((b) => b.url));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return;
  }
  const abs = diskPath(prefix);
  if (abs) await fs.rm(abs, { recursive: true, force: true });
}
