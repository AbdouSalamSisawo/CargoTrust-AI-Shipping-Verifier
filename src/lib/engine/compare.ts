/**
 * Field-by-field comparator. The SI is the reference. Each of the 7 fields is
 * compared with a type-aware rule (see normalize.ts): exact legal names, city
 * + UN/LOCODE for ports, exact numbers after unit conversion.
 */
import { FIELDS, FIELD_KEYS, type FieldKey } from '@/data/taxonomy';
import type { ExtractedDoc, FieldRow } from '@/lib/types';
import { sameName, samePort, parseWeightKg, parseContainerCount, partyName } from './normalize';

export function compareValue(key: FieldKey, a: string, b: string, ocr = false): boolean {
  if (key === 'gross_weight_kg') {
    const wa = parseWeightKg(a);
    const wb = parseWeightKg(b);
    return wa != null && wb != null && Math.abs(wa - wb) <= 0.5;
  }
  if (key === 'container_count') {
    const ca = parseContainerCount(a);
    const cb = parseContainerCount(b);
    return ca != null && ca === cb;
  }
  if (key === 'port_of_loading' || key === 'port_of_discharge') return samePort(a, b, ocr);
  return sameName(a, b, ocr);
}

/** Human-readable canonical value used in the report ("SI: 3 / BL: 4"). */
export function displayValue(key: FieldKey, raw: string | null): string | null {
  if (raw == null) return null;
  if (key === 'gross_weight_kg') {
    const kg = parseWeightKg(raw);
    return kg == null ? raw : `${kg.toLocaleString('en-US', { maximumFractionDigits: 1 })} kg`;
  }
  if (key === 'container_count') {
    const n = parseContainerCount(raw);
    return n == null ? raw : String(n);
  }
  if (key === 'shipper' || key === 'consignee' || key === 'notify_party') return partyName(raw);
  return raw;
}

export function compareDocs(
  si: ExtractedDoc,
  bl: ExtractedDoc,
  ocr = false,
): { rows: FieldRow[]; defectFields: FieldKey[]; matchedFields: FieldKey[] } {
  const rows: FieldRow[] = [];
  const defectFields: FieldKey[] = [];
  const matchedFields: FieldKey[] = [];
  for (const key of FIELD_KEYS) {
    const label = FIELDS.find((f) => f.key === key)!.label;
    const siRaw = si.found[key] ? si.raw[key] ?? null : null;
    const blRaw = bl.found[key] ? bl.raw[key] ?? null : null;
    let match: boolean | null = null;
    if (siRaw && blRaw) {
      match = compareValue(key, siRaw, blRaw, ocr);
      (match ? matchedFields : defectFields).push(key);
    }
    rows.push({
      field: key,
      label,
      si: displayValue(key, siRaw),
      bl: displayValue(key, blRaw),
      match,
      evidence: { si: si.lines[key], bl: bl.lines[key] },
    });
  }
  return { rows, defectFields, matchedFields };
}
