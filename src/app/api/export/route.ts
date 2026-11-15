import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDB, mutate, audit } from '@/lib/store';
import { guarded } from '@/lib/auth';
import { fieldLabel } from '@/data/taxonomy';

export const dynamic = 'force-dynamic';

const cell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  // quote, and neutralise spreadsheet formulas (CSV injection)
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** CSV of every item (or ?source=live for uploads + imported email only). */
export const GET = guarded('viewer', async (user, req: NextRequest) => {
  const source = req.nextUrl.searchParams.get('source') ?? 'ALL';
  const db = await getDB();
  let items = Object.values(db.emails);
  if (source === 'live') items = items.filter((e) => e.source !== 'sample');
  items.sort((a, b) => a.seq - b.seq);
  const header = ['ID', 'Received', 'Source', 'From', 'Subject', 'Category', 'Status', 'Review reason', 'Mismatched fields', 'Read by AI', 'Summary', 'Reviewed by', 'Review action'];
  const rows = items.map((e) => [
    e.id,
    e.receivedAt ?? '',
    e.source ?? 'sample',
    e.from,
    e.subject,
    e.category,
    e.status,
    e.reviewReason ?? '',
    e.defectFields.map(fieldLabel).join('; '),
    e.aiRead ? 'yes' : '',
    e.summary,
    e.reviewed?.by ?? '',
    e.reviewed?.action ?? '',
  ]);
  const csv = '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  await mutate((d) => audit(d, user, 'export.csv', undefined, `${items.length} rows`));
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="cargotrust-checks-${stamp}.csv"`,
    },
  });
});
