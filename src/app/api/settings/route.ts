import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { mutate } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = await mutate((db) => db.settings);
  return NextResponse.json(db);
}

export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const saved = await mutate((db) => {
    for (const key of ['spamFilter', 'requireEvidence', 'notifyOnMismatch', 'notifyOnReview', 'digest'] as const) {
      if (typeof body[key] === 'boolean') db.settings[key] = body[key] as boolean;
    }
    if (typeof body.autoApproveThreshold === 'number') {
      db.settings.autoApproveThreshold = Math.min(100, Math.max(0, Math.round(body.autoApproveThreshold)));
    }
    if (typeof body.sdocServerUrl === 'string' && body.sdocServerUrl.trim()) {
      db.settings.sdocServerUrl = body.sdocServerUrl.trim().replace(/\/+$/, '');
    }
    return db.settings;
  });
  return NextResponse.json({ ok: true, settings: saved });
}
