/**
 * Weighted-intent classifier. Attachment structure (SI + BL pair) is the
 * strongest signal for a document-check request; keywords, sender reputation
 * and style heuristics cover the rest, including misleading subjects.
 */
import type { Category } from '@/data/taxonomy';
import { CATEGORY_ORDER } from '@/data/taxonomy';
import type { EmailRecord } from '@/lib/types';

export interface Classification {
  category: Category;
  confidence: number;
  scores: Record<string, number>;
  signals: string[];
}

const KEYWORD_RULES: [Category, RegExp, number, string][] = [
  ['BL_COMPARISON', /\b(draft\s*bl|bill\s*of\s*lading|b\/l)\b/i, 2.5, 'mentions draft BL'],
  ['BL_COMPARISON', /(check|verify|confirm|compare|validate|reconcile)\b[^.\n]{0,48}\b(docs?|documents|details|si|bl)\b/i, 2.5, 'document check request'],
  ['BL_COMPARISON', /\b(vs\.?|versus|against)\b[^.\n]{0,24}\b(si|bl)\b/i, 2, 'explicit SI/BL comparison'],
  ['SI_REQUEST', /\bshipping instruction\b/i, 2.5, 'mentions shipping instruction'],
  ['SI_REQUEST', /\b(new|revised|updated|amended|final)\s+(si|shipping instruction)\b/i, 2, 'SI submission'],
  ['SI_REQUEST', /\b(prepare|draft|submit|send|provide|find)\b[^.\n]{0,32}\b(si|shipping instruction)\b/i, 2, 'SI preparation request'],
  ['INVOICE_QUERY', /\binvoice\b/i, 2.5, 'mentions invoice'],
  ['INVOICE_QUERY', /\b(detention|demurrage|charges?|payment|remittance|credit note|billing|paid)\b/i, 1.5, 'billing topic'],
  ['SPAM', /(gift card|winner|lottery|prize|crypto|bitcoin|click here|act now|limited time|congratulations|inheritance|wire\s*\$?\d|free money|claim your)/i, 3, 'spam phrasing'],
  ['SPAM', /\b(urgent|immediate action|final notice|account (suspended|locked|compromised)|verify your account)\b/i, 2, 'urgency bait'],
  ['SPAM', /dear (customer|user|sir\/madam|account holder)/i, 2, 'generic greeting'],
  ['GENERAL', /(advisory|newsletter|update|notice|schedule|congestion|announcement|circular|bulletin|reminder)/i, 1.5, 'informational notice'],
];

const SPAM_TLDS = /\.(biz|top|xyz|click|online|shop|loan|surf|gq|tk|ml)$/;

export function classifyEmail(rec: EmailRecord): Classification {
  const text = `${rec.subject}\n${rec.body}`;
  const atts = rec.attachments.map((a) => a.toLowerCase());
  const hasSI = atts.some((a) => /_si\.[a-z]+$/.test(a) || /shipping[_-]?instruction/.test(a));
  const hasBL = atts.some((a) => /_bl\.[a-z]+$/.test(a) || /bill[_-]?of[_-]?lading/.test(a) || /[^a-z]bl\.[a-z]+$/.test(a));

  const scores: Record<string, number> = {};
  for (const c of CATEGORY_ORDER) scores[c] = 0;
  const signals: string[] = [];
  const add = (cat: Category, w: number, sig?: string) => {
    scores[cat] += w;
    if (sig && w >= 2) signals.push(sig);
  };

  // attachment structure — strongest structural evidence
  if (hasSI && hasBL) add('BL_COMPARISON', 6, 'SI + BL attachments');
  else if (hasSI) add('SI_REQUEST', 3, 'SI attachment only');
  else if (hasBL) add('BL_COMPARISON', 3, 'BL attachment only');

  for (const [cat, re, w, sig] of KEYWORD_RULES) if (re.test(text)) add(cat, w, sig);

  // sender / style heuristics
  const domain = (rec.from.split('@')[1] || '').toLowerCase();
  if (SPAM_TLDS.test(domain)) add('SPAM', 2.5, 'suspicious sender domain');
  if ((rec.body.match(/https?:\/\//g) || []).length >= 3) add('SPAM', 1.5, 'link-heavy body');
  if (rec.subject === rec.subject.toUpperCase() && rec.subject.length > 18 && /\$|!|free|win/i.test(rec.subject))
    add('SPAM', 1.5, 'shouty subject line');

  // a doc-check email with both documents is decisive unless it is obviously spam
  if (hasSI && hasBL && scores['SPAM'] < 4) add('BL_COMPARISON', 2);

  const entries = CATEGORY_ORDER.map((c) => [c, scores[c]] as [Category, number]).sort((a, b) => b[1] - a[1]);
  const [top, topScore] = entries[0];
  const runnerUp = entries[1]?.[1] ?? 0;
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  const confidence =
    topScore === 0
      ? 0.5
      : Math.min(0.99, Math.max(0.55, 0.55 + ((topScore - runnerUp) / total) * 0.55));
  return { category: top, confidence, scores, signals };
}
