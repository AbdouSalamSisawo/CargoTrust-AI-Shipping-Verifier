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
    for (const a of e.attachments) {
      const doc = a.kind === 'SI' ? 'SI' : 'BL';
      if (!a.readable) {
        evidence.push({
          doc,
          tone: 'bad',
          lines: [`[binary document: ${a.name} — ${a.ext.toUpperCase()}]`, 'No text layer accessible to the rules engine.', 'Requires OCR / table parsing or manual reading.'],
        });
      } else {
        evidence.push({ doc, tone: 'ok', lines: ['[text document available — comparison possible from this side]'] });
      }
    }
    summary = 'One or both documents cannot be read by the engine. The comparison was not attempted to avoid a false result.';
    suggestion = 'Read the seven fields from the original file(s), enter them below, then Correct & approve — or Approve to request a text copy from the sender.';
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
    summary = 'The documents were readable, but a required field could not be located on one side. The engine cannot compare a value it never found.';
    suggestion = 'Enter the missing value(s) exactly as written in the source document, then Correct & approve to finalize the comparison.';
  } else {
    // wrong_doc_type
    for (const a of e.attachments) {
      evidence.push({
        doc: a.kind === 'SI' ? 'SI' : 'BL',
        tone: 'bad',
        lines: [a.name, 'Document does not carry a recognizable SI / draft BL header or field set.', 'Possible wrong attachment or mislabeled export.'],
      });
    }
    summary = 'One of the attachments does not look like the document type its filename claims. Comparing it would produce a false result.';
    suggestion = 'Verify the attachments with the sender. If the documents are correct, Correct & approve with the values read manually.';
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
