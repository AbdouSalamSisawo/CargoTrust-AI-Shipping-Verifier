import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDB, mutate } from '@/lib/store';
import { runSelfTest } from '@/lib/metrics';
import { guarded } from '@/lib/auth';
import { isScanMethod } from '@/lib/engine/readers';
import { readAttachment } from '@/lib/dataset';
import { runRobustness } from '@/lib/engine/robustness';

export const dynamic = 'force-dynamic';

export const GET = guarded('viewer', async () => {
  const db = await getDB();
  const runs = [...db.evalRuns].sort((a, b) => b.at.localeCompare(a.at));
  return NextResponse.json({ runs, latest: runs[0] ?? null });
});

export const POST = guarded('operator', async (_user, req: NextRequest) => {
  const body = (await req.json().catch(() => ({}))) as { action?: string };

  if (body.action === 'run') {
    const run = await mutate((db) => {
      const r = runSelfTest('v1');
      db.evalRuns.push(r);
      if (db.evalRuns.length > 20) db.evalRuns = db.evalRuns.slice(-20);
      return r;
    });
    return NextResponse.json({ ok: true, run });
  }

  if (body.action === 'robustness') {
    // every clean SI/BL pair the engine judged OK → rewritten hundreds of ways
    const db = await getDB();
    const pairs: { id: string; si: string; bl: string }[] = [];
    for (const e of Object.values(db.emails)) {
      if (e.status !== 'OK' || !e.extracted) continue;
      const si = e.attachments.find((a) => a.kind === 'SI');
      const bl = e.attachments.find((a) => a.kind === 'BL');
      if (!si || !bl) continue;
      const [st, bt] = await Promise.all([readAttachment(si.path), readAttachment(bl.path)]);
      if (st.text && bt.text && !isScanMethod(st.method) && !isScanMethod(bt.method)) pairs.push({ id: e.id, si: st.text, bl: bt.text });
    }
    return NextResponse.json({ ok: true, report: runRobustness(pairs) });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
});
