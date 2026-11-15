import { NextResponse } from 'next/server';
import { resetDB } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** Wipe results + reviews and re-run the engine over the shipped dataset. */
export async function POST() {
  await resetDB();
  return NextResponse.json({ ok: true });
}
