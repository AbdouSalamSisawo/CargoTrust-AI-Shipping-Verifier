import { NextResponse } from 'next/server';
import { getDB } from '@/lib/store';
import { buildSubmission } from '@/lib/submission';

export const dynamic = 'force-dynamic';

/** Official-format submission (sample_submission.json shape) — every email present. */
export async function GET() {
  const db = await getDB();
  const submission = buildSubmission(db);
  return new NextResponse(JSON.stringify(submission, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="submission.json"',
    },
  });
}
