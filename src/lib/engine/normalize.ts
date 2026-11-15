/**
 * Value normalizers — canonicalize the messy ways the same shipment fact is
 * written across documents (legal suffixes, LOCODE vs plain names, kg vs MT).
 * Comparison of numerics is always exact on the parsed value, never fuzzy.
 */

const LEGAL_SUFFIXES = new Set([
  'PTE', 'LTD', 'LIMITED', 'LLC', 'LLP', 'INC', 'INCORPORATED', 'CORP', 'CORPORATION',
  'CO', 'COMPANY', 'SDN', 'BHD', 'BERHAD', 'GMBH', 'AG', 'SA', 'SAC', 'SAS', 'NV', 'BV',
  'BVBA', 'AB', 'AS', 'OY', 'KFT', 'SPA', 'SRL', 'PVT', 'FZE', 'FZC', 'FZCO', 'DMCC',
  'KK', 'PT', 'TBK', 'YK', 'THE', 'AND', 'OF', 'CO', 'KG', 'JP', 'UK', 'US',
]);

export function normalizeName(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^\p{L}\p{N}& ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function nameTokens(raw: string): string[] {
  return normalizeName(raw)
    .split(' ')
    .filter((t) => t && t.length > 1 && !LEGAL_SUFFIXES.has(t));
}

/** Legal-name equality via core-token containment (handles "PTE LTD" vs "LTD"). */
export function sameName(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return true;
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return false;
  const sa = new Set(ta);
  const sb = new Set(tb);
  const inter = ta.filter((t) => sb.has(t)).length;
  const min = Math.min(sa.size, sb.size);
  const max = Math.max(sa.size, sb.size);
  if (min > 0 && inter === min) return true; // token containment
  return inter / max >= 0.8; // near-identical sets
}

export interface ParsedPort { locode: string | null; name: string }

/** "PORT KLANG (WESTPORT), MALAYSIA (MYPKG)" → { locode: 'MYPKG', name: 'PORT KLANG (WESTPORT), MALAYSIA' } */
export function parsePort(raw: string): ParsedPort {
  const m = raw.match(/\(\s*([A-Z]{5})\s*\)\s*$/);
  const locode = m ? m[1] : null;
  const name = (locode ? raw.replace(/\(\s*[A-Z]{5}\s*\)\s*$/, '') : raw)
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { locode, name };
}

export function samePort(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const pa = parsePort(a);
  const pb = parsePort(b);
  const na = pa.name.toUpperCase();
  const nb = pb.name.toUpperCase();
  const nameOk = sameName(pa.name, pb.name) || na.includes(nb) || nb.includes(na);
  if (pa.locode && pb.locode) {
    // A matching LOCODE alone is not enough — the planted hard cases keep the
    // code but change the city ("TUTICORIN, INDIA (KEMBA)"). Require the names
    // to be compatible, or share at least one significant token.
    if (pa.locode !== pb.locode) return false;
    if (nameOk) return true;
    const inter = nameTokens(pa.name).filter((t) => nameTokens(pb.name).includes(t));
    return inter.length > 0;
  }
  return nameOk;
}

/** "21,577 KG" / "21.577 MT" / "48,000 LBS" → kilograms. */
export function parseWeightKg(raw: string): number | null {
  const flat = raw.replace(/,/g, '');
  const m = flat.match(/([\d.]+)\s*(KGS?|KILOGRAMS?|MT|TONS?|TONNES?|LBS?)\b/i);
  if (m) {
    const v = parseFloat(m[1]);
    const u = m[2].toUpperCase();
    if (u.startsWith('K')) return v;
    if (u === 'MT' || u.startsWith('TON')) return v * 1000;
    if (u.startsWith('LB')) return v * 0.453592;
  }
  const bare = flat.match(/[\d.]+/);
  return bare ? parseFloat(bare[0]) : null;
}

/** "3 x 40'HC" / "3 X 40HC" / "3" → container count (equipment kept for display only). */
export function parseContainerCount(raw: string): number | null {
  const m = raw.match(/(\d+)\s*[xX×]\s*\d/);
  if (m) return parseInt(m[1], 10);
  const bare = raw.match(/\d+/);
  return bare ? parseInt(bare[0], 10) : null;
}
