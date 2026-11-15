/**
 * Field extraction over the canonical layout produced by readers.ts.
 *
 * - Labels are aligned by meaning: "Port of Loading", "Load Port", "POL",
 *   "PORT OF LOADING (装货港)" all land in port_of_loading. Bilingual labels and
 *   parentheticals are stripped before matching.
 * - Values keep their source line as evidence; multi-line values (party name +
 *   address) are kept as blocks — the first line is the party name.
 * - Container count and gross weight fall back to the equipment table (count
 *   container-number rows, sum their weights) when no explicit total exists.
 * - Placeholders ("TBA", "____", "N/A") are treated as missing, never as values.
 * - OCR text gets fuzzy label matching ("Motify" → Notify, "Portof Leading").
 */
import { FIELD_KEYS, type FieldKey } from '@/data/taxonomy';
import type { ExtractedDoc } from '@/lib/types';
import { parseWeightKg, parseContainerCount, isPlaceholder } from './normalize';

interface Block { label: string; first: string; lines: string[]; source: string; index: number }

const LABEL_RULES: [FieldKey, RegExp][] = [
  ['notify_party', /^notify\b|^notify party\b|^also notify\b/],
  ['shipper', /^(shipper|exporter)\b/],
  ['consignee', /^(consignee|consigned to|to the order of|to order of)\b/],
  ['port_of_loading', /^(port of loading|port of load|load(ing)? port|pol)\b/],
  ['port_of_discharge', /^(port of discharge|port of disch|discharge port|pod)\b/],
  ['container_count', /^(no\.? of containers?|number of containers?|total containers?|container count|containers?(?! no\b)(?! number\b)(?! #))\b/],
  ['gross_weight_kg', /^(total )?gross (cargo )?(weight|wt)\b/],
];

/** Labels that look like fields but are not (never map these). */
const NOT_A_FIELD = /^(net|tare)\b|^(vessel|voy|booking|b\/?l|bill of lading no|hs code|freight|oc no|description|commodity|kinds of packages|container no|place of (receipt|delivery)|final destination)/;

/** Canonical label vocabulary used for OCR fuzzy matching. */
const OCR_VOCAB: [FieldKey, string][] = [
  ['shipper', 'shipper'], ['shipper', 'exporter'], ['consignee', 'consignee'], ['notify_party', 'notify'],
  ['notify_party', 'notify party'], ['port_of_loading', 'port of loading'], ['port_of_loading', 'load port'],
  ['port_of_discharge', 'port of discharge'], ['port_of_discharge', 'discharge port'],
  ['container_count', 'containers'], ['container_count', 'container count'], ['gross_weight_kg', 'gross weight'],
];

export function cleanLabel(raw: string): string {
  return raw
    .replace(/[^\x20-\x7e]/g, ' ') // bilingual labels: drop non-ASCII (毛重, 发货人 …)
    .replace(/\([^)]*\)/g, ' ') // parentheticals: (POL), (KGS), (Non-Negotiable)
    .toLowerCase()
    .replace(/[^a-z0-9/&. ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

export function fieldForLabel(rawLabel: string, fuzzy = false): FieldKey | null {
  const l = cleanLabel(rawLabel);
  if (!l || NOT_A_FIELD.test(l)) return null;
  for (const [key, re] of LABEL_RULES) if (re.test(l)) return key;
  if (fuzzy) {
    const squashed = l.replace(/[^a-z]/g, '');
    let best: [FieldKey | null, number] = [null, 99];
    for (const [key, word] of OCR_VOCAB) {
      const w = word.replace(/\s/g, '');
      const d = lev(squashed, w);
      if (d < best[1]) best = [key, d];
    }
    if (best[0] && best[1] <= Math.max(1, Math.floor(squashed.length / 5))) return best[0];
  }
  return null;
}

/** Split canonical text into label blocks (label line + indented continuations). */
export function parseBlocks(text: string, ocr = false): { blocks: Block[]; lines: string[] } {
  const lines = text.split('\n');
  const blocks: Block[] = [];
  let cur: Block | null = null;
  lines.forEach((line, index) => {
    if (!line.trim()) { cur = null; return; }
    if (/^\s/.test(line)) {
      if (cur) cur.lines.push(line.trim());
      return;
    }
    // OCR drops colons: "Containers 6 x 40'HC", "Gross Weight 128544 KG"
    const m =
      line.match(/^([^:|]{1,70}?)\s*:\s*(.*)$/) ||
      (ocr ? line.match(/^([A-Za-z][A-Za-z ]{2,30}?)\s*[;.]\s+(\S.*)$/) || line.match(/^([A-Za-z][A-Za-z ]{2,30}?)\s+(\S.*)$/) : null);
    if (m && !/\|/.test(line)) {
      cur = { label: m[1].trim(), first: m[2].trim(), lines: [], source: line.trim(), index };
      blocks.push(cur);
    } else {
      cur = null;
    }
  });
  return { blocks, lines };
}

const CONTAINER_NO = /\b[A-Z]{4}\d{7}\b/;

function tableFallback(lines: string[]) {
  const rows = lines.filter((l) => /\|/.test(l) && CONTAINER_NO.test(l));
  if (!rows.length) return null;
  let total = 0;
  let weighed = 0;
  for (const r of rows) {
    const cells = r.split('|').map((c) => c.trim());
    const w = cells.reverse().find((c) => /^\d{1,3}(,\d{3})*(\.\d+)?$|^\d+(\.\d+)?$/.test(c));
    if (w) {
      total += parseFloat(w.replace(/,/g, ''));
      weighed++;
    }
  }
  return { count: rows.length, weight: weighed === rows.length ? total : null, rows };
}

export interface ExtractOptions { docKind?: 'SI' | 'BL'; method?: string; ocr?: boolean }

export function extractDoc(text: string, opts: ExtractOptions | 'SI' | 'BL' = {}): ExtractedDoc {
  const o: ExtractOptions = typeof opts === 'string' ? { docKind: opts } : opts;
  const ocr = !!o.ocr;
  const doc: ExtractedDoc = {
    found: {} as Record<FieldKey, boolean>,
    values: {},
    raw: {},
    lines: {},
    missing: [],
    placeholders: {},
    derived: {},
    completeness: 0,
    docKind: o.docKind,
    method: o.method,
  };
  for (const k of FIELD_KEYS) doc.found[k] = false;

  const { blocks, lines } = parseBlocks(text, ocr);

  // prefer an explicit TOTAL gross weight over a per-line one
  const ordered = [...blocks].sort((a, b) => {
    const ta = /total/i.test(a.label) ? 0 : 1;
    const tb = /total/i.test(b.label) ? 0 : 1;
    return ta - tb || a.index - b.index;
  });

  for (const b of ordered) {
    const key = fieldForLabel(b.label, ocr);
    if (!key || doc.found[key] || doc.placeholders![key]) continue;
    const valueLines = [b.first, ...b.lines].filter(Boolean);
    const first = valueLines[0] ?? '';
    if (!first || isPlaceholder(first)) {
      doc.placeholders![key] = first || '(blank)';
      doc.lines[key] = b.source;
      continue;
    }
    if (key === 'gross_weight_kg' && parseWeightKg(first) == null) continue;
    if (key === 'container_count' && parseContainerCount(first) == null) continue;
    doc.found[key] = true;
    doc.raw[key] = first.replace(/\s+/g, ' ');
    doc.values[key] = valueLines.join('\n');
    doc.lines[key] = b.source;
  }

  // equipment-table fallback for count / weight
  const table = tableFallback(lines);
  if (table) {
    if (!doc.found.container_count && !doc.placeholders!.container_count) {
      doc.found.container_count = true;
      doc.raw.container_count = String(table.count);
      doc.values.container_count = `${table.count} (counted from the container table)`;
      doc.lines.container_count = table.rows[0];
      doc.derived!.container_count = `counted ${table.count} container rows in the equipment table`;
    }
    if (!doc.found.gross_weight_kg && !doc.placeholders!.gross_weight_kg && table.weight != null) {
      doc.found.gross_weight_kg = true;
      doc.raw.gross_weight_kg = `${table.weight} KG`;
      doc.values.gross_weight_kg = `${table.weight} KG (sum of the container table)`;
      doc.lines.gross_weight_kg = table.rows[0];
      doc.derived!.gross_weight_kg = `summed ${table.count} container weights`;
    }
  }

  doc.missing = FIELD_KEYS.filter((k) => !doc.found[k]);
  doc.completeness = (FIELD_KEYS.length - doc.missing.length) / FIELD_KEYS.length;
  return doc;
}

/* ------------------------------------------------------- document type check */

export type DetectedKind = 'SI' | 'BL' | 'INVOICE' | 'PACKING_LIST' | 'CERTIFICATE' | 'UNKNOWN';

export function detectKind(text: string, doc: ExtractedDoc): DetectedKind {
  const head = text.slice(0, 600).toUpperCase();
  const all = text.toUpperCase();
  if (/COMMERCIAL INVOICE|NOT A SHIPPING INSTRUCTION|INVOICE NO\.?\s*:/.test(all) && !/BILL OF LADING \(DRAFT\)/.test(head)) return 'INVOICE';
  if (/PACKING LIST/.test(all)) return 'PACKING_LIST';
  if (/CERTIFICATE OF ORIGIN/.test(all)) return 'CERTIFICATE';
  if (/SHIPPING INSTRUCTION|BL INSTRUCTION|BILL OF LADING INSTRUCTION|\bS\.I\.\b/.test(head)) return 'SI';
  if (/BILL OF LADING|\bB\/L\b/.test(head)) return 'BL';
  return doc.completeness >= 0.6 ? (doc.docKind ?? 'UNKNOWN') : 'UNKNOWN';
}
