import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDB } from '@/lib/store';
import { guarded } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Activity log, newest first. ?q= filters by user, action, target or detail. */
export const GET = guarded('operator', async (_user, req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') ?? '').toLowerCase().trim();
  const limit = Math.min(500, Math.max(10, parseInt(sp.get('limit') ?? '200', 10) || 200));
  const db = await getDB();
  let events = db.audit;
  if (q) {
    events = events.filter((e) =>
      [e.userName, e.action, e.target ?? '', e.detail ?? ''].some((v) => v.toLowerCase().includes(q)),
    );
  }
  return NextResponse.json({ ok: true, total: events.length, events: events.slice(0, limit) });
});
