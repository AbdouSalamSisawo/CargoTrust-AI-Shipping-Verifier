import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
for (const f of process.argv.slice(2)) {
  const data = new Uint8Array(fs.readFileSync('dataset/attachments/' + f));
  try {
    const doc = await getDocument({ data, verbosity: 0 }).promise;
    console.log('=====', f, 'pages', doc.numPages);
    const page = await doc.getPage(1);
    const tc = await page.getTextContent();
    const styles = tc.styles;
    for (const it of tc.items.slice(0, 70)) if (it.str.trim()) console.log(Math.round(it.transform[4]), Math.round(it.transform[5]), styles[it.fontName]?.fontFamily, it.fontName, JSON.stringify(it.str));
  } catch (e) { console.log('=====', f, 'ERR', e.message); }
}
