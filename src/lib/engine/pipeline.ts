/**
 * Decision pipeline: classify → locate SI/BL → read → extract → compare → decide.
 *
 * The engine never guesses. Anything it cannot decide reliably is escalated to
 * the review queue with a named reason and the evidence:
 *   missing_attachment  the sender asked for a check but the SI or BL is absent
 *   unreadable          corrupt / encrypted file, or a scan read only by OCR
 *   wrong_doc_type      an invoice / packing list / certificate instead of SI or BL
 *   missing_value       a required field is blank or a placeholder (TBA, ____)
 */
import type { EmailRecord, ProcessedEmail, AttachmentInfo, ExtractedDoc } from '@/lib/types';
import { fieldLabel } from '@/data/taxonomy';
import { classifyEmail } from './classify';
import { extractDoc, detectKind, type DetectedKind } from './extract';
import { compareDocs } from './compare';
import type { ReadResult } from './readers';

export function docKindOf(path: string): 'SI' | 'BL' | 'other' {
  const m = path.match(/[_\-\s]([A-Za-z]{2})\.[A-Za-z0-9]+$/);
  if (m) {
    const t = m[1].toUpperCase();
    if (t === 'SI' || t === 'BL') return t;
  }
  const lower = path.toLowerCase();
  if (/shipping[_-]?instruction/.test(lower)) return 'SI';
  if (/bill[_-]?of[_-]?lading/.test(lower)) return 'BL';
  return 'other';
}

const KIND_LABEL: Record<DetectedKind, string> = {
  SI: 'a Shipping Instruction', BL: 'a Bill of Lading', INVOICE: 'a commercial invoice',
  PACKING_LIST: 'a packing list', CERTIFICATE: 'a certificate of origin', UNKNOWN: 'an unrecognised document',
};

function summarizeNonDoc(category: string): string {
  switch (category) {
    case 'SI_REQUEST':
      return 'Shipping Instruction request / submission — routed to the documentation desk. No SI/BL comparison required.';
    case 'INVOICE_QUERY':
      return 'Invoice / billing query — routed to the finance desk. No document comparison required.';
    case 'SPAM':
      return 'Spam / phishing — quarantined. Do not click links or reply.';
    default:
      return 'General / operational correspondence — no document comparison required.';
  }
}

/** Normalise legacy callers that pass plain text instead of a ReadResult. */
function asRead(v: ReadResult | string | null | undefined): ReadResult {
  if (v == null) return { text: null, method: 'none', error: 'attachment not found' };
  if (typeof v === 'string') return { text: v, method: 'text' };
  return v;
}

export function processEmail(rec: EmailRecord, reads: Record<string, ReadResult | string | null>): ProcessedEmail {
  const cls = classifyEmail(rec);
  const attachments: AttachmentInfo[] = rec.attachments.map((p) => {
    const r = asRead(reads[p]);
    return {
      path: p,
      name: p.split('/').pop() || p,
      ext: (p.split('.').pop() || '').toLowerCase(),
      kind: docKindOf(p),
      readable: r.text != null,
      size: r.text ? r.text.length : 0,
      method: r.method,
      ocrConfidence: r.ocrConfidence,
      error: r.error,
    };
  });

  const email: ProcessedEmail = {
    id: rec.email_id,
    from: rec.from,
    subject: rec.subject,
    body: rec.body,
    category: cls.category,
    categoryScores: cls.scores,
    signals: cls.signals,
    docIntent: cls.docIntent,
    decidedBy: cls.decidedBy,
    confidence: cls.confidence,
    status: 'OK',
    defectFields: [],
    hasDefect: false,
    reviewReason: null,
    summary: '',
    attachments,
    reviewed: null,
    seq: 0,
  };

  if (cls.category !== 'BL_COMPARISON') {
    email.summary = summarizeNonDoc(cls.category);
    return email;
  }

  /* ---- document-check path ---- */
  let siAtt = attachments.find((a) => a.kind === 'SI');
  let blAtt = attachments.find((a) => a.kind === 'BL');

  if (!siAtt && !blAtt && cls.docIntent !== 'compare') {
    // A thread asking someone to *send* the draft BL: nothing to compare yet,
    // and nothing to escalate either. Tracked, not flagged.
    email.awaitingDocuments = true;
    email.summary =
      cls.docIntent === 'request_document'
        ? 'Draft BL requested for checking — no documents attached yet. The comparison runs when the SI and draft BL arrive.'
        : 'Document thread without attachments — nothing to compare yet.';
    return email;
  }

  const escalate = (reason: ProcessedEmail['reviewReason'], summary: string) => {
    email.status = 'NEEDS_REVIEW';
    email.reviewReason = reason;
    email.summary = summary;
    return email;
  };

  if (!siAtt || !blAtt) {
    const have = [siAtt, blAtt].filter(Boolean).map((a) => a!.name);
    const miss = !siAtt && !blAtt ? 'both the SI and the draft BL' : siAtt ? 'the draft BL' : 'the SI';
    return escalate(
      'missing_attachment',
      `The sender asks for an SI/BL check but ${miss} ${!siAtt && !blAtt ? 'are' : 'is'} not attached${have.length ? ` (found: ${have.join(', ')})` : ''}. Escalated — request the missing document instead of guessing.`,
    );
  }

  const siRead = asRead(reads[siAtt.path]);
  const blRead = asRead(reads[blAtt.path]);
  if (siRead.text == null || blRead.text == null) {
    const bad = [
      siRead.text == null ? `${siAtt.name} (${siRead.error ?? 'no readable content'})` : null,
      blRead.text == null ? `${blAtt.name} (${blRead.error ?? 'no readable content'})` : null,
    ].filter(Boolean);
    return escalate('unreadable', `Could not read ${bad.join(' and ')}. Escalated — ask the sender to re-send a readable copy.`);
  }

  const ocr = siRead.method === 'pdf-ocr' || blRead.method === 'pdf-ocr';
  let si = extractDoc(siRead.text, { docKind: 'SI', method: siRead.method, ocr: siRead.method === 'pdf-ocr' });
  let bl = extractDoc(blRead.text, { docKind: 'BL', method: blRead.method, ocr: blRead.method === 'pdf-ocr' });
  let siKind = detectKind(siRead.text, si);
  let blKind = detectKind(blRead.text, bl);

  // swapped files (SI named _BL and vice versa): fix and carry on
  if (siKind === 'BL' && blKind === 'SI') {
    [si, bl] = [bl, si];
    [siKind, blKind] = [blKind, siKind];
    [siAtt, blAtt] = [blAtt, siAtt];
    si.docKind = 'SI';
    bl.docKind = 'BL';
    email.notes = [...(email.notes ?? []), 'The attachments were named the wrong way round (SI ↔ BL); the engine re-assigned them by content.'];
  }
  si.detectedKind = siKind;
  bl.detectedKind = blKind;
  email.extracted = { si, bl };

  const siOk = siKind === 'SI' || (siKind === 'UNKNOWN' && si.completeness >= 0.6);
  const blOk = blKind === 'BL' || (blKind === 'UNKNOWN' && bl.completeness >= 0.6);
  if (!siOk || !blOk) {
    const parts = [
      !siOk ? `${siAtt.name} is ${KIND_LABEL[siKind]}, not a Shipping Instruction` : null,
      !blOk ? `${blAtt.name} is ${KIND_LABEL[blKind]}, not a Bill of Lading` : null,
    ].filter(Boolean);
    return escalate('wrong_doc_type', `${parts.join('; ')}. Escalated — the comparison needs the SI and the draft BL.`);
  }

  const cmp = compareDocs(si, bl, ocr);

  if (ocr) {
    // Scans have no text layer: OCR gives a pre-check, a human confirms.
    email.comparison = cmp;
    const conf = [siRead, blRead].filter((r) => r.method === 'pdf-ocr').map((r) => r.ocrConfidence ?? 0);
    const missing = [...new Set([...si.missing, ...bl.missing])];
    const pre = missing.length
      ? `OCR could not locate ${missing.map(fieldLabel).join(', ')}`
      : cmp.defectFields.length
        ? `OCR pre-check suggests a mismatch on ${cmp.defectFields.map(fieldLabel).join(', ')}`
        : 'OCR pre-check: all 7 fields agree';
    return escalate(
      'unreadable',
      `Scanned document without a text layer — read by OCR (confidence ${Math.min(...conf)}%). ${pre}. A human must confirm against the scan before release.`,
    );
  }

  const placeholders = { ...(si.placeholders ?? {}), ...(bl.placeholders ?? {}) };
  const missingAll = [...new Set([...si.missing, ...bl.missing])];
  if (missingAll.length > 0) {
    email.comparison = cmp;
    const detail = missingAll
      .map((f) => {
        const ph = si.placeholders?.[f] ?? bl.placeholders?.[f];
        const where = si.missing.includes(f) && bl.missing.includes(f) ? 'both' : si.missing.includes(f) ? 'SI' : 'BL';
        return `${fieldLabel(f)} (${where}${ph ? `: "${ph}"` : ': not found'})`;
      })
      .join(', ');
    void placeholders;
    return escalate(
      'missing_value',
      `Required value${missingAll.length > 1 ? 's' : ''} missing — ${detail}. A blank or placeholder is never treated as a match; escalated for the customer to complete.`,
    );
  }

  email.comparison = cmp;
  email.defectFields = cmp.defectFields;
  email.hasDefect = cmp.defectFields.length > 0;
  email.status = email.hasDefect ? 'MISMATCH' : 'OK';
  email.confidence = Math.max(email.confidence, 0.9);
  email.summary = email.hasDefect
    ? `${cmp.defectFields.length} of 7 fields differ between the SI and the draft BL: ${cmp.rows
        .filter((r) => r.match === false)
        .map((r) => `${r.label} (SI: ${r.si} / BL: ${r.bl})`)
        .join('; ')}.`
    : 'No mismatch detected — all 7 fields match between the SI and the draft BL.';
  return email;
}
