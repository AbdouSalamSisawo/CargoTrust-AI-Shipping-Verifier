'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icons';
import { useToast, M } from '@/components/ui';
import { useSession } from '@/components/shell';
import { cx } from '@/lib/utils';

type Side = 'SI' | 'BL';
interface Doc { file: File | null; text: string; mode: 'file' | 'text' }

const SAMPLES: { id: string; label: string; hint: string; si: string; bl: string }[] = [
  { id: 'clean', label: 'Clean pair (PDF)', hint: 'all seven fields agree', si: 'email_208_SI.pdf', bl: 'email_208_BL.pdf' },
  { id: 'pdf', label: 'Weight mismatch (PDF)', hint: 'totals read from the container table', si: 'email_499_SI.pdf', bl: 'email_499_BL.pdf' },
  { id: 'locode', label: 'Port trap (text)', hint: 'BL keeps the UN/LOCODE but changes the city', si: 'email_025_SI.txt', bl: 'email_025_BL.txt' },
  { id: 'office', label: 'Excel + Word', hint: 'SI as .xlsx, BL as .docx with a bilingual table', si: 'email_097_SI.xlsx', bl: 'email_097_BL.docx' },
  { id: 'scan', label: 'Scanned PDF', hint: 'image-only PDFs: OCR, plus AI reading when enabled', si: 'email_512_SI.pdf', bl: 'email_512_BL.pdf' },
  { id: 'blank', label: 'Placeholders', hint: '"TBA" and "____MT" are never treated as values', si: 'email_517_SI.txt', bl: 'email_517_BL.txt' },
  { id: 'wrong', label: 'Wrong document', hint: 'a commercial invoice sent instead of the draft BL', si: 'email_501_SI.txt', bl: 'email_501_BL.txt' },
];

const ACCEPT = '.pdf,.docx,.xlsx,.txt,.png,.jpg,.jpeg,.webp,application/pdf,image/*';

function DropZone({ side, doc, onChange }: { side: Side; doc: Doc; onChange: (d: Doc) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const tag = side === 'SI' ? 'bg-brand-50 text-brand-500' : 'bg-aqua-50 text-aqua-600';
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cx('text-[10px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 shrink-0', tag)}>{side}</span>
          <span className="text-[13px] font-bold text-ink-800 truncate">{side === 'SI' ? 'Shipping Instruction' : 'Draft Bill of Lading'}</span>
        </div>
        <div className="flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-bold shrink-0">
          {(['file', 'text'] as const).map((m) => (
            <button key={m} onClick={() => onChange({ ...doc, mode: m })} className={cx('px-2.5 py-1 rounded-md transition-colors', doc.mode === m ? 'bg-white text-ink-800 shadow-sm' : 'text-slate-400')}>
              {m === 'file' ? 'File / photo' : 'Paste text'}
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
              <Icon name={doc.file.type.startsWith('image/') ? 'camera' : 'fileText'} size={26} className="text-brand-500"/>
              <div className="text-[13px] font-bold text-ink-800 mt-2 break-all">{doc.file.name}</div>
              <div className="text-[11px] text-slate-400">{(doc.file.size / 1024).toFixed(1)} KB · click to replace</div>
            </>
          ) : (
            <>
              <Icon name="upload" size={26} className="text-slate-300"/>
              <div className="text-[13px] font-bold text-slate-500 mt-2">Drop a file, browse, or take a photo</div>
              <div className="text-[11px] text-slate-400 mt-0.5">PDF (text or scanned) · Word · Excel · text · JPG/PNG photo — up to 15 MB</div>
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

function UploadTab() {
  const toast = useToast();
  const router = useRouter();
  const [docs, setDocs] = useState<Record<Side, Doc>>({ SI: { file: null, text: '', mode: 'file' }, BL: { file: null, text: '', mode: 'file' } });
  const [reference, setReference] = useState('');
  const [from, setFrom] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingSample, setLoadingSample] = useState('');

  const loadSample = async (s: (typeof SAMPLES)[number]) => {
    setLoadingSample(s.id);
    try {
      const files = await Promise.all(
        [s.si, s.bl].map(async (name) => {
          const r = await fetch(`/api/ingest/sample?file=${name}`);
          if (!r.ok) throw new Error(name);
          return new File([await r.blob()], name);
        }),
      );
      setDocs({ SI: { file: files[0], text: '', mode: 'file' }, BL: { file: files[1], text: '', mode: 'file' } });
      setReference(`Sample — ${s.label}`);
      toast('Sample loaded', s.hint, 'ai');
    } catch {
      toast('Could not load the sample', 'The sample files are not available on this server.', 'warn');
    } finally {
      setLoadingSample('');
    }
  };

  const fileOf = (side: Side): File | null => {
    const d = docs[side];
    if (d.mode === 'file') return d.file;
    return d.text.trim() ? new File([d.text], `pasted_${side}.txt`, { type: 'text/plain' }) : null;
  };

  const run = async () => {
    const si = fileOf('SI');
    const bl = fileOf('BL');
    if (!si && !bl) {
      toast('Nothing to check', 'Add the Shipping Instruction and the draft BL.', 'warn');
      return;
    }
    const fd = new FormData();
    if (si) fd.append('si', si);
    if (bl) fd.append('bl', bl);
    if (reference.trim()) fd.append('reference', reference.trim());
    if (from.trim()) fd.append('from', from.trim());
    if (note.trim()) fd.append('note', note.trim());
    setBusy(true);
    try {
      const r = await fetch('/api/ingest/upload', { method: 'POST', body: fd });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        toast('Could not run the check', d.error ?? 'Unknown error', 'danger');
        return;
      }
      toast('Check complete', d.email.summary, d.email.status === 'OK' ? 'success' : d.email.status === 'MISMATCH' ? 'danger' : 'warn');
      router.push(`/emails/${encodeURIComponent(d.id)}`);
    } catch {
      toast('Network error', 'The server could not be reached.', 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="grid lg:grid-cols-2 gap-5">
        {(['SI', 'BL'] as const).map((side) => (
          <DropZone key={side} side={side} doc={docs[side]} onChange={(d) => setDocs((prev) => ({ ...prev, [side]: d }))}/>
        ))}
      </div>

      <div className="card p-4 mt-5 grid md:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Reference</span>
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Booking / BL number" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-[13px] outline-none focus:border-brand-400"/>
        </label>
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Customer email</span>
          <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Who the reply goes to (optional)" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-[13px] outline-none focus:border-brand-400"/>
        </label>
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Note</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note (optional)" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-[13px] outline-none focus:border-brand-400"/>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-5">
        <button onClick={run} disabled={busy} className="btn-primary">
          <Icon name={busy ? 'loader' : 'play'} size={15} className={busy ? 'animate-spin' : ''}/>{busy ? 'Checking… scans take longer' : 'Run the check'}
        </button>
        <span className="text-[12px] text-slate-400">The result is saved to the inbox with its evidence and a drafted reply.</span>
      </div>

      <div className="mt-8">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">No documents at hand? Load a sample pair</div>
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button key={s.id} onClick={() => loadSample(s)} title={s.hint} disabled={!!loadingSample}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-600 transition-colors">
              <Icon name={loadingSample === s.id ? 'loader' : 'fileText'} size={12} className={loadingSample === s.id ? 'animate-spin' : ''}/>{s.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

interface EmlResult { file: string; id?: string; status?: string; duplicate?: boolean; error?: string }

function EmlTab() {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<EmlResult[] | null>(null);

  const add = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list).filter((f) => !prev.some((p) => p.name === f.name && p.size === f.size))]);
    setResults(null);
  };

  const run = async () => {
    if (!files.length) return;
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    setBusy(true);
    try {
      const r = await fetch('/api/ingest/eml', { method: 'POST', body: fd });
      const d = await r.json();
      if (!r.ok || !d.ok) toast('Import failed', d.error ?? 'Unknown error', 'danger');
      else {
        setResults(d.results);
        setFiles([]);
        const ok = (d.results as EmlResult[]).filter((x) => x.id && !x.duplicate).length;
        toast('Import complete', `${ok} email${ok === 1 ? '' : 's'} imported and checked`, 'success');
      }
    } catch {
      toast('Network error', 'The server could not be reached.', 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
        onClick={() => input.current?.click()}
        className={cx('card h-48 border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-colors px-4',
          over ? 'border-brand-400 bg-brand-50/50' : 'border-slate-200 hover:border-brand-300')}
      >
        <input ref={input} type="file" accept=".eml,message/rfc822" multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ''; }}/>
        <Icon name="mailImport" size={28} className="text-slate-300"/>
        <div className="text-[13.5px] font-bold text-slate-500 mt-2">Drop .eml files here, or click to choose</div>
        <div className="text-[11.5px] text-slate-400 mt-1 max-w-md">
          Outlook: drag the message to your desktop or File → Save As. Gmail: ⋮ → Download message. Each email is classified;
          SI / BL attachments are found by name or by content and checked.
        </div>
      </div>

      {files.length > 0 && (
        <div className="card p-4 mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12.5px] font-bold text-ink-800">{files.length} file{files.length > 1 ? 's' : ''} ready</span>
            <button onClick={() => setFiles([])} className="text-[11.5px] font-bold text-slate-400 hover:text-red-500">Clear</button>
          </div>
          <ul className="space-y-1">
            {files.map((f) => (
              <li key={f.name + f.size} className="text-[12px] text-slate-500 flex items-center gap-2"><Icon name="mail" size={12} className="shrink-0"/><span className="truncate">{f.name}</span><span className="text-slate-300 shrink-0">{(f.size / 1024).toFixed(0)} KB</span></li>
            ))}
          </ul>
          <button onClick={run} disabled={busy} className="btn-primary mt-4">
            <Icon name={busy ? 'loader' : 'upload'} size={15} className={busy ? 'animate-spin' : ''}/>{busy ? 'Importing…' : 'Import and check'}
          </button>
        </div>
      )}

      {results && (
        <M from={{ opacity: 0, transform: 'translateY(10px)' }} to={{ opacity: 1, transform: 'none' }} className="card p-4 mt-4">
          <div className="text-[12.5px] font-bold text-ink-800 mb-2">Import results</div>
          <ul className="divide-y divide-slate-50">
            {results.map((r) => (
              <li key={r.file} className="py-2 flex items-center gap-3 text-[12.5px]">
                <Icon name={r.error ? 'xCircle' : 'checkCircle'} size={14} className={cx('shrink-0', r.error ? 'text-red-500' : 'text-emerald-500')}/>
                <span className="flex-1 truncate text-slate-600">{r.file}</span>
                {r.error ? <span className="text-red-500 text-[11.5px]">{r.error}</span>
                  : <Link href={`/emails/${encodeURIComponent(r.id!)}`} className="font-bold text-brand-600 hover:underline whitespace-nowrap">{r.duplicate ? 'Already imported' : r.status} →</Link>}
              </li>
            ))}
          </ul>
        </M>
      )}
    </>
  );
}

export default function NewCheckPage() {
  const { user, aiActive } = useSession();
  const [tab, setTab] = useState<'upload' | 'eml'>('upload');
  if (user.role === 'viewer') {
    return <div className="card p-8 text-center text-[13px] text-slate-500">Your role is read-only. Ask an administrator for operator access to submit documents.</div>;
  }
  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="font-display text-[26px] font-bold text-navy-900 tracking-tight">New check</h1>
          <p className="text-slate-500 text-[13.5px] mt-1 max-w-2xl">
            Compare a Shipping Instruction with its draft Bill of Lading, or import customer emails. Scans and photos are read by OCR
            {aiActive ? ' and the AI vision model' : ''}; every result keeps its evidence.
          </p>
        </div>
        <div className="flex rounded-xl bg-slate-100 p-1 text-[12.5px] font-bold">
          {([['upload', 'SI + draft BL', 'files'], ['eml', 'Import emails', 'mailImport']] as const).map(([k, label, ic]) => (
            <button key={k} onClick={() => setTab(k)} className={cx('px-3.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-colors', tab === k ? 'bg-white text-ink-800 shadow-sm' : 'text-slate-500')}>
              <Icon name={ic} size={14}/>{label}
            </button>
          ))}
        </div>
      </div>
      {!aiActive && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 mb-5 text-[12px] text-slate-500 flex items-center gap-2">
          <Icon name="info" size={14} className="text-brand-500 shrink-0"/>
          <span>AI reading for scans and photos is off. {user.role === 'admin' ? <Link href="/settings" className="font-bold text-brand-600 hover:underline">Add an Anthropic API key in Settings</Link> : 'An administrator can enable it in Settings'} for much better results on poor scans.</span>
        </div>
      )}
      {tab === 'upload' ? <UploadTab/> : <EmlTab/>}
    </div>
  );
}
