import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDB, aiStatus } from '@/lib/store';
import { guarded } from '@/lib/auth';
import { testAiConnection } from '@/lib/engine/vision';

export const dynamic = 'force-dynamic';

/** Check that a key (the one typed in, or the configured one) can reach the model. */
export const POST = guarded('admin', async (_user, req: NextRequest) => {
  const body = (await req.json().catch(() => ({}))) as { apiKey?: string; model?: string };
  const db = await getDB();
  const apiKey = body.apiKey?.trim() || process.env.ANTHROPIC_API_KEY || db.settings.aiApiKey;
  const model = body.model?.trim() || aiStatus(db.settings).model;
  if (!apiKey) return NextResponse.json({ ok: false, error: 'No API key configured yet.' });
  return NextResponse.json(await testAiConnection({ apiKey, model }));
});
