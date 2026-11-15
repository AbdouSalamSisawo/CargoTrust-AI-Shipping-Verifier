import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { mutate, audit } from '@/lib/store';
import { guarded } from '@/lib/auth';
import { compareDocs } from '@/lib/engine/compare';
import { fieldLabel, FIELD_KEYS, type FieldKey } from '@/data/taxonomy';
import type { ExtractedDoc } from '@/lib/types';

export const dynamic = 'force-dynamic';

type EditMap = Record<string, { si?: string; bl?: string }>;

/** Resolve a review case: approve / reject / correct-and-approve. */
export const POST = guarded('operator', async (user, req: NextRequest, { params }: { params: { id: string } }) => {
  const body = (await req.json().catch(() => ({}))) as {
    action?: 'approve' | 'correct' | 'reject';
    note?: string;
    edits?: EditMap;
  };
  const action = body.action;
  if (!action || !['approve', 'correct', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const out = await mutate((db) => {
    const kase = Object.values(db.reviews).find((r) => r.id === params.id);
    if (!kase) return { error: 'Case not found' } as const;
    if (kase.status === 'resolved') return { error: 'Case already resolved' } as const;
    const email = db.emails[kase.emailId];
    if (!email) return { error: 'Email not found' } as const;

    if (action === 'correct') {
      const edits = body.edits ?? {};
      if (!email.extracted) {
        const mk = (): ExtractedDoc => ({
          found: {} as Record<FieldKey, boolean>,
          values: {},
          raw: {},
          lines: {},
          missing: [...FIELD_KEYS],
          completeness: 0,
        });
        email.extracted = { si: mk(), bl: mk() };
      }
      for (const [field, v] of Object.entries(edits)) {
        if (!FIELD_KEYS.includes(field as FieldKey)) continue;
        for (const side of ['si', 'bl'] as const) {
          const val = v?.[side];
          const clean = typeof val === 'string' ? val.trim() : '';
          if (!clean) continue;
          const doc = email.extracted[side];
          doc.found[field as FieldKey] = true;
          doc.raw[field as FieldKey] = clean;
          doc.values[field as FieldKey] = clean;
          doc.lines[field as FieldKey] = `${fieldLabel(field)} (reviewer): ${clean}`;
        }
      }
      for (const side of ['si', 'bl'] as const) {
        const d = email.extracted[side];
        d.missing = FIELD_KEYS.filter((k) => !d.found[k]);
        d.completeness = (FIELD_KEYS.length - d.missing.length) / FIELD_KEYS.length;
      }
      const stillMissing = new Set([...email.extracted.si.missing, ...email.extracted.bl.missing]);
      if (stillMissing.size > 0) {
        email.status = 'NEEDS_REVIEW';
        email.reviewReason = 'missing_value';
        email.summary = `Correction saved — still missing: ${[...stillMissing].map(fieldLabel).join(', ')}.`;
        kase.reason = 'missing_value';
        kase.editFields = [...stillMissing].map((f) => ({
          field: f,
          label: fieldLabel(f),
          si: email.extracted!.si.found[f] ? email.extracted!.si.raw[f] ?? null : null,
          bl: email.extracted!.bl.found[f] ? email.extracted!.bl.raw[f] ?? null : null,
        }));
        kase.summary = email.summary;
        audit(db, user, 'review.corrected', email.id, `Values corrected; still missing ${[...stillMissing].map(fieldLabel).join(', ')}`);
        return { ok: true, status: email.status, stillOpen: true } as const;
      }
      const cmp = compareDocs(email.extracted.si, email.extracted.bl);
      email.comparison = cmp;
      email.defectFields = cmp.defectFields;
      email.hasDefect = cmp.defectFields.length > 0;
      email.status = email.hasDefect ? 'MISMATCH' : 'OK';
      email.reviewReason = null;
      email.summary = email.hasDefect
        ? `Reviewer-corrected — ${cmp.defectFields.length} of 7 fields differ: ${cmp.defectFields.map(fieldLabel).join(', ')}.`
        : 'Reviewer confirmed the values — no mismatch detected.';
      email.reviewed = { action: 'correct', note: body.note, by: user.name, at: new Date().toISOString() };
      kase.status = 'resolved';
      kase.resolution = { action: 'correct', note: body.note, updatedStatus: email.status, by: user.name, at: new Date().toISOString() };
      audit(db, user, 'review.corrected', email.id, `Resolved → ${email.status}${body.note ? ` — ${body.note}` : ''}`);
      return { ok: true, status: email.status } as const;
    }

    // approve / reject — the escalation is acknowledged; the email stays NEEDS_REVIEW
    email.reviewed = { action, note: body.note, by: user.name, at: new Date().toISOString() };
    kase.status = 'resolved';
    kase.resolution = { action, note: body.note, updatedStatus: 'NEEDS_REVIEW', by: user.name, at: new Date().toISOString() };
    audit(db, user, action === 'approve' ? 'review.approved' : 'review.rejected', email.id, body.note || undefined);
    return { ok: true, status: email.status } as const;
  });

  return NextResponse.json(out);
});
