import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDB, mutate } from '@/lib/store';
import { readAttachment } from '@/lib/dataset';
import { processEmail } from '@/lib/engine/pipeline';
import { buildReviewCase } from '@/lib/engine/review';
import type { EmailRecord } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = await getDB();
  const email = db.emails[params.id];
  if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 });
  const reviewCase = Object.values(db.reviews).find((r) => r.emailId === email.id) ?? null;
  return NextResponse.json({ email, reviewCase });
}

/** Re-run the full pipeline for one email (visible retry for processing failures). */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const out = await mutate(async (db) => {
    const email = db.emails[params.id];
    if (!email) return { error: 'Email not found' };
    if (email.reviewed?.action === 'correct') {
      return { error: 'This email was corrected by a reviewer — reset demo data to reprocess from scratch.' };
    }
    const rec: EmailRecord = {
      email_id: email.id,
      from: email.from,
      subject: email.subject,
      body: email.body,
      attachments: email.attachments.map((a) => a.path),
    };
    const reads: Record<string, Awaited<ReturnType<typeof readAttachment>>> = {};
    for (const p of rec.attachments) reads[p] = await readAttachment(p);
    const fresh = processEmail(rec, reads);
    fresh.seq = email.seq;
    db.emails[email.id] = fresh;

    if (fresh.status === 'NEEDS_REVIEW') {
      const rc = buildReviewCase(fresh);
      const existing = Object.values(db.reviews).find((r) => r.emailId === fresh.id && r.status === 'open');
      if (existing) Object.assign(existing, { ...rc, id: existing.id });
      else db.reviews[rc.id] = rc;
    } else {
      const open = Object.values(db.reviews).find((r) => r.emailId === fresh.id && r.status === 'open');
      if (open) {
        open.status = 'resolved';
        open.resolution = { action: 'approve', note: 'Auto-closed: reprocess produced a decision.' };
      }
    }
    return { ok: true, status: fresh.status, summary: fresh.summary };
  });
  return NextResponse.json(out);
}
