import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { guarded } from '@/lib/auth';
import { ingestUpload, MAX_FILE_BYTES, DOC_EXTS, extOf } from '@/lib/ingest';
import { buildTrace } from '@/lib/engine/trace';
import { draftReply } from '@/lib/engine/reply';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * New check: multipart form with `si` and `bl` files (any supported format,
 * including photos), optional `reference`, `from`, `note`. The result is saved
 * as an inbox item and returned with its decision trace and drafted reply.
 */
export const POST = guarded('operator', async (user, req: NextRequest) => {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, error: 'Send the documents as multipart/form-data.' }, { status: 400 });
  const files: Record<'si' | 'bl', { name: string; buf: Buffer } | null> = { si: null, bl: null };
  for (const side of ['si', 'bl'] as const) {
    const f = form.get(side);
    if (!f || typeof f === 'string' || f.size === 0) continue;
    if (f.size > MAX_FILE_BYTES) return NextResponse.json({ ok: false, error: `${side.toUpperCase()} is larger than 15 MB.` }, { status: 413 });
    if (!DOC_EXTS.includes(extOf(f.name))) {
      return NextResponse.json({ ok: false, error: `${f.name}: unsupported file type. Use PDF, Word, Excel, text or a photo (JPG/PNG/WEBP).` }, { status: 400 });
    }
    files[side] = { name: f.name, buf: Buffer.from(await f.arrayBuffer()) };
  }
  if (!files.si && !files.bl) return NextResponse.json({ ok: false, error: 'Attach at least one document.' }, { status: 400 });
  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === 'string' ? v.slice(0, 2000) : undefined;
  };
  const email = await ingestUpload({ ...files, reference: str('reference'), from: str('from'), note: str('note') }, user);
  return NextResponse.json({ ok: true, id: email.id, email, trace: buildTrace(email), reply: draftReply(email) });
});
