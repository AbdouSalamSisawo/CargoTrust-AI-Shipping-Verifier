import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDB, aiConfigFrom } from '@/lib/store';
import { readAttachment, attachmentBytes } from '@/lib/dataset';
import { guarded } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  txt: 'text/plain; charset=utf-8',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/**
 * One attachment of an email.
 *   ?att=<path>             what the engine read (text, plus the AI transcription for scans)
 *   ?att=<path>&raw=1       the original file (inline for PDF / images, download otherwise)
 */
export const GET = guarded('viewer', async (_user, req: NextRequest, { params }: { params: { id: string } }) => {
  const db = await getDB();
  const email = db.emails[params.id];
  if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 });
  const p = req.nextUrl.searchParams.get('att') ?? '';
  const att = email.attachments.find((a) => a.path === p);
  if (!att) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });

  if (req.nextUrl.searchParams.get('raw') === '1') {
    const buf = await attachmentBytes(att.path);
    if (!buf) return NextResponse.json({ error: 'File not found' }, { status: 404 });
    const inline = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'txt'].includes(att.ext);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': MIME[att.ext] ?? 'application/octet-stream',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${att.name.replace(/"/g, '')}"`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      },
    });
  }

  // Only use the AI read if this attachment was read that way (cached — no new API call).
  const r = await readAttachment(att.path, { ai: att.ai && !att.ai.error ? aiConfigFrom(db.settings) : null });
  return NextResponse.json({
    path: att.path,
    name: att.name,
    kind: att.kind,
    ext: att.ext,
    size: r.size,
    method: r.method,
    text: r.text,
    aiText: r.ai?.text ?? null,
  });
});
