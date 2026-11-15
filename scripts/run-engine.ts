/**
 * Offline engine run: processes the whole dataset without the web server and
 * writes out/submission.json (official shape) + out/results.json (full detail).
 *
 *   npm run engine            # run
 *   npm run score             # run + grade with the organizers' scorer (if present in .local/)
 */
import fs from 'fs/promises';
import path from 'path';
import { loadInbox, readAttachment } from '@/lib/dataset';
import { processEmail } from '@/lib/engine/pipeline';
import type { ProcessedEmail } from '@/lib/types';

async function main() {
  const t0 = Date.now();
  const inbox = await loadInbox();
  const results: Record<string, ProcessedEmail> = {};
  for (const rec of inbox) {
    const reads: Record<string, Awaited<ReturnType<typeof readAttachment>>> = {};
    for (const p of rec.attachments) reads[p] = await readAttachment(p);
    results[rec.email_id] = processEmail(rec, reads);
  }
  const submission: Record<string, unknown> = {};
  for (const id of Object.keys(results).sort()) {
    const e = results[id];
    submission[id] = {
      category: e.category,
      status: e.status,
      review_reason: e.reviewReason ?? null,
      defect_fields: e.defectFields,
      has_defect: e.hasDefect,
    };
  }
  const out = path.join(process.cwd(), 'out');
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(path.join(out, 'submission.json'), JSON.stringify(submission, null, 2));
  await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(results, null, 2));

  const tally = (k: keyof ProcessedEmail) =>
    Object.values(results).reduce<Record<string, number>>((m, e) => {
      const v = String(e[k]);
      m[v] = (m[v] || 0) + 1;
      return m;
    }, {});
  console.log(`processed ${inbox.length} emails in ${Date.now() - t0} ms`);
  console.log('category', tally('category'));
  console.log('status  ', tally('status'));
  console.log('reason  ', tally('reviewReason'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
