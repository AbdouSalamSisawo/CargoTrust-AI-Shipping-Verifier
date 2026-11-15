import { NextResponse } from 'next/server';
import { getDB } from '@/lib/store';
import { computeMetrics } from '@/lib/metrics';
import { guarded } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = guarded('viewer', async () => {
  const db = await getDB();
  return NextResponse.json(computeMetrics(db));
});
