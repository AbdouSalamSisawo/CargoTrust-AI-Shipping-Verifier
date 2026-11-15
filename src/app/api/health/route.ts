import { NextResponse } from 'next/server';
import { getDB, storageBackend } from '@/lib/store';
import { filesBackend } from '@/lib/files';

export const dynamic = 'force-dynamic';

/** Liveness / readiness probe for Docker and load balancers. */
export async function GET() {
  try {
    const db = await getDB();
    return NextResponse.json({ ok: true, items: Object.keys(db.emails).length, storage: storageBackend(), files: filesBackend() });
  } catch (e) {
    console.error('[cargotrust] health check failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
