import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDB, mutate } from '@/lib/store';
import { runSelfTest } from '@/lib/metrics';
import { buildSubmission } from '@/lib/submission';
import { PRODUCT } from '@/data/taxonomy';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = await getDB();
  const runs = [...db.evalRuns].sort((a, b) => b.at.localeCompare(a.at));
  return NextResponse.json({ runs, latest: runs[0] ?? null, sdocUrl: db.settings.sdocServerUrl });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { action?: string };

  if (body.action === 'run') {
    const run = await mutate((db) => {
      const r = runSelfTest(PRODUCT.engine);
      db.evalRuns.push(r);
      if (db.evalRuns.length > 20) db.evalRuns = db.evalRuns.slice(-20);
      return r;
    });
    return NextResponse.json({ ok: true, run });
  }

  if (body.action === 'score') {
    const db = await getDB();
    const submission = buildSubmission(db);
    const base = (db.settings.sdocServerUrl || 'http://localhost:8080').replace(/\/+$/, '');
    try {
      const r = await fetch(base + '/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission),
        signal: AbortSignal.timeout(8000),
      });
      const data = await r.json().catch(() => ({ raw: 'non-JSON response' }));
      return NextResponse.json({ ok: r.ok, httpStatus: r.status, data });
    } catch {
      return NextResponse.json({
        ok: false,
        error: `Could not reach the SDOC server at ${base}. Start it with \`docker compose up --build\` from the organizer bundle (or set the URL in Settings), then retry.`,
      });
    }
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
