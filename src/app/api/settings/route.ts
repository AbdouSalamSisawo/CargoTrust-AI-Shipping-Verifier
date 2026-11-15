import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDB, mutate, audit, aiStatus } from '@/lib/store';
import { guarded } from '@/lib/auth';
import type { Settings } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Settings without secrets: the API key never leaves the server. */
function publicSettings(s: Settings) {
  const { aiApiKey: _secret, ...rest } = s;
  void _secret;
  return { ...rest, ai: aiStatus(s) };
}

export const GET = guarded('viewer', async () => {
  const db = await getDB();
  return NextResponse.json(publicSettings(db.settings));
});

export const PUT = guarded('admin', async (user, req: NextRequest) => {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const saved = await mutate((db) => {
    const changed: string[] = [];
    const s = db.settings;
    for (const key of ['spamFilter', 'requireEvidence', 'notifyOnMismatch', 'notifyOnReview', 'digest', 'aiEnabled'] as const) {
      if (typeof body[key] === 'boolean' && s[key] !== body[key]) {
        s[key] = body[key] as boolean;
        changed.push(`${key}=${s[key]}`);
      }
    }
    if (typeof body.autoApproveThreshold === 'number') {
      s.autoApproveThreshold = Math.min(100, Math.max(0, Math.round(body.autoApproveThreshold)));
    }
    if (typeof body.organisation === 'string' && body.organisation.trim()) {
      s.organisation = body.organisation.trim().slice(0, 80);
      changed.push('organisation');
    }
    if (body.aiScanPolicy === 'confirm' || body.aiScanPolicy === 'auto') {
      if (s.aiScanPolicy !== body.aiScanPolicy) changed.push(`aiScanPolicy=${body.aiScanPolicy}`);
      s.aiScanPolicy = body.aiScanPolicy;
    }
    if (typeof body.aiModel === 'string' && /^[a-z0-9.\-]{3,64}$/.test(body.aiModel.trim())) {
      s.aiModel = body.aiModel.trim();
      changed.push(`aiModel=${s.aiModel}`);
    }
    if (typeof body.aiApiKey === 'string') {
      const k = body.aiApiKey.trim();
      s.aiApiKey = k || undefined;
      changed.push(k ? 'AI key updated' : 'AI key removed');
    }
    if (changed.length) audit(db, user, 'settings.updated', undefined, changed.join(', '));
    return s;
  });
  return NextResponse.json({ ok: true, settings: publicSettings(saved) });
});
