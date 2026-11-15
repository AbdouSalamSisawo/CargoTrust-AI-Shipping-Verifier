/**
 * Label-variant extraction. The SI and the BL routinely name the same field
 * differently ("Port of Loading" vs "Load Port", "Gross Wt (kgs)" vs
 * "Gross Weight (KG)") — extraction aligns by meaning, never by header text.
 */
import { FIELD_KEYS, type FieldKey } from '@/data/taxonomy';
import type { ExtractedDoc } from '@/lib/types';
import { parseWeightKg, parseContainerCount } from './normalize';

type LabelMap = Record<FieldKey, RegExp>;

const LABELS: LabelMap = {
  shipper: /^(shipper|exporter)(\s*[/&]\s*(exporter|shipper))?\s*(\([^)]*\))?\s*[:\-]/i,
  consignee: /^(consignee|consigned to|deliver to|to(?:\s+the)?\s+order\s+of)\s*(\([^)]*\))?\s*[:\-]/i,
  notify_party: /^(notify(\s*(party|1|2|also))?(\s*\/\s*[a-z][a-z\s]*)?\s*(\([^)]*\))?\s*|attention\s*(\([^)]*\))?\s*)[:\-]/i,
  port_of_loading: /^(port of loading|load(ing)? port|port of load|pol)\s*(\([^)]*\))?\s*[:\-]/i,
  port_of_discharge:
    /^(port of discharge|discharge port|port of disch|pod|place of delivery|final destination)\s*(\([^)]*\))?\s*[:\-]/i,
  container_count:
    /^(no\.?\s*of\s*containers?(\s*(or|&|\/|and)\s*packages?)?|total\s*(no\.?\s*of\s*)?containers?|container count|number of containers?|containers?)\s*[:\-]/i,
  gross_weight_kg: /^(?!net\b|tare\b)gross\s*(cargo\s*)?(weight|wt)[^:\n]{0,14}[:\-]/i,
};

const BARE_WEIGHT = /^(?!net\b|tare\b)(weight|wt)[^:\n]{0,10}[:\-]/i;

function valueAfterLabel(line: string): string | null {
  const ci = line.indexOf(':');
  const di = line.indexOf('-');
  const idx = ci >= 0 ? ci : di;
  if (idx < 0) return null;
  const v = line.slice(idx + 1).trim();
  return v.length ? v : null;
}

export function extractDoc(text: string, docKind?: 'SI' | 'BL'): ExtractedDoc {
  const doc: ExtractedDoc = {
    found: {} as Record<FieldKey, boolean>,
    values: {},
    raw: {},
    lines: {},
    missing: [],
    completeness: 0,
    docKind,
  };
  for (const k of FIELD_KEYS) doc.found[k] = false;

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const t = line.replace(/\s+$/, '');
    if (!t.trim() || /^\s/.test(t)) continue; // skip indented continuation lines (addresses)
    for (const key of FIELD_KEYS) {
      if (doc.found[key]) continue;
      const labelRe = LABELS[key];
      let matched = labelRe.test(t.trim());
      // fallback: bare "Weight:" only for gross weight when nothing else matched
      if (!matched && key === 'gross_weight_kg' && !doc.found[key]) matched = BARE_WEIGHT.test(t.trim());
      if (!matched) continue;
      const value = valueAfterLabel(t.trim());
      if (!value) continue;
      // numeric fields must actually parse, otherwise treat as missing
      if (key === 'gross_weight_kg' && parseWeightKg(value) == null) continue;
      if (key === 'container_count' && parseContainerCount(value) == null) continue;
      doc.found[key] = true;
      doc.raw[key] = value.replace(/\s+/g, ' ');
      doc.lines[key] = t.trim();
      doc.values[key] = value.replace(/\s+/g, ' ');
    }
  }

  doc.missing = FIELD_KEYS.filter((k) => !doc.found[k]);
  doc.completeness = (FIELD_KEYS.length - doc.missing.length) / FIELD_KEYS.length;
  return doc;
}
