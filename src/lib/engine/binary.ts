/**
 * Advanced-stage parsers: pull readable text out of PDF (text layer), Excel
 * and Word attachments so the comparison engine can process them. Image-only
 * scans yield (near-)empty text and stay `unreadable` → escalated to a human
 * instead of silently mis-parsed.
 *
 * PDF/DOCX text comes out in visual order where a label is often on its own
 * line with the value underneath (or beside it without a colon) — the
 * line-joining heuristic rebuilds strict "Label: value" lines the extractor
 * understands.
 */

const LABEL_PREFIX =
  /^(shipper|exporter|consignee|consigned to|deliver to|to(?:\s+the)?\s+order\s+of|notify|attention|port of loading|load(ing)? port|port of load|pol|port of discharge|discharge port|port of disch|pod|place of delivery|final destination|no\.?\s*of\s*(containers?|packages?)|total\s*(no\.?\s*of\s*)?containers?|container count|number of containers?|containers?|gross\s*(cargo\s*)?(weight|wt)|(?!net\b|tare\b)weight|wt)(?=[A-Z0-9(:\s\-]|$)[\s\S]{0,40}?$/i;

function isLabelStart(line: string): boolean {
  return LABEL_PREFIX.test(line.trim());
}

/** Split "Consignee (Non-Negotiable) BALL & DOGGETT" → ["Consignee (Non-Negotiable)", "BALL & DOGGETT"] */
function splitLabelValue(line: string): [string, string] | null {
  const m = line.trim().match(
    /^(shipper|exporter|consignee|consigned to|deliver to|to(?:\s+the)?\s+order\s+of|notify(\s*(party|1|2|also))?|attention|port of loading|load(ing)? port|port of load|pol|port of discharge|discharge port|port of disch|pod|place of delivery|final destination|no\.?\s*of\s*(containers?|packages?)(\s*(or|&|\/|and)\s*(packages?|containers?))?|total\s*(no\.?\s*of\s*)?containers?|container count|number of containers?|containers?|gross\s*(cargo\s*)?(weight|wt)|(?!net\b|tare\b)(weight|wt))(?=[A-Z0-9(:\s\-]|$)((\s*\/\s*[a-z][a-z\s]*)?\s*(\([^)]*\))?)\s*[:\-]?\s*(.*)$/i,
  );
  if (!m) return null;
  const label = m[1] + (m[5] ?? '');
  const value = (m[9] ?? '').trim();
  return [label, value];
}

/**
 * Rebuild strict "Label: value" lines from visual-order text: a label-only
 * line absorbs the following value lines (until a blank line or the next
 * label); a label and value sharing a line without a colon get the colon.
 */
export function joinLabelLines(raw: string): string {
  const lines = raw.split(/\r?\n/).map((l) => l.replace(/\s+$/, ''));
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (t && isLabelStart(t)) {
      const split = splitLabelValue(t);
      if (split) {
        const [label, value] = split;
        if (value) {
          out.push(`${label}: ${value}`);
          i += 1;
          continue;
        }
        const vals: string[] = [];
        let j = i + 1;
        while (j < lines.length && vals.length < 4) {
          const nx = lines[j].trim();
          if (!nx) break;
          if (isLabelStart(nx) && splitLabelValue(nx)) break;
          vals.push(nx);
          j += 1;
        }
        if (vals.length) {
          out.push(`${label}: ${vals.join(', ')}`);
          i = j;
          continue;
        }
      }
    }
    if (t) out.push(t);
    i += 1;
  }
  return out.join('\n');
}

/** Excel rows → "label: value" lines (first non-empty cell is the label). */
function sheetToLines(buf: Buffer): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const XLSX = require('xlsx') as typeof import('xlsx');
  const wb = XLSX.read(buf, { type: 'buffer' });
  const out: string[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: '' });
    for (const row of rows) {
      const cells = row.map((c) => String(c ?? '').trim()).filter((c) => c.length > 0);
      if (cells.length === 0) continue;
      if (cells.length === 1) out.push(cells[0]);
      else out.push(`${cells[0]}: ${cells.slice(1).join(' | ')}`);
    }
    out.push('');
  }
  return out.join('\n');
}

export async function extractTextFromBinary(ext: string, buf: Buffer): Promise<string | null> {
  try {
    if (ext === 'pdf') {
      const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default as unknown as (d: Buffer) => { text: string };
      const res = await pdfParse(buf);
      const text = (res.text || '').replace(/\u0000/g, '');
      const compact = text.replace(/\s+/g, '');
      if (compact.length < 40) return null; // image-only scan — nothing usable
      return joinLabelLines(text);
    }
    if (ext === 'xlsx' || ext === 'xls') {
      const text = sheetToLines(buf);
      return text.replace(/\s+/g, '').length >= 40 ? text : null;
    }
    if (ext === 'docx') {
      const mammoth = await import('mammoth');
      const res = await mammoth.extractRawText({ buffer: buf });
      const text = (res.value || '').replace(/\u0000/g, '');
      if (text.replace(/\s+/g, '').length < 40) return null;
      return joinLabelLines(text);
    }
    return null;
  } catch {
    return null;
  }
}
