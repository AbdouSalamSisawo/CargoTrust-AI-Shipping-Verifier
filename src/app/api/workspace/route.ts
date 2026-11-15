import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDB, mutate, audit, removeSampleData, loadSampleData, runPipeline, upsertEmail, recordOf, aiStatus } from '@/lib/store';
import { isScanMethod } from '@/lib/engine/readers';
import { guarded } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 600;

export const GET = guarded('admin', async () => {
  const db = await getDB();
  const all = Object.values(db.emails);
  const count = (s: string) => all.filter((e) => (e.source ?? 'sample') === s).length;
  return NextResponse.json({
    ok: true,
    sampleData: db.sampleData,
    counts: { sample: count('sample'), upload: count('upload'), email: count('email'), total: all.length },
    scans: all.filter((e) => e.attachments.some((a) => isScanMethod(a.method))).length,
    users: Object.keys(db.users).length,
    ai: aiStatus(db.settings),
  });
});

/**
 * Workspace maintenance (admin):
 *   remove-sample   drop the bundled sample inbox (your uploads stay)
 *   load-sample     (re)load the sample inbox
 *   rerun-scans     re-read every scanned document (e.g. after adding an AI key)
 */
export const POST = guarded('admin', async (user, req: NextRequest) => {
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };

  if (action === 'remove-sample') {
    const n = await mutate((db) => {
      const before = Object.keys(db.emails).length;
      removeSampleData(db);
      audit(db, user, 'workspace.sample_removed');
      return before - Object.keys(db.emails).length;
    });
    return NextResponse.json({ ok: true, message: `Removed ${n} sample items.` });
  }

  if (action === 'load-sample') {
    await mutate(async (db) => {
      await loadSampleData(db);
      audit(db, user, 'workspace.sample_loaded');
    });
    return NextResponse.json({ ok: true, message: 'Sample inbox loaded.' });
  }

  if (action === 'rerun-scans') {
    const db = await getDB();
    const targets = Object.values(db.emails).filter(
      (e) => e.attachments.some((a) => isScanMethod(a.method)) && e.reviewed?.action !== 'correct',
    );
    let changed = 0;
    for (const e of targets) {
      const fresh = await runPipeline(recordOf(e), db.settings);
      Object.assign(fresh, { source: e.source, createdBy: e.createdBy, messageId: e.messageId });
      if (fresh.status !== e.status || fresh.summary !== e.summary) changed++;
      await mutate((d) => upsertEmail(d, fresh));
    }
    await mutate((d) => audit(d, user, 'workspace.scans_rerun', undefined, `${targets.length} item(s), ${changed} updated`));
    return NextResponse.json({ ok: true, message: `Re-read ${targets.length} scanned item(s); ${changed} updated.` });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
});
