/**
 * Document readers. Every format — plain text, PDF (text layer or scanned),
 * Word, Excel — is rebuilt into one canonical layout the extractor reads:
 *
 *     Label: value
 *       continuation line (address, second name line …)
 *     cell | cell | cell            ← table rows
 *
 * Layout is reconstructed from geometry, not from the raw text stream: PDF
 * items are grouped into lines by their y-coordinate and split into cells by
 * horizontal gaps; Word tables keep their soft line breaks; Excel rows keep
 * their label / value columns. The canonical text is also what the source
 * viewer shows, so every highlighted evidence line is exactly what the engine
 * read.
 */
import os from 'os';
import path from 'path';

export type ReadMethod = 'text' | 'pdf-text' | 'pdf-ocr' | 'docx' | 'xlsx' | 'none';

export interface ReadResult {
  text: string | null;
  method: ReadMethod;
  /** OCR mean word confidence, 0–100 (scanned documents only). */
  ocrConfidence?: number;
  /** Why a document could not be read. */
  error?: string;
}

type Format = 'pdf' | 'docx' | 'xlsx' | 'text' | 'unknown';

/** Detect the real format from the bytes — extensions lie. */
export function sniffFormat(buf: Buffer, ext: string): Format {
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b) {
    const head = buf.subarray(0, Math.min(buf.length, 4096)).toString('latin1');
    if (/word\//.test(head) || ext === 'docx') return 'docx';
    if (/xl\//.test(head) || ext === 'xlsx') return 'xlsx';
    return ext === 'docx' ? 'docx' : ext === 'xlsx' ? 'xlsx' : 'unknown';
  }
  // text: mostly printable UTF-8
  const sample = buf.subarray(0, 4096).toString('utf8');
  const bad = (sample.match(/[\u0000-\u0008\u000e-\u001f�]/g) || []).length;
  if (sample.length && bad / sample.length < 0.02) return 'text';
  return 'unknown';
}

export async function readDocument(ext: string, buf: Buffer): Promise<ReadResult> {
  const fmt = sniffFormat(buf, ext.toLowerCase());
  try {
    switch (fmt) {
      case 'text':
        return { text: buf.toString('utf8').replace(/\r\n?/g, '\n'), method: 'text' };
      case 'pdf':
        return await readPdf(buf);
      case 'docx':
        return { text: await readDocx(buf), method: 'docx' };
      case 'xlsx':
        return { text: await readXlsx(buf), method: 'xlsx' };
      default:
        return { text: null, method: 'none', error: 'unrecognised or binary-garbled file' };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { text: null, method: 'none', error: `${fmt.toUpperCase()} could not be opened (${msg})` };
  }
}

/* ======================================================================= PDF */

interface Item { x: number; y: number; w: number; s: string }

async function loadPdfjs() {
  // legacy build runs in plain Node (no DOM)
  return import('pdfjs-dist/legacy/build/pdf.mjs');
}

async function readPdf(buf: Buffer): Promise<ReadResult> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), verbosity: 0, isEvalSupported: false }).promise;
  const pages: string[] = [];
  let chars = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const items: Item[] = [];
    for (const it of tc.items as Array<{ str: string; transform: number[]; width: number }>) {
      if (!it.str || !it.str.trim()) continue;
      items.push({ x: it.transform[4], y: it.transform[5], w: it.width, s: it.str });
      chars += it.str.trim().length;
    }
    pages.push(layoutPdfPage(items));
  }
  if (chars >= 40) return { text: pages.join('\n\n'), method: 'pdf-text' };
  // no text layer → scanned image: OCR it
  const ocr = await ocrPdf(doc);
  return { text: ocr.text, method: 'pdf-ocr', ocrConfidence: ocr.confidence };
}

/** Group positioned text items into lines and cells, then render canonically. */
export function layoutPdfPage(items: Item[]): string {
  if (!items.length) return '';
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Item[][] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last[0].y - it.y) <= 2.5) last.push(it);
    else lines.push([it]);
  }
  const minX = Math.min(...items.map((i) => i.x));
  const out: string[] = [];
  for (const line of lines) {
    line.sort((a, b) => a.x - b.x);
    // merge items into cells: a gap wider than ~2 spaces starts a new cell
    const cells: { x: number; s: string }[] = [];
    let end = -Infinity;
    for (const it of line) {
      const gap = it.x - end;
      if (cells.length && gap < 12) cells[cells.length - 1].s += (gap > 1.5 ? ' ' : '') + it.s;
      else cells.push({ x: it.x, s: it.s });
      end = it.x + it.w;
    }
    const texts = cells.map((c) => c.s.replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (!texts.length) continue;
    if (texts.length === 1) {
      out.push(cells[0].x > minX + 40 ? `  ${texts[0]}` : texts[0]);
    } else if (texts.length === 2 && !/:/.test(texts[0])) {
      out.push(`${texts[0].replace(/[:\s]+$/, '')}: ${texts[1]}`);
    } else {
      out.push(texts.join(' | '));
    }
  }
  return out.join('\n');
}

/* ======================================================================= OCR */

type TessWorker = { recognize: (img: Buffer) => Promise<{ data: { text: string; confidence: number } }> };
let workerPromise: Promise<TessWorker> | null = null;

async function getOcrWorker(): Promise<TessWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const w = await createWorker('eng', 1, { cachePath: path.join(os.tmpdir(), 'cargotrust-tessdata') });
      return w as unknown as TessWorker;
    })();
  }
  return workerPromise;
}

async function ocrPdf(doc: { numPages: number; getPage: (n: number) => Promise<unknown> }) {
  const { createCanvas } = await import('@napi-rs/canvas');
  const worker = await getOcrWorker();
  const texts: string[] = [];
  const confs: number[] = [];
  for (let p = 1; p <= Math.min(doc.numPages, 5); p++) {
    const page = (await doc.getPage(p)) as {
      getViewport: (o: { scale: number }) => { width: number; height: number };
      render: (o: unknown) => { promise: Promise<void> };
    };
    const vp = page.getViewport({ scale: 4 }); // small scan fonts need ~4x for Tesseract
    const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    const { data } = await worker.recognize(canvas.toBuffer('image/png'));
    texts.push(data.text);
    confs.push(data.confidence);
  }
  const confidence = confs.length ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : 0;
  return { text: texts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim(), confidence };
}

/* ====================================================================== DOCX */

const XML_ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unxml = (s: string) => s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => XML_ENT[e]);

function paraText(p: string): string {
  let out = '';
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:br\b[^>]*\/>|<w:cr\b[^>]*\/>|<w:tab\b[^>]*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(p))) {
    if (m[1] !== undefined) out += unxml(m[1]);
    else if (m[0].startsWith('<w:tab')) out += '\t';
    else out += '\n';
  }
  return out;
}

function renderPair(label: string, valueLines: string[]): string[] {
  const vals = valueLines.map((v) => v.trim()).filter(Boolean);
  if (!vals.length) return [`${label.replace(/[:\s]+$/, '')}:`];
  return [`${label.replace(/[:\s]+$/, '')}: ${vals[0]}`, ...vals.slice(1).map((v) => `  ${v}`)];
}

async function readDocx(buf: Buffer): Promise<string> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new Error('missing word/document.xml');
  const body = xml.match(/<w:body>([\s\S]*)<\/w:body>/)?.[1] ?? xml;
  const out: string[] = [];
  const block = /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g;
  let m: RegExpExecArray | null;
  while ((m = block.exec(body))) {
    const s = m[0];
    if (s.startsWith('<w:tbl')) {
      for (const tr of s.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || []) {
        const cells = (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || []).map((tc) =>
          (tc.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []).map(paraText).join('\n'),
        );
        const nonEmpty = cells.filter((c) => c.trim());
        if (cells.length === 2 && nonEmpty.length >= 1) out.push(...renderPair(cells[0].replace(/\s+/g, ' ').trim(), cells[1].split('\n')));
        else if (nonEmpty.length) out.push(nonEmpty.map((c) => c.replace(/\s+/g, ' ').trim()).join(' | '));
      }
    } else {
      const t = paraText(s);
      for (const line of t.split('\n')) if (line.trim()) out.push(line.replace(/\t+/g, '   ').trimEnd());
    }
  }
  return out.join('\n');
}

/* ====================================================================== XLSX */

async function readXlsx(buf: Buffer): Promise<string> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buf, { type: 'buffer' });
  const out: string[] = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: false, blankrows: false });
    for (const row of rows) {
      const cells = (row as unknown[]).map((c) => (c == null ? '' : String(c).trim()));
      const nonEmpty = cells.filter(Boolean);
      if (!nonEmpty.length) continue;
      if (nonEmpty.length === 2 && cells.indexOf(nonEmpty[0]) < cells.indexOf(nonEmpty[1])) {
        // "NAME | address; address" → name on the label line, address as continuation
        const [first, ...rest] = nonEmpty[1].split(/\s+\|\s+/);
        out.push(...renderPair(nonEmpty[0], [first, ...rest]));
      } else {
        out.push(nonEmpty.join(' | '));
      }
    }
    out.push('');
  }
  return out.join('\n').trim();
}
