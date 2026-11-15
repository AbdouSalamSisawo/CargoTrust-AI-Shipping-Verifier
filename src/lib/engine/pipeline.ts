/**
 * Decision pipeline: classify → locate SI/BL → extract → compare → decide.
 * The engine never guesses: anything it cannot reliably decide (missing or
 * unreadable documents, wrong document type, unparseable values) is escalated
 * to the human review queue with the reason and the evidence.
 */
import type { EmailRecord, ProcessedEmail, AttachmentInfo, ExtractedDoc } from '@/lib/types';
import { fieldLabel } from '@/data/taxonomy';
import { classifyEmail } from './classify';
import { extractDoc } from './extract';
import { compareDocs } from './compare';

export function docKindOf(path: string): 'SI' | 'BL' | 'other' {
  const m = path.match(/_([A-Za-z]{2})\.[A-Za-z]+$/);
  if (m) {
    const t = m[1].toUpperCase();
    if (t === 'SI' || t === 'BL') return t;
  }
  const lower = path.toLowerCase();
  if (/shipping[_-]?instruction/.test(lower)) return 'SI';
  if (/bill[_-]?of[_-]?lading/.test(lower)) return 'BL';
  return 'other';
}

function looksLike(text: string, headerRe: RegExp, doc: ExtractedDoc): boolean {
  if (headerRe.test(text.slice(0, 800))) return true;
  return doc.completeness >= 0.5; // no header but most canonical fields present
}

function summarizeNonDoc(category: string): string {
  switch (category) {
    case 'SI_REQUEST':
      return 'Shipping Instruction submission — logged for the documentation team. No SI/BL comparison required.';
    case 'INVOICE_QUERY':
      return 'Invoice / billing query — routed to the finance desk. No document comparison required.';
    case 'SPAM':
      return 'Unsolicited / suspicious message — quarantined by the spam filter. No action required.';
    default:
      return 'General correspondence — no document comparison required.';
  }
}

export function processEmail(rec: EmailRecord, texts: Record<string, string | null>): ProcessedEmail {
  const cls = classifyEmail(rec);
  const attachments: AttachmentInfo[] = rec.attachments.map((p) => {
    const t = texts[p];
    return {
      path: p,
      name: p.split('/').pop() || p,
      ext: (p.split('.').pop() || '').toLowerCase(),
      kind: docKindOf(p),
      readable: t != null,
      size: t ? t.length : 0,
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
  const siAtt = attachments.find((a) => a.kind === 'SI');
  const blAtt = attachments.find((a) => a.kind === 'BL');

  if (!siAtt && !blAtt && cls.docIntent !== 'compare') {
    // A thread asking someone to *send* the draft BL: there is nothing to compare
    // yet, so there is nothing to escalate either. It is tracked, not flagged.
    email.awaitingDocuments = true;
    email.summary =
      cls.docIntent === 'request_document'
        ? 'Draft BL requested for checking — no documents attached yet. The comparison runs when the SI and draft BL arrive.'
        : 'Document thread without attachments — nothing to compare yet.';
    return email;
  }

  if (!siAtt || !blAtt) {
    email.status = 'NEEDS_REVIEW';
    email.reviewReason = 'missing_attachment';
    const have = [siAtt, blAtt].filter(Boolean).map((a) => a!.name);
    const miss = !siAtt && !blAtt ? 'both the SI and the draft BL' : siAtt ? 'the draft BL' : 'the SI';
    email.summary = `Document-check request is missing ${miss} attachment${have.length ? ` (found: ${have.join(', ')})` : ''} — escalated instead of guessing.`;
    return email;
  }

  const siText = texts[siAtt.path];
  const blText = texts[blAtt.path];
  if (siText == null || blText == null) {
    email.status = 'NEEDS_REVIEW';
    email.reviewReason = 'unreadable';
    const binary = [siAtt, blAtt].filter((a) => texts[a.path] == null).map((a) => a.name).join(', ');
    email.summary = `${binary} has no readable text layer for the rules engine (binary format — OCR / table parsing required). Escalated to human review.`;
    return email;
  }

  const si = extractDoc(siText, 'SI');
  const bl = extractDoc(blText, 'BL');
  email.extracted = { si, bl };

  // wrong document type: neither document carries its header nor canonical fields
  // (generated PDFs title the SI "BILL OF LADING INSTRUCTION", so the SI check
  // accepts any instruction header + field coverage)
  const siOk = looksLike(siText, /(shipping\s*)?instruction/i, si);
  const blOk = looksLike(blText, /bill\s*of\s*lading/i, bl);
  if (!siOk || !blOk) {
    email.status = 'NEEDS_REVIEW';
    email.reviewReason = 'wrong_doc_type';
    const bad = !siOk && !blOk ? 'Neither document' : !siOk ? `The SI (${siAtt.name})` : `The draft BL (${blAtt.name})`;
    email.summary = `${bad} does not identify as the expected document type — escalated for verification.`;
    return email;
  }

  const missingAll = [...new Set([...si.missing, ...bl.missing])];
  if (missingAll.length > 0) {
    email.status = 'NEEDS_REVIEW';
    email.reviewReason = 'missing_value';
    email.summary = `Could not locate ${missingAll.length} required field${missingAll.length > 1 ? 's' : ''} (${missingAll
      .map((f) => fieldLabel(f))
      .join(', ')}) across the documents — a human must read the source before release.`;
    return email;
  }

  const cmp = compareDocs(si, bl);
  email.comparison = cmp;
  email.defectFields = cmp.defectFields;
  email.hasDefect = cmp.defectFields.length > 0;
  email.status = email.hasDefect ? 'MISMATCH' : 'OK';
  email.confidence = Math.max(email.confidence, 0.9);
  email.summary = email.hasDefect
    ? `${cmp.defectFields.length} of 7 fields differ between the SI and the draft BL: ${cmp.defectFields
        .map((f) => fieldLabel(f))
        .join(', ')}.`
    : 'No mismatch detected — all 7 fields match between the SI and the draft BL.';
  return email;
}
