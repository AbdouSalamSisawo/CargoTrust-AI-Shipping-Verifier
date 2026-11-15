import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { guarded } from '@/lib/auth';
import { ingestEml, type EmlResult } from '@/lib/ingest';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_EML_BYTES = 40 * 1024 * 1024;

/** Import one or more .eml files (field name `files`). Each becomes an inbox item. */
export const POST = guarded('operator', async (user, req: NextRequest) => {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, error: 'Send the emails as multipart/form-data.' }, { status: 400 });
  const results: EmlResult[] = [];
  const entries = form.getAll('files').filter((f): f is File => typeof f !== 'string');
  if (!entries.length) return NextResponse.json({ ok: false, error: 'Choose at least one .eml file.' }, { status: 400 });
  for (const f of entries.slice(0, 50)) {
    if (!/\.eml$/i.test(f.name)) {
      results.push({ file: f.name, error: 'not an .eml file (save the email as .eml from your mail client)' });
      continue;
    }
    if (f.size > MAX_EML_BYTES) {
      results.push({ file: f.name, error: 'larger than 40 MB' });
      continue;
    }
    results.push(await ingestEml(f.name, Buffer.from(await f.arrayBuffer()), user));
  }
  return NextResponse.json({ ok: true, results });
});
