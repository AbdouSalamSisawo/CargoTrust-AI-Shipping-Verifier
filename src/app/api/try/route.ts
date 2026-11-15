import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { readBuffer } from '@/lib/dataset';
import { processEmail } from '@/lib/engine/pipeline';
import { buildTrace } from '@/lib/engine/trace';
import { draftReply } from '@/lib/engine/reply';
import type { ReadResult } from '@/lib/engine/readers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Public playground: run the FULL production pipeline (classify → read →
 * extract → compare → decide) on documents the visitor provides — any format
 * the console supports: text, PDF, scanned PDF (OCR), Word, Excel. Nothing is
 * stored.
 *
 * Accepts multipart/form-data:  si, bl (files) | siText, blText (strings),
 * optional subject, body, from.  JSON { si, bl } (pasted text) also works.
 */
export async function POST(req: NextRequest) {
  let subject = 'Please check SI vs draft BL';
  let body = 'Dear Team,\n\nPlease check the attached SI and draft BL and revert with any discrepancy.\n\nThank you.';
  let from = 'playground@cargotrust.ai';
  const docs: Record<'SI' | 'BL', { name: string; buf: Buffer } | null> = { SI: null, BL: null };

  const ctype = req.headers.get('content-type') ?? '';
  if (ctype.includes('multipart/form-data')) {
    const form = await req.formData();
    subject = (form.get('subject') as string | null)?.trim() || subject;
    body = (form.get('body') as string | null)?.trim() || body;
    from = (form.get('from') as string | null)?.trim() || from;
    for (const side of ['SI', 'BL'] as const) {
      const f = form.get(side.toLowerCase());
      const t = form.get(`${side.toLowerCase()}Text`);
      if (f && typeof f !== 'string' && f.size > 0) {
        if (f.size > MAX_BYTES) return NextResponse.json({ error: `${side} file is larger than 10 MB.` }, { status: 413 });
        const ext = (f.name.split('.').pop() || 'txt').toLowerCase();
        docs[side] = { name: `playground_${side}.${ext}`, buf: Buffer.from(await f.arrayBuffer()) };
      } else if (typeof t === 'string' && t.trim()) {
        docs[side] = { name: `playground_${side}.txt`, buf: Buffer.from(t, 'utf8') };
      }
    }
  } else {
    const j = (await req.json().catch(() => ({}))) as { si?: string; bl?: string; subject?: string; body?: string };
    if (j.si?.trim()) docs.SI = { name: 'playground_SI.txt', buf: Buffer.from(j.si, 'utf8') };
    if (j.bl?.trim()) docs.BL = { name: 'playground_BL.txt', buf: Buffer.from(j.bl, 'utf8') };
    subject = j.subject?.trim() || subject;
    body = j.body?.trim() || body;
  }

  const attachments: string[] = [];
  const reads: Record<string, ReadResult> = {};
  const texts: Record<string, string | null> = {};
  for (const side of ['SI', 'BL'] as const) {
    const d = docs[side];
    if (!d) continue;
    attachments.push(d.name);
    reads[d.name] = await readBuffer(d.name, d.buf);
    texts[side] = reads[d.name].text;
  }

  const email = processEmail({ email_id: 'playground', from, subject, body, attachments }, reads);
  return NextResponse.json({
    ok: true,
    email,
    trace: buildTrace(email),
    reply: draftReply(email),
    sources: texts,
  });
}
