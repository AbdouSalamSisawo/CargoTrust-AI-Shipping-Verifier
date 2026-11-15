import { NextResponse } from 'next/server';
import { getDB } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** Liveness / readiness probe for Docker and load balancers. */
export async function GET() {
  try {
    const db = await getDB();
    return NextResponse.json({ ok: true, items: Object.keys(db.emails).length });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
