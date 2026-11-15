/**
 * One-time move of a local workspace (data/db.json, data/uploads, data/cache)
 * into Postgres and/or a private Vercel Blob store, e.g. before the first
 * deploy to Vercel. Reads DATABASE_URL and BLOB_READ_WRITE_TOKEN from the
 * environment or .env.vercel (from `vercel env pull .env.vercel`).
 *
 *   npm run data:push                 database and files
 *   npm run data:push -- --overwrite  replace a workspace already in the database
 */
import fs from 'fs/promises';
import path from 'path';
import { migrate } from '@/lib/store';
import { databaseUrl, pgReplace, pgClose } from '@/lib/pgstore';
import { DATA_DIR, filesBackend, putFile } from '@/lib/files';
import type { DBShape } from '@/lib/types';

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries: import('fs').Dirent[] = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

async function main() {
  const overwrite = process.argv.includes('--overwrite');
  if (!databaseUrl() && filesBackend() !== 'blob') {
    console.error('Set DATABASE_URL and/or BLOB_READ_WRITE_TOKEN (in the environment or .env.vercel) first.');
    process.exit(1);
  }

  if (databaseUrl()) {
    const raw = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'db.json'), 'utf8')) as Partial<DBShape>;
    const db = migrate(raw);
    const { replaced } = await pgReplace(db, overwrite);
    console.log(`Database: ${replaced ? 'replaced' : 'created'} with ${Object.keys(db.emails).length} items, ${Object.keys(db.users).length} user(s), ${db.audit.length} activity events.`);
    await pgClose();
  } else {
    console.log('Database: DATABASE_URL not set, skipped.');
  }

  if (filesBackend() === 'blob') {
    let n = 0;
    for (const sub of ['uploads', 'cache']) {
      for (const file of await walk(path.join(DATA_DIR, sub))) {
        const key = path.relative(DATA_DIR, file).split(path.sep).join('/');
        await putFile(key, await fs.readFile(file));
        n++;
      }
    }
    console.log(`Files: ${n} uploaded to the private Blob store.`);
  } else {
    console.log('Files: BLOB_READ_WRITE_TOKEN not set, skipped.');
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
