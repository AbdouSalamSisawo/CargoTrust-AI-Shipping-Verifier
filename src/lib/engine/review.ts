/**
 * Builds a human-review case for every email the engine could not decide,
 * carrying the reason, the evidence it did recover, and the exact fields a
 * reviewer must confirm or correct.
 */
import { fieldLabel, FIELD_KEYS, type FieldKey } from '@/data/taxonomy';
import type { ProcessedEmail, ReviewCase } from '@/lib/types';

export function buildReviewCase(e: ProcessedEmail): ReviewCase {
  const reason = e.reviewReason!;
  const evidence: ReviewCase['evidence'] = [];
  const editFields: ReviewCase['editFields'] = [];
  let summary = '';
  let suggestion = '';

  if (reason === 'unreadable') {
    const ocr = e.attachments.some((a) => a.method === 'pdf-ocr');
    for (const a of e.attachments) {
      if (a.kind === 'other') continue;
      const doc = a.kind;
      const side = doc === 'SI' ? e.extracted?.si : e.extracted?.bl;
      if (!a.readable) {
        evidence.push({ doc, tone: 'bad', lines: [`${a.name}`, a.error ?? 'No readable content.', 'Ask the sender to re-send a readable copy.'] });
      } else if (a.method === 'pdf-ocr') {
        evidence.push({
          doc,
          tone: 'warn',
          lines: [`${a.name} — scanned, read by OCR (confidence ${a.ocrConfidence ?? '?'}%)`, ...FIELD_KEYS.map((k) => side?.lines[k] ?? `[${fieldLabel(k)} — not read]`)],
        });
      } else {
        evidence.push({ doc, tone: 'ok', lines: [`${a.name} — read from its text layer`] });
      }
    }
    summary = ocr
      ? 'Scanned document(s) without a text layer. OCR pre-filled the values below; confirm them against the scan before the result is released.'
      : 'One or both documents cannot be read (corrupt, encrypted or garbled). The comparison was not attempted to avoid a false result.';
    suggestion = ocr
      ? 'Check each OCR value against the scan, fix any misread characters, then Correct & approve to run the comparison.'
      : 'Request a readable copy from the sender — or read the seven fields from the original and Correct & approve.';
    for (const k of FIELD_KEYS) {
      editFields.push({
        field: k,
        label: fieldLabel(k),
        si: e.extracted?.si.found[k] ? e.extracted.si.raw[k] ?? null : null,
        bl: e.extracted?.bl.found[k] ? e.extracted.bl.raw[k] ?? null : null,
      });
    }
  } else if (reason === 'missing_attachment') {
    const haveSI = e.attachments.some((a) => a.kind === 'SI');
    const haveBL = e.attachments.some((a) => a.kind === 'BL');
    evidence.push({
      doc: 'SI',
      tone: haveSI ? 'ok' : 'bad',
      lines: haveSI ? ['[SI attachment located]'] : ['No SI attachment found', 'Expected: Shipping Instruction for this booking'],
    });
    evidence.push({
      doc: 'BL',
      tone: haveBL ? 'ok' : 'bad',
      lines: haveBL ? ['[draft BL attachment located]'] : ['No draft BL attachment found', 'Expected: draft Bill of Lading for this booking'],
    });
    summary = 'A document-check request cannot run with only one side of the pair. The engine will not compare a partial set.';
    suggestion = 'Approve to acknowledge the escalation and request the missing document from the sender.';
  } else if (reason === 'missing_value') {
    const missing = new Set<FieldKey>([...(e.extracted?.si.missing ?? []), ...(e.extracted?.bl.missing ?? [])]);
    for (const k of missing) {
      editFields.push({
        field: k,
        label: fieldLabel(k),
        si: e.extracted?.si.found[k] ? e.extracted.si.raw[k] ?? null : null,
        bl: e.extracted?.bl.found[k] ? e.extracted.bl.raw[k] ?? null : null,
      });
    }
    for (const docKey of ['si', 'bl'] as const) {
      const d = e.extracted?.[docKey];
      if (!d) continue;
      const lines: string[] = FIELD_KEYS.map((k) => d.lines[k] ?? `[${fieldLabel(k)} — not found]`);
      evidence.push({ doc: docKey === 'si' ? 'SI' : 'BL', tone: 'warn', lines });
    }
    const ph = { ...(e.extracted?.si.placeholders ?? {}), ...(e.extracted?.bl.placeholders ?? {}) };
    const phList = Object.entries(ph).map(([k, v]) => `${fieldLabel(k)} = "${v}"`);
    summary = `The documents were readable, but required values are blank or placeholders${phList.length ? ` (${phList.join(', ')})` : ''}. The engine never treats a placeholder as a match.`;
    suggestion = 'Enter the missing value(s) exactly as written in the source document, then Correct & approve to finalize the comparison.';
  } else {
    // wrong_doc_type
    for (const a of e.attachments) {
      if (a.kind === 'other') continue;
      const side = a.kind === 'SI' ? e.extracted?.si : e.extracted?.bl;
      const actual = side?.detectedKind ?? 'UNKNOWN';
      const ok = actual === a.kind;
      evidence.push({
        doc: a.kind,
        tone: ok ? 'ok' : 'bad',
        lines: ok
          ? [`${a.name} — content confirms a ${a.kind === 'SI' ? 'Shipping Instruction' : 'Bill of Lading'}`]
          : [a.name, `Content identifies as: ${actual.replace('_', ' ').toLowerCase()}`, `Expected: ${a.kind === 'SI' ? 'Shipping Instruction' : 'draft Bill of Lading'}`],
      });
    }
    summary = 'An attachment is not the document its filename claims (e.g. a commercial invoice, packing list or certificate of origin). Comparing it would produce a false result.';
    suggestion = 'Ask the sender for the correct document. If you have it, Correct & approve with the values read from it.';
  }

  return {
    id: 'R-' + e.id.replace('email_', '').padStart(3, '0'),
    emailId: e.id,
    reason,
    summary,
    suggestion,
    evidence,
    editFields,
    status: 'open',
  };
}
