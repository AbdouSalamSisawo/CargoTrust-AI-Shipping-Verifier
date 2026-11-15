import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDB } from '@/lib/store';
import { guarded } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = guarded('viewer', async (_user, req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') ?? '').toLowerCase().trim();
  const category = sp.get('category') ?? 'ALL';
  const status = sp.get('status') ?? 'ALL';
  const source = sp.get('source') ?? 'ALL';
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(50, Math.max(5, parseInt(sp.get('pageSize') ?? '10', 10) || 10));

  const db = await getDB();
  let items = Object.values(db.emails);
  if (q)
    items = items.filter(
      (e) =>
        e.subject.toLowerCase().includes(q) ||
        e.from.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q),
    );
  if (category !== 'ALL') items = items.filter((e) => e.category === category);
  if (status !== 'ALL') items = items.filter((e) => e.status === status);
  if (source === 'live') items = items.filter((e) => e.source !== 'sample');
  else if (source !== 'ALL') items = items.filter((e) => e.source === source);

  // newest uploads / imports first, then the sample inbox in its original order
  items.sort((a, b) => (a.source === 'sample' ? 1 : 0) - (b.source === 'sample' ? 1 : 0) || (a.source === 'sample' ? a.seq - b.seq : b.seq - a.seq));
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pages);
  const slice = items.slice((safePage - 1) * pageSize, safePage * pageSize);

  return NextResponse.json({
    items: slice.map((e) => ({
      id: e.id,
      subject: e.subject,
      from: e.from,
      category: e.category,
      status: e.status,
      confidence: e.confidence,
      defectCount: e.defectFields.length,
      reviewReason: e.reviewReason,
      awaitingDocuments: !!e.awaitingDocuments,
      hasAttachments: e.attachments.length > 0,
      summary: e.summary,
      source: e.source ?? 'sample',
      receivedAt: e.receivedAt ?? null,
      aiRead: !!e.aiRead,
    })),
    total,
    page: safePage,
    pages,
  });
});
