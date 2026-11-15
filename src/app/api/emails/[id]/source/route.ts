import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDB } from '@/lib/store';
import { readAttachment } from '@/lib/dataset';

export const dynamic = 'force-dynamic';

/** Raw text of one attachment (for the evidence source viewer in email detail). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = await getDB();
  const email = db.emails[params.id];
  if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 });
  const path = _req.nextUrl.searchParams.get('att') ?? '';
  const att = email.attachments.find((a) => a.path === path);
  if (!att) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
  const { text, size } = await readAttachment(att.path);
  return NextResponse.json({
    path: att.path,
    name: att.name,
    kind: att.kind,
    ext: att.ext,
    size,
    text,
  });
}
