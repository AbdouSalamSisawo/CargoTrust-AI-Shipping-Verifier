import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
const [f, from = '0', n = '200'] = process.argv.slice(2);
const doc = await getDocument({ data: new Uint8Array(fs.readFileSync('dataset/attachments/' + f)), verbosity: 0 }).promise;
for (let p = 1; p <= doc.numPages; p++) {
  const tc = await (await doc.getPage(p)).getTextContent();
  const its = tc.items.filter((i) => i.str.trim());
  console.log('===', f, 'page', p, 'items', its.length);
  for (const it of its.slice(+from, +from + +n)) console.log(Math.round(it.transform[4]), Math.round(it.transform[5]), it.fontName.slice(-2), JSON.stringify(it.str));
}
