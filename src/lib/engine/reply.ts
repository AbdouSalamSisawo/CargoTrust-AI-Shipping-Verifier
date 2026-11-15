/**
 * Draft reply — turns a decision into the email an operator would send next.
 * Deterministic templates (no LLM): every value in the draft comes from the
 * comparison, so the reply can never state something the engine did not find.
 */
import { fieldLabel } from '@/data/taxonomy';
import type { ProcessedEmail } from '@/lib/types';

export interface DraftReply { to: string; subject: string; body: string; purpose: string }

const greet = (from: string) => {
  const local = from.split('@')[0].split(/[._-]/)[0];
  return local && /^[a-z]+$/i.test(local) && local.length > 2 ? `Dear ${local[0].toUpperCase()}${local.slice(1).toLowerCase()},` : 'Dear Team,';
};

export function draftReply(e: ProcessedEmail): DraftReply | null {
  if (e.category !== 'BL_COMPARISON' || e.awaitingDocuments) return null;
  const subject = `RE: ${e.subject.replace(/^(re[:_]\s*)+/i, '')}`;
  const sign = '\n\nBest regards,\nShipping Documentation\n(checked with CargoTrust AI)';

  if (e.status === 'MISMATCH' && e.comparison) {
    const diffs = e.comparison.rows.filter((r) => r.match === false);
    const lines = diffs.map((r) => `  • ${r.label}\n      SI (correct):  ${r.si}\n      Draft BL:      ${r.bl}`).join('\n');
    return {
      to: e.from,
      subject,
      purpose: 'Amendment request',
      body: `${greet(e.from)}\n\nWe have checked the draft BL against our Shipping Instruction and found ${diffs.length} discrepanc${diffs.length > 1 ? 'ies' : 'y'}. Please amend the draft BL as follows and send the revised draft for our confirmation:\n\n${lines}\n\nAll other particulars (${7 - diffs.length} of 7 fields) match the SI.${sign}`,
    };
  }
  if (e.status === 'OK') {
    return {
      to: e.from,
      subject,
      purpose: 'Confirmation',
      body: `${greet(e.from)}\n\nWe have checked the draft BL against our Shipping Instruction: shipper, consignee, notify party, port of loading, port of discharge, container count and gross weight all match. The draft BL is confirmed — please proceed.${sign}`,
    };
  }
  // NEEDS_REVIEW
  const ask: Record<string, string> = {
    missing_attachment: 'the Shipping Instruction and the draft BL do not appear to be attached. Could you please re-send both documents?',
    unreadable: 'we could not reliably read one of the documents (corrupt or scanned copy). Could you please re-send it as a text-based PDF, Word or Excel file?',
    wrong_doc_type: 'one of the attached files is not a Shipping Instruction / draft BL. Could you please send the correct documents?',
    missing_value: `the following required particulars are blank or not yet confirmed: ${[
      ...new Set([...(e.extracted?.si.missing ?? []), ...(e.extracted?.bl.missing ?? [])]),
    ]
      .map(fieldLabel)
      .join(', ')}. Could you please provide them so we can complete the check?`,
  };
  return {
    to: e.from,
    subject,
    purpose: 'Information request',
    body: `${greet(e.from)}\n\nThank you for your documents. Before we can confirm the draft BL, ${ask[e.reviewReason ?? 'unreadable']}${sign}`,
  };
}
