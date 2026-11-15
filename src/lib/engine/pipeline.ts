/**
 * Decision pipeline: classify → locate SI/BL → read → extract → compare → decide.
 *
 * The engine never guesses. Anything it cannot decide reliably is escalated to
 * the review queue with a named reason and the evidence:
 *   missing_attachment  the sender asked for a check but the SI or BL is absent
 *   unreadable          corrupt / encrypted file, or a scan that a human must confirm
 *
 * Scans and photos are read by OCR and — when configured — by the AI vision
 * model (vision.ts). The AI transcription goes through the same extractor and
 * comparator; OCR stays as an independent cross-check. Policy "confirm"
 * (default) still routes every scan to a human with the AI pre-check; policy
 * "auto" decides automatically when the AI read is clear.
 *   wrong_doc_type      an invoice / packing list / certificate instead of SI or BL
 *   missing_value       a required field is blank or a placeholder (TBA, ____)
 */
import type { EmailRecord, ProcessedEmail, AttachmentInfo, ExtractedDoc } from '@/lib/types';
import { fieldLabel, FIELD_KEYS, type FieldKey } from '@/data/taxonomy';
import { classifyEmail } from './classify';
import { extractDoc, detectKind, type DetectedKind } from './extract';
import { compareDocs, compareValue } from './compare';
import { isScanMethod, type ReadResult } from './readers';

export interface PipelineOptions {
  /** What to do with scans the AI vision model has read. */
  aiScanPolicy?: 'confirm' | 'auto';
}

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

/**
 * Work out SI / BL from the content for attachments whose file name does not
 * say (real mail: "Draft 1.pdf", "scan0042.jpg"). Returns hints for
 * EmailRecord.attachmentKinds.
 */
export function detectAttachmentKinds(paths: string[], reads: Record<string, ReadResult | null>): Record<string, 'SI' | 'BL'> {
  const out: Record<string, 'SI' | 'BL'> = {};
  const taken = new Set(paths.map(docKindOf).filter((k) => k !== 'other'));
  for (const p of paths) {
    if (docKindOf(p) !== 'other') continue;
    const r = reads[p];
    const text = r?.ai?.text ?? r?.text;
    if (!text) continue;
    const kind = detectKind(text, extractDoc(text, { ocr: isScanMethod(r?.method) && !r?.ai?.text }));
    if ((kind === 'SI' || kind === 'BL') && !taken.has(kind)) {
      out[p] = kind;
      taken.add(kind);
    }
  }
  return out;
}

/** Normalise legacy callers that pass plain text instead of a ReadResult. */
function asRead(v: ReadResult | string | null | undefined): ReadResult {
  if (v == null) return { text: null, method: 'none', error: 'attachment not found' };
  if (typeof v === 'string') return { text: v, method: 'text' };
  return v;
}

export function processEmail(
  rec: EmailRecord,
  reads: Record<string, ReadResult | string | null>,
  opts: PipelineOptions = {},
): ProcessedEmail {
  const cls = classifyEmail(rec);
  const attachments: AttachmentInfo[] = rec.attachments.map((p) => {
    const r = asRead(reads[p]);
    return {
      path: p,
      name: p.split('/').pop() || p,
      ext: (p.split('.').pop() || '').toLowerCase(),
      kind: rec.attachmentKinds?.[p] ?? docKindOf(p),
      readable: r.text != null || r.ai?.text != null,
      size: r.text ? r.text.length : 0,
      method: r.method,
      ocrConfidence: r.ocrConfidence,
      error: r.error,
      ai: r.ai ? { model: r.ai.model, unclear: r.ai.unclear, error: r.ai.error } : undefined,
    };
  });

  const email: ProcessedEmail = {
    id: rec.email_id,
    receivedAt: rec.receivedAt,
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

  const aiErr = attachments.map((a) => a.ai?.error).find(Boolean);
  if (aiErr) email.notes = [`AI vision read failed (${aiErr}); the scan was read by OCR only.`];

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
  const hasText = (r: ReadResult) => r.text != null || r.ai?.text != null;
  if (!hasText(siRead) || !hasText(blRead)) {
    const bad = [
      !hasText(siRead) ? `${siAtt.name} (${siRead.error ?? 'no readable content'})` : null,
      !hasText(blRead) ? `${blAtt.name} (${blRead.error ?? 'no readable content'})` : null,
    ].filter(Boolean);
    return escalate('unreadable', `Could not read ${bad.join(' and ')}. Escalated — ask the sender to re-send a readable copy.`);
  }

  /** Extract one document; scans prefer the AI transcription and keep OCR as a cross-check. */
  const readDoc = (r: ReadResult, att: AttachmentInfo, kind: 'SI' | 'BL') => {
    const scan = isScanMethod(r.method);
    const aiText = scan ? (r.ai?.text ?? null) : null;
    const text = aiText ?? (r.text as string);
    const doc = extractDoc(text, { docKind: kind, method: aiText ? 'ai-vision' : r.method, ocr: scan && !aiText });
    if (aiText && r.text && att.ai) {
      const o = extractDoc(r.text, { docKind: kind, method: r.method, ocr: true });
      const agreement: Partial<Record<FieldKey, boolean | null>> = {};
      for (const f of FIELD_KEYS) {
        const a = doc.values[f];
        const b = o.values[f];
        agreement[f] = a && b ? compareValue(f, a, b, true) : null;
      }
      att.ai.agreement = agreement;
    }
    return { doc, text, scan, ai: aiText != null, read: r };
  };
  let siR = readDoc(siRead, siAtt, 'SI');
  let blR = readDoc(blRead, blAtt, 'BL');
  let si = siR.doc;
  let bl = blR.doc;
  let siKind = detectKind(siR.text, si);
  let blKind = detectKind(blR.text, bl);

  // swapped files (SI named _BL and vice versa): fix and carry on
  if (siKind === 'BL' && blKind === 'SI') {
    [si, bl] = [bl, si];
    [siR, blR] = [blR, siR];
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

  // OCR text gets OCR-tolerant comparison; an AI transcription is compared strictly.
  const ocrOnly = (siR.scan && !siR.ai) || (blR.scan && !blR.ai);
  const cmp = compareDocs(si, bl, ocrOnly);
  const scans = [siR, blR].filter((r) => r.scan);

  if (scans.length && scans.every((r) => r.ai)) {
    email.aiRead = true;
    const model = scans[0].read.ai?.model ?? 'AI';
    const unclear = [...new Set(scans.flatMap((r) => r.read.ai?.unclear ?? []))];
    const checks = [siAtt, blAtt].flatMap((a) => Object.values(a.ai?.agreement ?? {}).filter((v) => v != null));
    const agreeNote = checks.length
      ? `OCR cross-check agrees on ${checks.filter(Boolean).length} of ${checks.length} field reads`
      : 'OCR found too little text to cross-check';
    const readNote = `Scanned document read by AI vision (${model}); ${agreeNote}.`;
    if (opts.aiScanPolicy === 'auto' && unclear.length === 0) {
      email.notes = [...(email.notes ?? []), `${readNote} The AI read was complete and clear, so the engine decided automatically (policy: auto).`];
      // fall through to the normal missing-value / comparison decision
    } else {
      email.comparison = cmp;
      const missing = [...new Set([...si.missing, ...bl.missing])];
      const pre = unclear.length
        ? `The AI marked ${unclear.join(', ')} as hard to read`
        : missing.length
          ? `AI pre-check: ${missing.map(fieldLabel).join(', ')} not found`
          : cmp.defectFields.length
            ? `AI pre-check suggests a mismatch on ${cmp.defectFields.map(fieldLabel).join(', ')}`
            : 'AI pre-check: all 7 fields agree';
      return escalate('unreadable', `${readNote} ${pre}. A human confirms against the scan before release.`);
    }
  } else if (scans.length) {
    // Scans have no text layer: OCR gives a pre-check, a human confirms.
    email.comparison = cmp;
    const conf = scans.map((r) => r.read.ocrConfidence ?? 0);
    const missing = [...new Set([...si.missing, ...bl.missing])];
    const pre = missing.length
      ? `OCR could not locate ${missing.map(fieldLabel).join(', ')}`
      : cmp.defectFields.length
        ? `OCR pre-check suggests a mismatch on ${cmp.defectFields.map(fieldLabel).join(', ')}`
        : 'OCR pre-check: all 7 fields agree';
    return escalate(
      'unreadable',
      `${scans.some((r) => r.read.method === 'image-ocr') ? 'Photo or image' : 'Scanned document'} without a text layer — read by OCR (confidence ${Math.min(...conf)}%). ${pre}. A human must confirm against the scan before release.`,
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
