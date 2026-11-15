import { NextResponse } from 'next/server';
import { guarded, toPublic } from '@/lib/auth';
import { getDB, aiStatus } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** The signed-in user plus workspace facts the console shell needs. */
export const GET = guarded('viewer', async (user) => {
  const db = await getDB();
  return NextResponse.json({
    ok: true,
    user: toPublic(user),
    organisation: db.settings.organisation,
    ai: { active: aiStatus(db.settings).active },
  });
});
