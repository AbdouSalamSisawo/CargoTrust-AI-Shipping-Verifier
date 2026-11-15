import XLSX from 'xlsx';
import fs from 'fs';
for (const f of process.argv.slice(2)) {
  const wb = XLSX.read(fs.readFileSync('dataset/attachments/' + f));
  for (const n of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, blankrows: false });
    console.log('=====', f, n);
    for (const r of rows.slice(0, 22)) console.log(JSON.stringify(r));
  }
}
