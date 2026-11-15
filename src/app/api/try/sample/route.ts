import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

/** Raw bytes of one public dataset attachment — powers the playground's sample buttons. */
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('file') ?? '';
  if (!/^email_\d{3}_(SI|BL)\.(txt|pdf|docx|xlsx)$/.test(name)) {
    return NextResponse.json({ error: 'Unknown sample' }, { status: 400 });
  }
  try {
    const buf = await fs.readFile(path.join(process.cwd(), 'dataset', 'attachments', name));
    return new NextResponse(new Uint8Array(buf), {
      headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'public, max-age=86400' },
    });
  } catch {
    return NextResponse.json({ error: 'Sample not found' }, { status: 404 });
  }
}
