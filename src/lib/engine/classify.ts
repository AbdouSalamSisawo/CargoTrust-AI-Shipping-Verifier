/**
 * Intent classifier.
 *
 * Real shipping inboxes are noisy: forwarded threads, security banners,
 * signatures, and — the planted trap — subjects that do not match the body
 * (an "_RPA_ Billing" subject over an SI reminder body). So the classifier:
 *
 *   1. cleans the body down to the newest message (no banner / quote / signature),
 *   2. screens for spam & phishing first (a scam about "invoice payment" is spam,
 *      not an invoice query),
 *   3. treats an attached SI + BL pair as structural proof of a check request,
 *   4. scores BODY intent above SUBJECT intent, so a misleading subject loses,
 *   5. reports a calibrated confidence: low margin between the top two intents
 *      → low confidence → the email is a candidate for a second opinion.
 *
 * It also reports the *document intent* of check emails — whether the sender
 * asks us to compare documents (so they should be attached) or asks someone to
 * send a draft BL (nothing to compare yet). The pipeline uses that to escalate
 * `missing_attachment` only when documents were actually expected.
 */
import type { Category } from '@/data/taxonomy';
import { CATEGORY_ORDER } from '@/data/taxonomy';
import type { EmailRecord } from '@/lib/types';

export type DocIntent = 'compare' | 'request_document' | 'none';

export interface Classification {
  category: Category;
  confidence: number;
  scores: Record<string, number>;
  signals: string[];
  docIntent: DocIntent;
  decidedBy: 'rule' | 'llm';
}

/* ------------------------------------------------------------------ cleaning */

const BANNER = /WARNING:\s*This email originated outside[\s\S]*?(attachments|links)\.\s*/gi;
const QUOTE_START = /\n\s*(_{5,}|-{5,}\s*Original Message|From:\s|On .{5,80} wrote:)/i;
const SIGN_OFF = /\n\s*(best regards|kind regards|warm regards|regards|thank you|thanks|best|cheers|sincerely)[,.!]?\s*\n[\s\S]*$/i;

/** The newest message only: no security banner, quoted thread, or signature. */
export function cleanBody(body: string): string {
  let b = body.replace(BANNER, '');
  const q = b.search(QUOTE_START);
  if (q > 0) b = b.slice(0, q);
  b = b.replace(SIGN_OFF, '\n');
  return b.trim();
}

/* --------------------------------------------------------------------- rules */

type Rule = [Category, RegExp, number, string];

/** Spam / phishing. Checked first and on the full text (subject + body). */
const SPAM_RULES: [RegExp, number, string][] = [
  [/(gift card|monthly draw|you have (won|been selected)|claim (your|now)|won a|lottery|prize)/i, 4, 'prize / lottery bait'],
  [/(bitcoin|crypto|guaranteed\s+\d+%?\s*returns?|investment opportunity)/i, 4, 'investment scam'],
  [/(bank officer|business proposal|usd\s*[\d.]+\s*million|inheritance|next of kin)/i, 4, 'advance-fee fraud'],
  [/(verify your account|account (will be )?(suspended|deactivated|locked)|avoid (suspension|deactivation)|storage (is full|limit)|mailbox has exceeded)/i, 4, 'credential phishing'],
  [/(confirm (your )?bank details|update (your )?(bank|payment) details|unpaid customs fee|confirm payment within)/i, 4, 'payment phishing'],
  [/(\d+\s*%\s*off|buy now|this week only|limited time|act now|exclusive offer|one weird trick|hot singles)/i, 3, 'marketing / bait'],
  [/(undelivered messages|click here|complete (this )?short survey|free-[a-z]+\.)/i, 2.5, 'click bait'],
];
const SPAM_TLDS = /\.(biz|info|top|xyz|click|online|shop|loan|surf|gq|tk|ml|cf)$/i;
const SPAM_DOMAIN_WORDS = /(secure-mailbox|webmail-verify|prize|crypto|deals|parcel-track|claims)/i;

/** Body intents — the newest message decides. */
const BODY_RULES: Rule[] = [
  // document check (SI vs draft BL)
  ['BL_COMPARISON', /(check|compare|verify|confirm|review)\b[^.\n]{0,60}\b(draft\s*b\/?l|bill of lading)\b[^.\n]{0,40}\b(si|shipping instruction)\b/i, 5, 'asks to check the draft BL against the SI'],
  ['BL_COMPARISON', /(compare|check)\b[^.\n]{0,20}\b(the\s+)?si\b[^.\n]{0,12}\b(and|&|vs\.?|versus|against)\b[^.\n]{0,12}\b(draft\s*)?b\/?l\b/i, 5, 'asks to compare SI and BL'],
  ['BL_COMPARISON', /(attached|enclosed|find attached)\b[^.\n]{0,40}\b(si|shipping instruction)\b[^.\n]{0,20}\b(and|&)\b[^.\n]{0,20}\b(draft\s*)?(b\/?l|bill of lading)\b/i, 5, 'SI and draft BL attached for confirmation'],
  ['BL_COMPARISON', /\b(send|share|provide|forward)\b[^.\n]{0,20}\bdraft\s*b\/?l\b[^.\n]{0,60}\b(check|checking|confirm|review)/i, 4, 'requests the draft BL for checking'],
  ['BL_COMPARISON', /\bdraft\s*b\/?l\b[^.\n]{0,40}\b(discrepanc|amend|correct)/i, 2.5, 'draft BL discrepancy / amendment'],
  // shipping instruction
  ['SI_REQUEST', /(please find|attached is|here is|sending)\b[^.\n]{0,20}\bshipping instruction\b/i, 5, 'submits a shipping instruction'],
  ['SI_REQUEST', /\b(submit|prepare|send|provide|issue)\b[^.\n]{0,24}\b(si|shipping instructions?)\b/i, 4, 'asks for a shipping instruction'],
  ['SI_REQUEST', /^\s*(pol|port of loading)\s*:/im, 1.5, 'inline SI particulars'],
  // invoice / billing
  ['INVOICE_QUERY', /\binvoice\s*(no\.?|#|number)?\s*\d{5,}/i, 5, 'references an invoice number'],
  ['INVOICE_QUERY', /\b(d&d|detention|demurrage|thc|local charges?|freight charges?|credit note|debit note)\b/i, 3.5, 'charges query'],
  ['INVOICE_QUERY', /\b(billing|billed|release payment|payment|remittance|breakdown)\b/i, 2, 'billing language'],
  // general / operational broadcasts
  ['GENERAL', /\b(automated notification|no action required|rpa bot)\b/i, 5, 'automated notification'],
  ['GENERAL', /\b(berthing report|update summary|list of outstanding b\/?l|loading completed|documents to follow|berthed on schedule)\b/i, 5, 'operational report'],
  ['GENERAL', /\b(happy|prosperous) new year\b|\boffice (resumes|closed)\b|\bpublic holiday\b/i, 5, 'office announcement'],
  ['GENERAL', /\breminder\b[^.\n]{0,80}\b(all (pending|outstanding) shipments|outstanding list|by end of day)\b/i, 6, 'team-wide SLA reminder (not a specific SI)'],
  ['GENERAL', /\b(vessel schedule|delay|congestion|advisory|circular|newsletter|bulletin)\b/i, 1.5, 'operational update'],
];

/** Subject intents — weaker: subjects are often reused or misleading. */
const SUBJECT_RULES: Rule[] = [
  ['BL_COMPARISON', /\b(to confirm docs|request bl draft|draft bl\b|amend bl)\b/i, 2, 'subject: document confirmation thread'],
  ['BL_COMPARISON', /^(re_?\s*)?[A-Z]{2,6}\s+-\s+[A-Z .]+_[A-Z .]+\s+-\s+[A-Z]+\([A-Z0-9]+\)/i, 2, 'subject: coded BL reference'],
  ['SI_REQUEST', /\b(cust si|si needed|request si|submit si)\b|^(re_?\s*)?si\s+-\s/i, 2, 'subject: SI thread'],
  ['INVOICE_QUERY', /\b(invoice|billing|charges|total freight|d\s*&\s*d)\b/i, 1.5, 'subject: billing'],
  ['GENERAL', /\b(report|summary|planning|pending bl release|miss connection|time off|welcoming|outstanding bl)\b/i, 1, 'subject: operational'],
];

/* ------------------------------------------------------------------ classify */

export function attachmentKinds(atts: string[]) {
  const a = atts.map((x) => x.toLowerCase());
  const hasSI = a.some((x) => /(^|[_\-\s/])si\.[a-z0-9]+$/.test(x) || /shipping[_-]?instruction/.test(x));
  const hasBL = a.some((x) => /(^|[_\-\s/])bl\.[a-z0-9]+$/.test(x) || /bill[_-]?of[_-]?lading/.test(x));
  return { hasSI, hasBL };
}

export function classifyEmail(rec: EmailRecord): Classification {
  const body = cleanBody(rec.body || '');
  const subject = rec.subject || '';
  const full = `${subject}\n${body}`;
  const { hasSI, hasBL } = attachmentKinds(rec.attachments || []);

  const scores: Record<string, number> = {};
  for (const c of CATEGORY_ORDER) scores[c] = 0;
  const signals: string[] = [];
  const add = (cat: Category, w: number, sig: string) => {
    scores[cat] += w;
    signals.push(`${sig} (+${w} ${cat})`);
  };

  // 1. spam & phishing
  for (const [re, w, sig] of SPAM_RULES) if (re.test(full)) add('SPAM', w, sig);
  const domain = (rec.from.split('@')[1] || '').toLowerCase();
  if (SPAM_TLDS.test(domain) || SPAM_DOMAIN_WORDS.test(domain)) add('SPAM', 2, `untrusted sender domain ${domain}`);

  // 2. structure
  if (hasSI && hasBL) add('BL_COMPARISON', 6, 'SI + draft BL attached');
  else if (hasBL) add('BL_COMPARISON', 3, 'draft BL attached');
  else if (hasSI) add('SI_REQUEST', 2, 'SI attached without a BL');

  // 3. body intent (decisive) and subject intent (supporting)
  for (const [cat, re, w, sig] of BODY_RULES) if (re.test(body)) add(cat, w, sig);
  for (const [cat, re, w, sig] of SUBJECT_RULES) if (re.test(subject)) add(cat, w, sig);

  const ranked = CATEGORY_ORDER.map((c) => [c, scores[c]] as [Category, number]).sort((a, b) => b[1] - a[1]);
  let [category, top] = ranked[0];
  const second = ranked[1][1];
  if (top === 0) category = 'GENERAL';

  // confidence: absolute evidence × separation from the runner-up
  const strength = Math.min(1, top / 6);
  const margin = top > 0 ? (top - second) / top : 0;
  const confidence = top === 0 ? 0.4 : Math.round((0.35 + 0.65 * strength * (0.4 + 0.6 * margin)) * 100) / 100;

  let docIntent: DocIntent = 'none';
  if (category === 'BL_COMPARISON') {
    const asksToCompare =
      hasSI || hasBL || /\b(compare|check|verify|attached|enclosed|find attached)\b/i.test(body.replace(/\bfor checking\b/gi, ''));
    if (asksToCompare) docIntent = 'compare';
    else if (/\b(send|share|provide|forward)\b[^.\n]{0,20}\bdraft\s*b\/?l\b/i.test(body)) docIntent = 'request_document';
  }

  return { category, confidence, scores, signals, docIntent, decidedBy: 'rule' };
}
