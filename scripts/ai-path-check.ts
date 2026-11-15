/**
 * Offline check of the AI-reading decision path (no API key needed).
 *
 * Feeds the pipeline a scan whose OCR text is degraded and whose AI
 * transcription is clean — exactly the shape vision.ts returns — and checks:
 *   1. policy "confirm": the scan is escalated with an AI pre-check
 *   2. policy "auto":    a clear AI read is decided like a text document
 *   3. an AI read with unclear fields is escalated even under "auto"
 *   4. a planted mismatch in the AI read is caught on the right field
 *
 * Run: npm run check:ai
 */
import { processEmail } from '@/lib/engine/pipeline';
import type { ReadResult } from '@/lib/engine/readers';

const SI = `SHIPPING INSTRUCTION
Shipper: APRIL FAR EAST (M) SDN BHD
  TOWER 2, AVENUE 5, LEVEL 6
Consignee: CERIEX
  ZONE INDUSTRIELLE, CONAKRY, GUINEA
Notify Party: CERIEX
Port of Loading: SHANGHAI, CHINA (CNSHA)
Port of Discharge: CONAKRY, GUINEA (GNCKY)
No. of Containers: 6 x 20'FCL
Gross Weight: 143,940 KGS`;

const BL = SI.replace('SHIPPING INSTRUCTION', 'BILL OF LADING (DRAFT)');
const OCR_NOISE = (t: string) => t.replace(/A/g, '4').replace(/E/g, '€').replace(/:/g, ' ');

const scan = (ai: string, unclear: string[] = []): ReadResult => ({
  text: OCR_NOISE(ai),
  method: 'image-ocr',
  ocrConfidence: 58,
  ai: { text: ai, model: 'claude-opus-5-5', unclear },
});

const rec = {
  email_id: 'ai-check',
  from: 'ops@example.com',
  subject: 'Please check SI vs draft BL',
  body: 'Please check the attached SI and draft BL and revert with any discrepancy.',
  attachments: ['scan_SI.jpg', 'scan_BL.jpg'],
  attachmentKinds: { 'scan_SI.jpg': 'SI', 'scan_BL.jpg': 'BL' } as Record<string, 'SI' | 'BL'>,
};

let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  → ${detail}`}`);
  if (!ok) failures++;
};

{
  const e = processEmail(rec, { 'scan_SI.jpg': scan(SI), 'scan_BL.jpg': scan(BL) }, { aiScanPolicy: 'confirm' });
  check('confirm: AI-read scan goes to a human', e.status === 'NEEDS_REVIEW' && e.reviewReason === 'unreadable' && !!e.aiRead, `${e.status} ${e.summary}`);
  check('confirm: pre-check says all fields agree', /all 7 fields agree/.test(e.summary), e.summary);
}
{
  const e = processEmail(rec, { 'scan_SI.jpg': scan(SI), 'scan_BL.jpg': scan(BL) }, { aiScanPolicy: 'auto' });
  check('auto: clear AI read is decided', e.status === 'OK', `${e.status} ${e.summary}`);
}
{
  const e = processEmail(rec, { 'scan_SI.jpg': scan(SI), 'scan_BL.jpg': scan(BL, ['Gross Weight']) }, { aiScanPolicy: 'auto' });
  check('auto: unclear field still escalates', e.status === 'NEEDS_REVIEW' && /hard to read/.test(e.summary), `${e.status} ${e.summary}`);
}
{
  const bad = BL.replace('143,940 KGS', '134,940 KGS');
  const e = processEmail(rec, { 'scan_SI.jpg': scan(SI), 'scan_BL.jpg': scan(bad) }, { aiScanPolicy: 'auto' });
  check('auto: planted weight mismatch caught', e.status === 'MISMATCH' && e.defectFields.join() === 'gross_weight_kg', `${e.status} ${e.defectFields}`);
}
{
  const failed: ReadResult = { text: OCR_NOISE(SI), method: 'image-ocr', ocrConfidence: 58, ai: { text: null, model: 'claude-opus-5-5', unclear: [], error: 'the Anthropic API key was rejected' } };
  const e = processEmail(rec, { 'scan_SI.jpg': failed, 'scan_BL.jpg': failed }, { aiScanPolicy: 'auto' });
  check('AI failure falls back to OCR and escalates', e.status === 'NEEDS_REVIEW' && (e.notes ?? []).some((n) => n.includes('read by OCR only')), `${e.status} ${e.notes}`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll AI-path checks passed');
process.exit(failures ? 1 : 0);
