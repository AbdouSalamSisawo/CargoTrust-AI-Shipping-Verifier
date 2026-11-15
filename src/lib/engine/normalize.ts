/**
 * Value normalizers — decide when two differently-written values are the SAME
 * fact, without ever letting a real difference through.
 *
 * Parties: exact on the legal name after formatting is removed. Punctuation,
 *   case, "&"/"AND" and legal-form spellings (LTD/LIMITED, CO/COMPANY) are
 *   formatting. A different or extra word is NOT — "APRIL FINE PAPER TRADING"
 *   and "APRIL FINE PAPER TRADING (MIDDLE EAST) FZE" are different entities.
 *   The address is not compared: documents legitimately omit it.
 * Ports: the city must agree, and when both sides carry a UN/LOCODE the codes
 *   must agree too (a planted trap keeps the code and swaps the city).
 * Numbers: exact after unit conversion (MT → kg, lbs → kg). Never fuzzy.
 */

const LEGAL_FORMS: Record<string, string> = {
  LIMITED: 'LTD', COMPANY: 'CO', CORPORATION: 'CORP', INCORPORATED: 'INC', PRIVATE: 'PVT',
  BERHAD: 'BHD', PROPRIETARY: 'PTY', INTERNATIONAL: 'INTL', AND: '&',
};

const PLACEHOLDER = /^(tba|tbc|tbd|n\/?a|nil|none|null|pending|unknown|to be (advised|confirmed)|\?+|-+|x{3,}|\.{3,}|_+.*|.*_{3,}.*)$/i;

export function isPlaceholder(v: string | null | undefined): boolean {
  if (v == null) return true;
  const t = v.trim();
  return !t || PLACEHOLDER.test(t);
}

/** Uppercase, strip punctuation, canonical legal forms. */
export function normalizeName(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/&/g, ' & ')
    .replace(/[^\p{L}\p{N}& ]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => LEGAL_FORMS[t] ?? t)
    .join(' ');
}

/** The party name — first line of the block, before any " | " address split. */
export function partyName(raw: string): string {
  return raw.split('\n')[0].split(/\s+\|\s+/)[0].trim();
}

export function sameName(a?: string | null, b?: string | null, ocr = false): boolean {
  if (!a || !b) return false;
  const na = normalizeName(partyName(a));
  const nb = normalizeName(partyName(b));
  if (na === nb) return true;
  // OCR drops and inserts spaces ("ALGURG" vs "AL GURG") — compare squashed
  if (ocr) return na.replace(/\s/g, '') === nb.replace(/\s/g, '');
  return false;
}

export interface ParsedPort { locode: string | null; city: string; country: string; name: string }

/** "PORT KLANG (WESTPORT), MALAYSIA (MYPKG)" → { locode: MYPKG, city: PORT KLANG WESTPORT, country: MALAYSIA } */
export function parsePort(raw: string): ParsedPort {
  const s = raw.toUpperCase().trim();
  const m = s.match(/\(\s*([A-Z]{2}\s?[A-Z0-9]{3})\s*\)\s*$/);
  const locode = m ? m[1].replace(/\s/g, '') : null;
  const name = (m ? s.slice(0, m.index) : s).trim().replace(/[,\s]+$/, '');
  const [cityRaw, ...rest] = name.split(',');
  const clean = (x: string) => x.replace(/[^A-Z0-9/ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  return { locode, city: clean(cityRaw), country: clean(rest.join(' ')), name };
}

export function samePort(a?: string | null, b?: string | null, ocr = false): boolean {
  if (!a || !b) return false;
  const pa = parsePort(a);
  const pb = parsePort(b);
  if (pa.locode && pb.locode && pa.locode !== pb.locode) return false;
  const squash = (x: string) => x.replace(/[^A-Z0-9]/g, '');
  const cityOk = ocr ? squash(pa.city) === squash(pb.city) : pa.city === pb.city || squash(pa.city) === squash(pb.city);
  if (!cityOk) return false;
  // country is optional ("SINGAPORE" vs "SINGAPORE, SINGAPORE") but may not conflict
  if (pa.country && pb.country && squash(pa.country) !== squash(pb.country)) return false;
  return true;
}

/** Locale-aware number: "21,577" / "21.577,50" (EU) / "21577.5". */
function parseNumber(s: string): number | null {
  const t = s.replace(/\s/g, '');
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return parseFloat(t.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) return parseFloat(t.replace(/,/g, ''));
  if (/^\d+([.,]\d+)?$/.test(t)) return parseFloat(t.replace(',', '.'));
  return null;
}

/** "21,577 KG" / "21.577 MT" / "48,000 LBS" / "243588" → kilograms. */
export function parseWeightKg(raw: string): number | null {
  if (isPlaceholder(raw)) return null;
  const s = raw.toUpperCase().replace(/(\d)\s+(?=\d{3}\b)/g, '$1');
  const m = s.match(/(\d[\d.,]*)\s*(KGS?|KILOS?|KILOGRAMS?|MT|M\/T|TONS?|TONNES?|LBS?|POUNDS?)?/);
  if (!m) return null;
  const u = m[2] || 'KG';
  const tonnes = u === 'MT' || u === 'M/T' || u.startsWith('TON');
  // a tonnage is small: "21.577 MT" / "21,577 MT" are 21.577 t, not 21,577 t
  const v = tonnes && /^\d{1,4}[.,]\d{1,3}$/.test(m[1]) ? parseFloat(m[1].replace(',', '.')) : parseNumber(m[1]);
  if (v == null) return null;
  if (u.startsWith('K')) return v;
  if (u === 'MT' || u === 'M/T' || u.startsWith('TON')) return v * 1000;
  if (u.startsWith('LB') || u.startsWith('POUND')) return v * 0.45359237;
  return v;
}

/** "3 x 40'HC" / "3 X 40HC" / "3" / "THREE (3)" → container count. */
export function parseContainerCount(raw: string): number | null {
  if (isPlaceholder(raw)) return null;
  const x = raw.match(/(\d+)\s*[xX×*]\s*\d/);
  if (x) return parseInt(x[1], 10);
  const paren = raw.match(/\((\d+)\)/);
  if (paren) return parseInt(paren[1], 10);
  const bare = raw.match(/\b\d+\b/);
  return bare ? parseInt(bare[0], 10) : null;
}
