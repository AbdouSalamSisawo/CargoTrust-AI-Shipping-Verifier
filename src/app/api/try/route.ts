import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { extractDoc } from '@/lib/engine/extract';
import { compareDocs } from '@/lib/engine/compare';

export const dynamic = 'force-dynamic';

/**
 * Public playground: run the real extraction + comparison on pasted SI/BL
 * text. Nothing is stored — this mirrors the "Try it yourself" pattern judges
 * can use without touching the dataset.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { si?: string; bl?: string };
  const siText = (body.si ?? '').trim();
  const blText = (body.bl ?? '').trim();
  if (!siText || !blText) {
    return NextResponse.json({ error: 'Both a Shipping Instruction and a draft BL text are required.' }, { status: 400 });
  }

  const si = extractDoc(siText, 'SI');
  const bl = extractDoc(blText, 'BL');
  const cmp = compareDocs(si, bl);

  const siLooks = /shipping\s*instruction/i.test(siText.slice(0, 800)) || si.completeness >= 0.5;
  const blLooks = /bill\s*of\s*lading/i.test(blText.slice(0, 800)) || bl.completeness >= 0.5;

  const status = cmp.defectFields.length > 0 ? 'MISMATCH' : si.missing.length + bl.missing.length > 0 ? 'NEEDS_REVIEW' : 'OK';

  return NextResponse.json({
    ok: true,
    status,
    si: { missing: si.missing, completeness: si.completeness, lines: si.lines },
    bl: { missing: bl.missing, completeness: bl.completeness, lines: bl.lines },
    warnings: [
      ...(siLooks ? [] : ['The first text does not clearly identify as a Shipping Instruction.']),
      ...(blLooks ? [] : ['The second text does not clearly identify as a draft Bill of Lading.']),
      ...(si.missing.length || bl.missing.length
        ? [`Fields not found — SI missing ${si.missing.length}, BL missing ${bl.missing.length}; those rows cannot be compared.`]
        : []),
    ],
    rows: cmp.rows,
    defectFields: cmp.defectFields,
    matchedFields: cmp.matchedFields,
    summary:
      cmp.defectFields.length > 0
        ? `${cmp.defectFields.length} of 7 fields differ between the two documents.`
        : si.missing.length + bl.missing.length > 0
          ? 'Some fields could not be located — in the console this would escalate to human review.'
          : 'No mismatch detected — all 7 fields match.',
  });
}
