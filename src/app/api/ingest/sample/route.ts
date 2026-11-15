import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { guarded } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Raw bytes of a bundled sample document — powers the "try a sample" buttons on New check. */
export const GET = guarded('viewer', async (_user, req: NextRequest) => {
  const name = req.nextUrl.searchParams.get('file') ?? '';
  if (!/^email_\d{3}_(SI|BL)\.(txt|pdf|docx|xlsx)$/.test(name)) {
    return NextResponse.json({ error: 'Unknown sample' }, { status: 400 });
  }
  try {
    const buf = await fs.readFile(path.join(process.cwd(), 'dataset', 'attachments', name));
    return new NextResponse(new Uint8Array(buf), { headers: { 'Content-Type': 'application/octet-stream' } });
  } catch {
    return NextResponse.json({ error: 'Sample not found' }, { status: 404 });
  }
});
