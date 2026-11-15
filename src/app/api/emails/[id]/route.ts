import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDB, mutate, runPipeline, upsertEmail, recordOf, audit } from '@/lib/store';
import { deleteUploads } from '@/lib/dataset';
import { guarded } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Ctx = { params: { id: string } };

export const GET = guarded('viewer', async (_user, _req: NextRequest, { params }: Ctx) => {
  const db = await getDB();
  const email = db.emails[params.id];
  if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 });
  const reviewCase = Object.values(db.reviews).find((r) => r.emailId === email.id) ?? null;
  const history = db.audit.filter((a) => a.target === email.id).slice(0, 50);
  return NextResponse.json({ email, reviewCase, history, organisation: db.settings.organisation });
});

/** Re-run the full pipeline for one email (e.g. after enabling AI reading). */
export const POST = guarded('operator', async (user, _req: NextRequest, { params }: Ctx) => {
  const db = await getDB();
  const email = db.emails[params.id];
  if (!email) return NextResponse.json({ ok: false, error: 'Email not found' }, { status: 404 });
  if (email.reviewed?.action === 'correct') {
    return NextResponse.json({ ok: false, error: 'A reviewer corrected this item by hand — re-running would discard the correction.' }, { status: 409 });
  }
  const fresh = await runPipeline(recordOf(email), db.settings);
  fresh.source = email.source;
  fresh.createdBy = email.createdBy;
  fresh.messageId = email.messageId;
  if (email.source === 'upload') fresh.notes = [...(email.notes ?? []).filter((n) => n.startsWith("Uploader's note")), ...(fresh.notes ?? [])];
  await mutate((d) => {
    upsertEmail(d, fresh);
    audit(d, user, 'check.rerun', fresh.id, `→ ${fresh.status}`);
  });
  return NextResponse.json({ ok: true, status: fresh.status, summary: fresh.summary });
});

/** Delete an uploaded or imported item (the sample inbox is managed from Settings). */
export const DELETE = guarded('operator', async (user, _req: NextRequest, { params }: Ctx) => {
  const out = await mutate((db) => {
    const email = db.emails[params.id];
    if (!email) return { status: 404, error: 'Email not found' };
    if (email.source === 'sample') return { status: 400, error: 'Sample items are removed together from Settings → Workspace.' };
    delete db.emails[email.id];
    for (const [id, r] of Object.entries(db.reviews)) if (r.emailId === email.id) delete db.reviews[id];
    audit(db, user, 'check.deleted', email.id, email.subject);
    return { ok: true };
  });
  if ('error' in out) return NextResponse.json({ ok: false, error: out.error }, { status: out.status });
  await deleteUploads(params.id);
  return NextResponse.json({ ok: true });
});
