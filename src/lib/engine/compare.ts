/**
 * Field-by-field comparator. Each of the 7 canonical fields is compared with a
 * type-aware rule: exact numeric equality for counts/weights (after unit
 * canonicalization), LOCODE-first matching for ports, core-token containment
 * for legal names. Never fuzzy on numbers.
 */
import { FIELDS, FIELD_KEYS, type FieldKey } from '@/data/taxonomy';
import type { ExtractedDoc, FieldRow } from '@/lib/types';
import { sameName, samePort, parseWeightKg, parseContainerCount } from './normalize';

function compareValue(key: FieldKey, a: string, b: string): boolean {
  if (key === 'gross_weight_kg') {
    const wa = parseWeightKg(a);
    const wb = parseWeightKg(b);
    if (wa == null || wb == null) return false;
    return Math.abs(wa - wb) <= 0.5;
  }
  if (key === 'container_count') {
    const ca = parseContainerCount(a);
    const cb = parseContainerCount(b);
    if (ca == null || cb == null) return false;
    return ca === cb;
  }
  if (key === 'port_of_loading' || key === 'port_of_discharge') return samePort(a, b);
  return sameName(a, b);
}

export function compareDocs(
  si: ExtractedDoc,
  bl: ExtractedDoc,
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
      match = compareValue(key, siRaw, blRaw);
      if (match) matchedFields.push(key);
      else defectFields.push(key);
    }
    rows.push({
      field: key,
      label,
      si: siRaw,
      bl: blRaw,
      match,
      evidence: { si: si.lines[key], bl: bl.lines[key] },
    });
  }
  return { rows, defectFields, matchedFields };
}
