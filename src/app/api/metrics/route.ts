import { NextResponse } from 'next/server';
import { getDB } from '@/lib/store';
import { computeMetrics } from '@/lib/metrics';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = await getDB();
  return NextResponse.json(computeMetrics(db));
}
