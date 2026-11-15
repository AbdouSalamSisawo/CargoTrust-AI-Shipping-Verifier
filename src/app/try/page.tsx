'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon, Logo } from '@/components/icons';
import { useToast, M } from '@/components/ui';
import { cx } from '@/lib/utils';

interface TryResult {
  status: 'OK' | 'MISMATCH' | 'NEEDS_REVIEW';
  summary: string;
  warnings: string[];
  rows: { field: string; label: string; si: string | null; bl: string | null; match: boolean | null; evidence: { si?: string; bl?: string } }[];
  defectFields: string[];
  matchedFields: string[];
  si: { missing: string[]; completeness: number };
  bl: { missing: string[]; completeness: number };
}

const SAMPLE_SI = `SHIPPING INSTRUCTION
========================================

Shipper/Exporter: APRIL FAR EAST (M) SDN BHD
  TOWER 2, AVENUE 5, LEVEL 6; BANGSAR SOUTH CITY, KUALA LUMPUR, MALAYSIA
CONSIGNEE: MOORIM SP CO., LTD
  656, GANGNAM-DAERO, GANGNAM-GU; SEOUL, SOUTH KOREA
NOTIFY PARTY: UAB NOVAKOPA
Port of Loading: PORT KLANG (WESTPORT), MALAYSIA (MYPKG)
Discharge Port: CALLAO, PERU (PECLL)
No. of Containers or Packages: 3 x 40'HC
Gross Weight (KG): 21,577 KG
Vessel Name: MMSS 2507 V.257087E`;

const SAMPLE_BL = `BILL OF LADING (DRAFT)
========================================

SHIPPER: APRIL FAR EAST (M) SDN BHD
  TOWER 2, AVENUE 5, LEVEL 6; BANGSAR SOUTH CITY, KUALA LUMPUR, MALAYSIA
CONSIGNEE: MOORIM SP CO., LTD
  656, GANGNAM-DAERO, GANGNAM-GU; SEOUL, SOUTH KOREA
Notify: UAB NOVAKOPA
Load Port: PORT KLANG (WESTPORT), MALAYSIA (MYPKG)
POD: CALLAO, PERU (PECLL)
Container Count: 4 x 40'HC
Gross Wt (kgs): 21,577 KG
Vessel Name: MMSS 2507 V.257087E`;

function Chip({ m }: { m: boolean | null }) {
  if (m === null) return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold bg-slate-100 text-slate-400">not found</span>;
  return m ? (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold bg-emerald-50 text-emerald-600"><Icon name="check" size={11} strokeWidth={3}/>Match</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold bg-red-50 text-red-600"><Icon name="x" size={11} strokeWidth={3}/>Differs</span>
  );
}

export default function TryPage() {
  const toast = useToast();
  const [si, setSi] = useState(SAMPLE_SI);
  const [bl, setBl] = useState(SAMPLE_BL);
  const [result, setResult] = useState<TryResult | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch('/api/try', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ si, bl }) });
      const d = await r.json();
      if (!r.ok || d.error) {
        toast('Could not run comparison', d.error ?? 'Unknown error', 'danger');
        return;
      }
      setResult(d);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60">
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-200/70">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 h-16 flex items-center gap-4">
          <Link href="/"><Logo/></Link>
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-100 px-3 py-1 text-[11px] font-bold text-brand-600">Playground</span>
          <div className="flex-1"/>
          <Link href="/login" className="btn-primary btn-sm">Open the console <Icon name="arrowRight" size={14}/></Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 lg:px-6 py-10">
        <div className="max-w-2xl">
          <h1 className="font-display text-[30px] font-bold text-navy-900 tracking-tight">Try the real engine</h1>
          <p className="text-slate-500 text-[14.5px] leading-relaxed mt-2">
            Paste any Shipping Instruction and draft Bill of Lading text — the same deterministic extractor and
            seven-field comparator that run on the 520-email dataset will check them live. Nothing is stored.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-5 mt-8">
          {([
            ['Shipping Instruction (SI)', si, setSi, 'SHIPPER:', 'SI'],
            ['Draft Bill of Lading (BL)', bl, setBl, 'SHIPPER:', 'BL'],
          ] as const).map(([label, value, setter, ph, tag]) => (
            <div key={tag} className="card p-4">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className={cx('text-[10px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5', tag === 'SI' ? 'bg-brand-50 text-brand-500' : 'bg-aqua-50 text-aqua-600')}>{tag}</span>
                  <span className="text-[13px] font-bold text-ink-800">{label}</span>
                </div>
                <button onClick={() => setter(tag === 'SI' ? SAMPLE_SI : SAMPLE_BL)} className="text-[11px] font-bold text-slate-400 hover:text-brand-500 transition-colors">Reset sample</button>
              </div>
              <textarea
                value={value}
                onChange={(e) => setter(e.target.value)}
                placeholder={ph}
                spellCheck={false}
                className="w-full h-72 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 font-mono text-[11.5px] leading-relaxed text-slate-600 outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 resize-y"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-5">
          <button onClick={run} disabled={busy} className="btn-primary">
            <Icon name="play" size={15}/>{busy ? 'Comparing…' : 'Run comparison'}
          </button>
          <span className="text-[12px] text-slate-400">Classify → extract → normalize → compare — exactly the console pipeline.</span>
        </div>

        {result && (
          <M from={{ opacity: 0, transform: 'translateY(16px)' }} to={{ opacity: 1, transform: 'none' }} className="mt-8">
            <div className={cx(
              'rounded-2xl border p-4 flex items-start gap-3',
              result.status === 'OK' && 'bg-emerald-50/70 border-emerald-100',
              result.status === 'MISMATCH' && 'bg-red-50/70 border-red-100',
              result.status === 'NEEDS_REVIEW' && 'bg-amber-50/70 border-amber-100',
            )}>
              <span className="shrink-0 mt-0.5" style={{ color: result.status === 'OK' ? '#059669' : result.status === 'MISMATCH' ? '#DC2626' : '#D97706' }}>
                <Icon name={result.status === 'OK' ? 'checkCircle' : result.status === 'MISMATCH' ? 'xCircle' : 'helpCircle'} size={20}/>
              </span>
              <div className="min-w-0">
                <div className="text-[13.5px] font-bold text-ink-800">{result.summary}</div>
                {result.warnings.map((w, i) => (
                  <div key={i} className="text-[11.5px] text-slate-500 mt-1">· {w}</div>
                ))}
              </div>
              <span className={cx('ml-auto shrink-0 text-[10px] font-bold uppercase tracking-wider rounded-md px-2 py-1',
                result.status === 'OK' ? 'bg-emerald-100 text-emerald-700' : result.status === 'MISMATCH' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
                {result.status.replace('_', ' ')}
              </span>
            </div>

            <div className="card overflow-hidden mt-4">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead className="bg-slate-50/80 border-b border-slate-100">
                    <tr>
                      <th className="th">Field</th>
                      <th className="th">SI value</th>
                      <th className="th">BL value</th>
                      <th className="th">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {result.rows.map((row) => {
                      const defect = row.match === false;
                      return (
                        <tr key={row.field} className={cx('align-top', defect && 'bg-red-50/40')}>
                          <td className="px-4 py-3 text-[12.5px] font-bold text-ink-800 whitespace-nowrap">{row.label}</td>
                          <td className={cx('px-4 py-3 text-[12.5px] font-mono', defect ? 'text-red-700 font-semibold' : 'text-slate-600')}>
                            {row.si ?? <span className="text-slate-300">—</span>}
                            {row.evidence.si && <div className="text-[10px] text-slate-400 font-mono mt-1 max-w-[280px] truncate">{row.evidence.si}</div>}
                          </td>
                          <td className={cx('px-4 py-3 text-[12.5px] font-mono', defect ? 'text-red-700 font-semibold' : 'text-slate-600')}>
                            {row.bl ?? <span className="text-slate-300">—</span>}
                            {row.evidence.bl && <div className="text-[10px] text-slate-400 font-mono mt-1 max-w-[280px] truncate">{row.evidence.bl}</div>}
                          </td>
                          <td className="px-4 py-3"><Chip m={row.match}/></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </M>
        )}
      </main>
    </div>
  );
}
