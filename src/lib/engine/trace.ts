/**
 * Decision trace — the engine's reasoning for one email, step by step, so a
 * reviewer (or a judge) can see exactly why it decided what it decided.
 * Pure function over a ProcessedEmail: runs on the server and in the browser.
 */
import { CATEGORIES, fieldLabel } from '@/data/taxonomy';
import type { ProcessedEmail } from '@/lib/types';

export type StepState = 'pass' | 'flag' | 'stop' | 'skip' | 'info';
export interface TraceStep { key: string; title: string; state: StepState; detail: string; items?: string[] }

export const METHOD_LABEL: Record<string, string> = {
  text: 'plain text',
  'pdf-text': 'PDF text layer (layout-aware)',
  'pdf-ocr': 'scanned PDF → OCR',
  'image-ocr': 'photo / image → OCR',
  docx: 'Word document (tables + line breaks)',
  xlsx: 'Excel workbook (label / value rows)',
  none: 'could not be read',
};

function topSignals(e: ProcessedEmail): string[] {
  const cat = e.category;
  return (e.signals ?? []).filter((s) => s.includes(`${cat})`)).slice(0, 4).map((s) => s.replace(/\s*\(\+[\d.]+ [A-Z_]+\)$/, ''));
}

export function buildTrace(e: ProcessedEmail): TraceStep[] {
  const steps: TraceStep[] = [];
  const conf = Math.round(e.confidence * 100);
  const by = e.decidedBy === 'llm' ? 'AI second opinion' : e.decidedBy === 'human' ? 'reviewer' : 'rules';
  steps.push({
    key: 'classify',
    title: `Classified as ${CATEGORIES[e.category].label}`,
    state: 'pass',
    detail: `${conf}% confidence · decided by ${by}. Body intent outranks the subject line, so a misleading subject cannot reroute the email.`,
    items: topSignals(e),
  });

  if (e.category !== 'BL_COMPARISON') {
    steps.push({ key: 'route', title: 'Routed — no document check needed', state: 'skip', detail: e.summary });
    return steps;
  }

  if (e.awaitingDocuments) {
    steps.push({ key: 'locate', title: 'No documents attached yet', state: 'info', detail: e.summary });
    return steps;
  }

  const si = e.attachments.find((a) => a.kind === 'SI');
  const bl = e.attachments.find((a) => a.kind === 'BL');
  if (e.reviewReason === 'missing_attachment') {
    steps.push({ key: 'locate', title: 'SI / draft BL pair incomplete', state: 'stop', detail: e.summary });
    return steps;
  }
  steps.push({
    key: 'locate',
    title: 'SI and draft BL located',
    state: 'pass',
    detail: `${si?.name ?? '—'} (reference) and ${bl?.name ?? '—'}.`,
    items: e.notes,
  });

  const readItems = e.attachments
    .filter((a) => a.kind !== 'other')
    .map((a) => {
      const how = a.ai && !a.ai.error ? `${METHOD_LABEL[a.method ?? 'text'] ?? a.method} + AI vision (${a.ai.model})` : METHOD_LABEL[a.method ?? 'text'] ?? a.method;
      return `${a.kind}: ${how}${a.ocrConfidence != null ? ` (OCR confidence ${a.ocrConfidence}%)` : ''}${a.error ? ` — ${a.error}` : ''}`;
    });
  const unreadable = e.attachments.some((a) => a.kind !== 'other' && !a.readable);
  const ocr = e.attachments.some((a) => a.method === 'pdf-ocr' || a.method === 'image-ocr');
  steps.push({
    key: 'read',
    title: unreadable ? 'A document could not be read' : ocr ? 'Scanned document read by OCR' : 'Documents read',
    state: unreadable ? 'stop' : ocr ? 'flag' : 'pass',
    detail: unreadable
      ? 'Corrupt, encrypted or garbled file — nothing can be compared safely.'
      : ocr
        ? 'No text layer: OCR produced a pre-check, but OCR can misread characters, so a human confirms.'
        : 'Every format is rebuilt into one canonical label / value layout before extraction.',
    items: readItems,
  });
  if (unreadable) return steps;

  if (e.extracted) {
    const kinds = [`SI content identifies as: ${e.extracted.si.detectedKind ?? '—'}`, `BL content identifies as: ${e.extracted.bl.detectedKind ?? '—'}`];
    const wrong = e.reviewReason === 'wrong_doc_type';
    steps.push({
      key: 'doctype',
      title: wrong ? 'Wrong document type' : 'Document types verified by content',
      state: wrong ? 'stop' : 'pass',
      detail: wrong ? e.summary : 'Checked from the document content, not trusted from the file name.',
      items: kinds,
    });
    if (wrong) return steps;

    const ph = { ...(e.extracted.si.placeholders ?? {}), ...(e.extracted.bl.placeholders ?? {}) };
    const missing = [...new Set([...e.extracted.si.missing, ...e.extracted.bl.missing])];
    const derived = [
      ...Object.entries(e.extracted.si.derived ?? {}).map(([k, v]) => `SI ${fieldLabel(k)}: ${v}`),
      ...Object.entries(e.extracted.bl.derived ?? {}).map(([k, v]) => `BL ${fieldLabel(k)}: ${v}`),
    ];
    steps.push({
      key: 'extract',
      title: missing.length ? `${missing.length} required value${missing.length > 1 ? 's' : ''} missing` : 'All 7 fields extracted from both documents',
      state: missing.length ? (ocr ? 'flag' : 'stop') : 'pass',
      detail: missing.length
        ? `Missing: ${missing.map((f) => `${fieldLabel(f)}${ph[f as keyof typeof ph] ? ` (placeholder "${ph[f as keyof typeof ph]}")` : ''}`).join(', ')}. A blank or placeholder is never treated as a match.`
        : 'Labels are aligned by meaning ("Load Port" = "Port of Loading"); every value keeps its source line.',
      items: derived,
    });
    if (missing.length && !ocr) return steps;
  }

  if (e.comparison) {
    const diff = e.comparison.rows.filter((r) => r.match === false);
    steps.push({
      key: 'compare',
      title: diff.length ? `${diff.length} of 7 fields differ` : 'All 7 fields agree',
      state: diff.length ? 'flag' : 'pass',
      detail: 'Exact legal names (formatting-tolerant), city + UN/LOCODE for ports, exact numbers after unit conversion.',
      items: diff.map((r) => `${r.label} — SI: ${r.si} / BL: ${r.bl}`),
    });
  }

  steps.push({
    key: 'decide',
    title: e.status === 'OK' ? 'Decision: no mismatch detected' : e.status === 'MISMATCH' ? 'Decision: mismatch — amend the draft BL' : 'Decision: escalated to a human',
    state: e.status === 'OK' ? 'pass' : e.status === 'MISMATCH' ? 'flag' : 'stop',
    detail: e.summary,
  });
  return steps;
}
