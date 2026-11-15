'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import type { ProcessedEmail } from '@/lib/types';
import type { TraceStep } from '@/lib/engine/trace';
import type { DraftReply } from '@/lib/engine/reply';
import { Icon, Logo } from '@/components/icons';
import { useToast, M, StatusBadge, ReasonBadge } from '@/components/ui';
import { DecisionTrace, ReplyDraft } from '@/components/engine-views';
import { cx } from '@/lib/utils';

type Side = 'SI' | 'BL';
interface Doc { file: File | null; text: string; mode: 'file' | 'text' }
interface Result { email: ProcessedEmail; trace: TraceStep[]; reply: DraftReply | null }

const SAMPLES: { id: string; label: string; hint: string; si: string; bl: string }[] = [
  { id: 'locode', label: 'Text · LOCODE trap', hint: 'BL keeps the UN/LOCODE but changes the city', si: 'email_025_SI.txt', bl: 'email_025_BL.txt' },
  { id: 'pdf', label: 'PDF · weight', hint: 'layout-aware PDF reading, totals from the container table', si: 'email_499_SI.pdf', bl: 'email_499_BL.pdf' },
  { id: 'office', label: 'Excel + Word', hint: 'SI as .xlsx, BL as .docx with a bilingual table', si: 'email_097_SI.xlsx', bl: 'email_097_BL.docx' },
  { id: 'scan', label: 'Scanned PDF · OCR', hint: 'image-only PDFs read by OCR, escalated for confirmation', si: 'email_512_SI.pdf', bl: 'email_512_BL.pdf' },
  { id: 'blank', label: 'Placeholders', hint: '"TBA" and "____MT" are never treated as values', si: 'email_517_SI.txt', bl: 'email_517_BL.txt' },
  { id: 'wrong', label: 'Wrong document', hint: 'a commercial invoice sent instead of the draft BL', si: 'email_501_SI.txt', bl: 'email_501_BL.txt' },
  { id: 'clean', label: 'Clean pair', hint: 'all seven fields agree', si: 'email_208_SI.pdf', bl: 'email_208_BL.pdf' },
];

const ACCEPT = '.txt,.pdf,.docx,.xlsx,text/plain,application/pdf';

function DropZone({ side, doc, onChange }: { side: Side; doc: Doc; onChange: (d: Doc) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const tag = side === 'SI' ? 'bg-brand-50 text-brand-500' : 'bg-aqua-50 text-aqua-600';
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={cx('text-[10px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5', tag)}>{side}</span>
          <span className="text-[13px] font-bold text-ink-800">{side === 'SI' ? 'Shipping Instruction' : 'Draft Bill of Lading'}</span>
        </div>
        <div className="flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-bold">
          {(['file', 'text'] as const).map((m) => (
            <button key={m} onClick={() => onChange({ ...doc, mode: m })} className={cx('px-2.5 py-1 rounded-md transition-colors', doc.mode === m ? 'bg-white text-ink-800 shadow-sm' : 'text-slate-400')}>
              {m === 'file' ? 'Upload' : 'Paste text'}
            </button>
          ))}
        </div>
      </div>
      {doc.mode === 'file' ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onChange({ ...doc, file: f }); }}
          onClick={() => input.current?.click()}
          className={cx('h-44 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-colors px-4',
            over ? 'border-brand-400 bg-brand-50/50' : 'border-slate-200 bg-slate-50/60 hover:border-brand-300')}
        >
          <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange({ ...doc, file: f }); e.target.value = ''; }}/>
          {doc.file ? (
            <>
              <Icon name="fileText" size={26} className="text-brand-500"/>
              <div className="text-[13px] font-bold text-ink-800 mt-2 break-all">{doc.file.name}</div>
              <div className="text-[11px] text-slate-400">{(doc.file.size / 1024).toFixed(1)} KB · click to replace</div>
            </>
          ) : (
            <>
              <Icon name="upload" size={26} className="text-slate-300"/>
              <div className="text-[13px] font-bold text-slate-500 mt-2">Drop a file or click to browse</div>
              <div className="text-[11px] text-slate-400 mt-0.5">.txt · .pdf (text or scanned) · .docx · .xlsx — up to 10 MB</div>
            </>
          )}
        </div>
      ) : (
        <textarea
          value={doc.text}
          onChange={(e) => onChange({ ...doc, text: e.target.value })}
          placeholder={'Shipper: …\nConsignee: …\nPort of Loading: …'}
          spellCheck={false}
          className="w-full h-44 rounded-xl border border-slate-200 bg-slate-50/60 p-3 font-mono text-[11.5px] leading-relaxed text-slate-600 outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 resize-y"
        />
      )}
    </div>
  );
}

export default function TryPage() {
  const toast = useToast();
  const [docs, setDocs] = useState<Record<Side, Doc>>({ SI: { file: null, text: '', mode: 'file' }, BL: { file: null, text: '', mode: 'file' } });
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingSample, setLoadingSample] = useState('');

  const loadSample = async (s: (typeof SAMPLES)[number]) => {
    setLoadingSample(s.id);
    try {
      const files = await Promise.all(
        [s.si, s.bl].map(async (name) => {
          const r = await fetch(`/api/try/sample?file=${name}`);
          if (!r.ok) throw new Error(name);
          return new File([await r.blob()], name);
        }),
      );
      setDocs({ SI: { file: files[0], text: '', mode: 'file' }, BL: { file: files[1], text: '', mode: 'file' } });
      setResult(null);
      toast('Sample loaded', s.hint, 'ai');
    } catch {
      toast('Could not load sample', 'Try again in a moment.', 'warn');
    } finally {
      setLoadingSample('');
    }
  };

  const run = async () => {
    const fd = new FormData();
    for (const side of ['SI', 'BL'] as const) {
      const d = docs[side];
      if (d.mode === 'file' && d.file) fd.append(side.toLowerCase(), d.file);
      else if (d.mode === 'text' && d.text.trim()) fd.append(`${side.toLowerCase()}Text`, d.text);
    }
    if (subject.trim()) fd.append('subject', subject);
    if (body.trim()) fd.append('body', body);
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch('/api/try', { method: 'POST', body: fd });
      const d = await r.json();
      if (!r.ok || d.error) toast('Could not run the check', d.error ?? 'Unknown error', 'danger');
      else setResult(d);
    } catch {
      toast('Network error', 'The engine could not be reached.', 'danger');
    } finally {
      setBusy(false);
    }
  };

  const e = result?.email;

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
          <h1 className="font-display text-[30px] font-bold text-navy-900 tracking-tight">Try to fool the engine</h1>
          <p className="text-slate-500 text-[14.5px] leading-relaxed mt-2">
            Upload any Shipping Instruction and draft Bill of Lading — text, PDF, scanned PDF, Word or Excel — and the exact
            production pipeline checks them live: read → extract → compare → decide, with every step explained. Nothing is stored.
          </p>
        </div>

        <div className="mt-6">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Or start from a real dataset case</div>
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((s) => (
              <button key={s.id} onClick={() => loadSample(s)} title={s.hint} disabled={!!loadingSample}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-600 transition-colors">
                <Icon name={loadingSample === s.id ? 'loader' : 'fileText'} size={12} className={loadingSample === s.id ? 'animate-spin' : ''}/>{s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-5 mt-5">
          {(['SI', 'BL'] as const).map((side) => (
            <DropZone key={side} side={side} doc={docs[side]} onChange={(d) => setDocs((prev) => ({ ...prev, [side]: d }))}/>
          ))}
        </div>

        <details className="card p-4 mt-5 group">
          <summary className="cursor-pointer list-none text-[13px] font-bold text-ink-800 flex items-center gap-2">
            <Icon name="chevronRight" size={14} className="transition-transform group-open:rotate-90"/>Email (optional) — test the classifier too
          </summary>
          <div className="grid gap-3 mt-3">
            <input value={subject} onChange={(ev) => setSubject(ev.target.value)} placeholder="Subject — e.g. a misleading one" className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-[13px] outline-none focus:border-brand-400"/>
            <textarea value={body} onChange={(ev) => setBody(ev.target.value)} placeholder="Body — defaults to “Please check the attached SI and draft BL…”" className="h-24 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-[13px] outline-none focus:border-brand-400 resize-y"/>
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-3 mt-5">
          <button onClick={run} disabled={busy} className="btn-primary">
            <Icon name={busy ? 'loader' : 'play'} size={15} className={busy ? 'animate-spin' : ''}/>{busy ? 'Checking… (scans take ~10 s)' : 'Run the check'}
          </button>
          <span className="text-[12px] text-slate-400">Same code path as the console — no shortcuts, no AI guessing.</span>
        </div>

        {e && result && (
          <M from={{ opacity: 0, transform: 'translateY(16px)' }} to={{ opacity: 1, transform: 'none' }} className="mt-8 space-y-5">
            <div className={cx('rounded-2xl border p-4 flex flex-wrap items-start gap-3',
              e.status === 'OK' && 'bg-emerald-50/70 border-emerald-100',
              e.status === 'MISMATCH' && 'bg-red-50/70 border-red-100',
              e.status === 'NEEDS_REVIEW' && 'bg-amber-50/70 border-amber-100')}>
              <div className="flex items-center gap-2"><StatusBadge status={e.status}/>{e.reviewReason && <ReasonBadge reason={e.reviewReason}/>}</div>
              <div className="text-[13.5px] font-bold text-ink-800 min-w-0 flex-1">{e.summary}</div>
            </div>

            {e.comparison && (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px]">
                    <thead className="bg-slate-50/80 border-b border-slate-100">
                      <tr><th className="th">Field</th><th className="th">SI (reference)</th><th className="th">Draft BL</th><th className="th">Result</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {e.comparison.rows.map((row) => {
                        const defect = row.match === false;
                        return (
                          <tr key={row.field} className={cx('align-top', defect && 'bg-red-50/40')}>
                            <td className="px-4 py-3 text-[12.5px] font-bold text-ink-800 whitespace-nowrap">{row.label}</td>
                            {(['si', 'bl'] as const).map((side) => (
                              <td key={side} className={cx('px-4 py-3 text-[12.5px] font-mono', defect ? 'text-red-700 font-semibold' : 'text-slate-600')}>
                                {row[side] ?? <span className="text-slate-300">—</span>}
                                {row.evidence[side] && <div className="text-[10px] text-slate-400 font-mono mt-1 max-w-[300px] truncate" title={row.evidence[side]}>{row.evidence[side]}</div>}
                              </td>
                            ))}
                            <td className="px-4 py-3">
                              {row.match === null ? <span className="text-[10.5px] font-bold text-slate-400">not found</span>
                                : row.match ? <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold bg-emerald-50 text-emerald-600"><Icon name="check" size={11} strokeWidth={3}/>Match</span>
                                : <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold bg-red-50 text-red-600"><Icon name="x" size={11} strokeWidth={3}/>Differs</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="grid lg:grid-cols-2 gap-5">
              <DecisionTrace steps={result.trace}/>
              <ReplyDraft draft={result.reply}/>
            </div>
          </M>
        )}
      </main>
    </div>
  );
}
