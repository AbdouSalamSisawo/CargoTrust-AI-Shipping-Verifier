/**
 * Mutation robustness benchmark — evidence that the engine generalises beyond
 * the 520 emails it was developed on.
 *
 * Every clean (OK) SI/BL pair in the inbox is rewritten many ways:
 *
 *   BENIGN mutations  — the same shipment written differently. Must stay OK.
 *     relabel (Port of Loading → Load Port / POL …), kg → metric tons,
 *     EU number format, legal-form spellings (LTD ↔ LIMITED, CO., ↔ CO),
 *     case changes, dropped address lines, dropped UN/LOCODE on one side.
 *
 *   DEFECT mutations  — one planted discrepancy. Must be flagged on exactly
 *     that field and nothing else: weight ±, container count ±, a different
 *     party, an extra word in a legal name, a port city swapped while the
 *     UN/LOCODE stays (the dataset's hardest trap).
 *
 * Mutations are applied to the BL (the SI is the reference), deterministically.
 */
import { FIELD_KEYS, type FieldKey } from '@/data/taxonomy';
import { extractDoc, parseBlocks, fieldForLabel } from './extract';
import { compareDocs } from './compare';
import { parseWeightKg, parseContainerCount, parsePort } from './normalize';

const cityOf = (v: string) => parsePort(v).city.replace(/[^A-Z0-9]/g, '');

export interface Mutation {
  id: string;
  kind: 'benign' | 'defect';
  label: string;
  /** For defect mutations: the field that must be flagged. */
  field?: FieldKey;
  apply: (text: string, ctx: Ctx) => string | null;
}

interface Ctx { parties: string[]; ports: string[] }

const SYNONYMS: Record<FieldKey, string[]> = {
  shipper: ['Shipper', 'SHIPPER/EXPORTER', 'Exporter', 'Shipper (Principal or Seller)'],
  consignee: ['Consignee', 'CONSIGNEE (Non-Negotiable)', 'Consigned to'],
  notify_party: ['Notify Party', 'NOTIFY', 'Notify Party/Intermediate Consignee'],
  port_of_loading: ['Port of Loading', 'Load Port', 'POL', 'PORT OF LOADING (装货港)'],
  port_of_discharge: ['Port of Discharge', 'Discharge Port', 'POD', 'Port of Discharge (POD)'],
  container_count: ['No. of Containers', 'Total Containers', 'Container Count', 'Number of containers'],
  gross_weight_kg: ['Gross Weight (KG)', 'Gross Wt (kgs)', 'GROSS WEIGHT', 'Total Gross Weight'],
};

/** Locate the label line of a field and rewrite it. */
function editField(text: string, key: FieldKey, fn: (label: string, value: string) => [string, string] | null): string | null {
  const lines = text.split('\n');
  const { blocks } = parseBlocks(text);
  const b = blocks.find((x) => fieldForLabel(x.label) === key);
  if (!b) return null;
  const out = fn(b.label, b.first);
  if (!out) return null;
  lines[b.index] = `${out[0]}: ${out[1]}`;
  return lines.join('\n');
}

function dropContinuations(text: string, key: FieldKey): string | null {
  const lines = text.split('\n');
  const { blocks } = parseBlocks(text);
  const b = blocks.find((x) => fieldForLabel(x.label) === key);
  if (!b || !b.lines.length) return null;
  lines.splice(b.index + 1, b.lines.length);
  return lines.join('\n');
}

const pick = <T,>(arr: T[], seed: number) => arr[Math.abs(seed) % arr.length];
const seedOf = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

export const MUTATIONS: Mutation[] = [
  /* ---------------------------------------------------------- benign */
  {
    id: 'relabel-all', kind: 'benign', label: 'every label replaced by a synonym',
    apply: (t) => {
      let out: string | null = t;
      for (const k of FIELD_KEYS) {
        const next: string | null = out && editField(out, k, (l, v) => [pick(SYNONYMS[k].filter((s) => s !== l), seedOf(l + k)), v]);
        if (next) out = next;
      }
      return out === t ? null : out;
    },
  },
  {
    id: 'weight-mt', kind: 'benign', label: 'gross weight written in metric tons',
    apply: (t) => editField(t, 'gross_weight_kg', (l, v) => {
      const kg = parseWeightKg(v);
      return kg == null ? null : [l, `${(kg / 1000).toFixed(3)} MT`];
    }),
  },
  {
    id: 'weight-eu', kind: 'benign', label: 'gross weight in European number format',
    apply: (t) => editField(t, 'gross_weight_kg', (l, v) => {
      const kg = parseWeightKg(v);
      return kg == null || kg < 1000 ? null : [l, `${kg.toLocaleString('de-DE')} KGS`];
    }),
  },
  {
    id: 'legal-form', kind: 'benign', label: 'legal-form spelling (LTD ↔ LIMITED, CO., ↔ CO)',
    apply: (t) => {
      for (const k of ['consignee', 'shipper', 'notify_party'] as FieldKey[]) {
        const out = editField(t, k, (l, v) => {
          const w = v.replace(/\bLTD\b\.?/g, 'LIMITED').replace(/\bCO\.,?/g, 'COMPANY').replace(/\bPTE\.\s/g, 'PTE ');
          return w === v ? null : [l, w];
        });
        if (out) return out;
      }
      return null;
    },
  },
  {
    id: 'case', kind: 'benign', label: 'party names in title case',
    apply: (t) => editField(t, 'consignee', (l, v) => [l, v.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())]),
  },
  {
    id: 'drop-address', kind: 'benign', label: 'consignee address omitted',
    apply: (t) => dropContinuations(t, 'consignee') ?? dropContinuations(t, 'shipper'),
  },
  {
    id: 'drop-locode', kind: 'benign', label: 'UN/LOCODE omitted on the BL',
    apply: (t) => editField(t, 'port_of_discharge', (l, v) => (/\([A-Z]{5}\)\s*$/.test(v) ? [l, v.replace(/\s*\([A-Z]{5}\)\s*$/, '')] : null)),
  },
  {
    id: 'count-words', kind: 'benign', label: 'container count as "N X 40\'HC" / bare number',
    apply: (t) => editField(t, 'container_count', (l, v) => {
      const n = parseContainerCount(v);
      return n == null ? null : [l, /x/i.test(v) ? String(n) : `${n} X 40'HC`];
    }),
  },
  /* ---------------------------------------------------------- defects */
  {
    id: 'weight-plus', kind: 'defect', field: 'gross_weight_kg', label: 'gross weight +1,000 kg',
    apply: (t) => editField(t, 'gross_weight_kg', (l, v) => {
      const kg = parseWeightKg(v);
      return kg == null ? null : [l, `${(kg + 1000).toLocaleString('en-US')} KG`];
    }),
  },
  {
    id: 'weight-digit', kind: 'defect', field: 'gross_weight_kg', label: 'gross weight off by 10 kg (digit typo)',
    apply: (t) => editField(t, 'gross_weight_kg', (l, v) => {
      const kg = parseWeightKg(v);
      return kg == null ? null : [l, `${(kg + 10).toLocaleString('en-US')} KG`];
    }),
  },
  {
    id: 'count-plus', kind: 'defect', field: 'container_count', label: 'container count +1',
    apply: (t) => editField(t, 'container_count', (l, v) => {
      const n = parseContainerCount(v);
      return n == null ? null : [l, v.replace(String(n), String(n + 1))];
    }),
  },
  {
    id: 'party-swap', kind: 'defect', field: 'consignee', label: 'consignee replaced by another company',
    apply: (t, ctx) => editField(t, 'consignee', (l, v) => {
      const other = ctx.parties.find((p) => p.toUpperCase() !== v.toUpperCase());
      return other ? [l, other] : null;
    }),
  },
  {
    id: 'party-extra-word', kind: 'defect', field: 'shipper', label: 'shipper legal name with an extra word',
    apply: (t) => editField(t, 'shipper', (l, v) => [l, `${v} (MIDDLE EAST)`]),
  },
  {
    id: 'port-city-keep-code', kind: 'defect', field: 'port_of_discharge', label: 'discharge city changed, UN/LOCODE kept',
    apply: (t, ctx) => editField(t, 'port_of_discharge', (l, v) => {
      const other = ctx.ports.find((p) => cityOf(p) !== cityOf(v));
      if (!other) return null;
      const code = v.match(/\([A-Z]{5}\)\s*$/)?.[0] ?? '';
      return [l, `${other.replace(/\s*\([A-Z]{5}\)\s*$/, '')}${code ? ' ' + code : ''}`];
    }),
  },
  {
    id: 'pol-swap', kind: 'defect', field: 'port_of_loading', label: 'port of loading replaced',
    apply: (t, ctx) => editField(t, 'port_of_loading', (l, v) => {
      const other = ctx.ports.find((p) => cityOf(p) !== cityOf(v));
      return other ? [l, other] : null;
    }),
  },
];

export interface RobustnessReport {
  pairs: number;
  benign: { total: number; stayedOk: number; rate: number };
  defect: { total: number; exact: number; rate: number };
  perMutation: { id: string; kind: string; label: string; total: number; passed: number }[];
  failures: { emailId: string; mutation: string; got: string[] }[];
}

/** pairs: canonical SI/BL texts of emails the engine judged OK. */
export function runRobustness(pairs: { id: string; si: string; bl: string }[]): RobustnessReport {
  const parties = new Set<string>();
  const ports = new Set<string>();
  for (const p of pairs) {
    const d = extractDoc(p.si, 'SI');
    for (const k of ['shipper', 'consignee', 'notify_party'] as FieldKey[]) if (d.raw[k]) parties.add(d.raw[k]!);
    for (const k of ['port_of_loading', 'port_of_discharge'] as FieldKey[]) if (d.raw[k]) ports.add(d.raw[k]!);
  }
  const ctxBase = { parties: [...parties], ports: [...ports] };

  const per = new Map(MUTATIONS.map((m) => [m.id, { id: m.id, kind: m.kind, label: m.label, total: 0, passed: 0 }]));
  const failures: RobustnessReport['failures'] = [];
  let bT = 0, bP = 0, dT = 0, dP = 0;

  for (const p of pairs) {
    const si = extractDoc(p.si, 'SI');
    const s = seedOf(p.id);
    const ctx = { parties: [...ctxBase.parties.slice(s % 7), ...ctxBase.parties], ports: [...ctxBase.ports.slice(s % 5), ...ctxBase.ports] };
    for (const m of MUTATIONS) {
      const mutated = m.apply(p.bl, ctx);
      if (!mutated) continue;
      const bl = extractDoc(mutated, 'BL');
      const cmp = compareDocs(si, bl);
      const missing = [...si.missing, ...bl.missing];
      const got = missing.length ? [`missing:${missing.join(',')}`] : cmp.defectFields;
      const ok = m.kind === 'benign' ? got.length === 0 : got.length === 1 && got[0] === m.field;
      const row = per.get(m.id)!;
      row.total++;
      if (ok) row.passed++;
      else if (failures.length < 50) failures.push({ emailId: p.id, mutation: m.id, got });
      if (m.kind === 'benign') { bT++; if (ok) bP++; } else { dT++; if (ok) dP++; }
    }
  }
  return {
    pairs: pairs.length,
    benign: { total: bT, stayedOk: bP, rate: bT ? bP / bT : 0 },
    defect: { total: dT, exact: dP, rate: dT ? dP / dT : 0 },
    perMutation: [...per.values()],
    failures,
  };
}
