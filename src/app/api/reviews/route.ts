import { NextResponse } from 'next/server';
import { getDB } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = await getDB();
  const cases = Object.values(db.reviews)
    .sort((a, b) => a.id.localeCompare(b.id))
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
}
