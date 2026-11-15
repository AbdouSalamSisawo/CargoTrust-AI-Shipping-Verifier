/**
 * npm run robustness — mutation benchmark over every clean SI/BL pair.
 * Writes out/robustness.json.
 */
import fs from 'fs/promises';
import path from 'path';
import { loadInbox, readAttachment } from '@/lib/dataset';
import { processEmail, docKindOf } from '@/lib/engine/pipeline';
import { runRobustness } from '@/lib/engine/robustness';
import { shutdownReaders } from '@/lib/engine/readers';

async function main() {
  const inbox = await loadInbox();
  const pairs: { id: string; si: string; bl: string }[] = [];
  for (const rec of inbox) {
    const reads: Record<string, Awaited<ReturnType<typeof readAttachment>>> = {};
    for (const p of rec.attachments) reads[p] = await readAttachment(p);
    const e = processEmail(rec, reads);
    if (e.status !== 'OK' || !e.extracted) continue;
    const siP = rec.attachments.find((p) => docKindOf(p) === 'SI');
    const blP = rec.attachments.find((p) => docKindOf(p) === 'BL');
    const si = siP && reads[siP].text;
    const bl = blP && reads[blP].text;
    if (si && bl) pairs.push({ id: rec.email_id, si, bl });
  }
  const r = runRobustness(pairs);
  await fs.mkdir(path.join(process.cwd(), 'out'), { recursive: true });
  await fs.writeFile(path.join(process.cwd(), 'out', 'robustness.json'), JSON.stringify(r, null, 2));
  console.log(`clean pairs: ${r.pairs}`);
  console.log(`benign rewrites stayed OK : ${r.benign.stayedOk}/${r.benign.total} (${(r.benign.rate * 100).toFixed(1)}%)`);
  console.log(`planted defects exact     : ${r.defect.exact}/${r.defect.total} (${(r.defect.rate * 100).toFixed(1)}%)`);
  for (const m of r.perMutation) console.log(`  ${m.kind.padEnd(6)} ${m.id.padEnd(20)} ${m.passed}/${m.total}`);
  for (const f of r.failures.slice(0, 15)) console.log('  FAIL', f.emailId, f.mutation, JSON.stringify(f.got));
  await shutdownReaders();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
