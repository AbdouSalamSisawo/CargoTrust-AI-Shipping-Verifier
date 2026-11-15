import { NextResponse } from 'next/server';
import { getDB } from '@/lib/store';
import { guarded } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = guarded('viewer', async () => {
  const db = await getDB();
  const cases = Object.values(db.reviews)
    .sort((a, b) => (db.emails[b.emailId]?.source === 'sample' ? 0 : 1) - (db.emails[a.emailId]?.source === 'sample' ? 0 : 1) || a.id.localeCompare(b.id))
    .map((c) => {
      const e = db.emails[c.emailId];
      return {
        ...c,
        email: e
          ? {
              id: e.id,
              subject: e.subject,
              from: e.from,
              category: e.category,
              confidence: e.confidence,
              status: e.status,
              attachments: e.attachments.map((a) => ({ name: a.name, kind: a.kind, readable: a.readable, ext: a.ext })),
            }
          : null,
      };
    });
  return NextResponse.json({ open: cases.filter((c) => c.status === 'open'), resolved: cases.filter((c) => c.status === 'resolved') });
});
