'use client';

import { useRef, useState } from 'react';
import { Icon } from '@/components/icons';
import { cx } from '@/lib/utils';

const STEPS = [
  {
    key: 'intake',
    title: 'Intake',
    lead: 'Documents arrive the way customers send them.',
    body: 'Upload a Shipping Instruction and draft Bill of Lading, take a photo of a paper BL, or import customer emails saved as .eml. SI and BL attachments are recognised by name or, when the file name says nothing, by their content.',
  },
  {
    key: 'classify',
    title: 'Classify',
    lead: 'Only document checks continue.',
    body: 'Each email is sorted into document check, SI request, invoice query, general or spam. The message body counts for more than the subject line, so a misleading subject does not reroute an email. Suspected phishing is set aside first.',
  },
  {
    key: 'read',
    title: 'Read',
    lead: 'Every format becomes the same structured text.',
    body: 'PDF layout, Word tables and Excel rows are rebuilt into one label and value layout. Scans and photos are read by OCR, and optionally by an AI vision model that is instructed to copy the page exactly.',
  },
  {
    key: 'compare',
    title: 'Compare',
    lead: 'Seven fields, with the SI as the reference.',
    body: 'Shipper, consignee, notify party, ports of loading and discharge, container count and gross weight. Each field has its own rule: exact company names, city and UN/LOCODE for ports, exact numbers after unit conversion.',
  },
  {
    key: 'decide',
    title: 'Decide and reply',
    lead: 'A clear outcome, the evidence, and the next email.',
    body: 'Each check ends as Match, Discrepancy or Needs review. Every value links to the line it was read from, and a reply is drafted: an amendment request, a confirmation, or a request for a missing document.',
  },
];

function Preview({ k }: { k: string }) {
  if (k === 'intake') {
    return (
      <div className="space-y-3">
        <div className="bg-white rounded-md border border-line p-4">
          <div className="text-[12px] text-ink-400">From operations@nordhavn-paper.example</div>
          <div className="text-[14px] font-semibold text-ink-900 mt-0.5">Draft BL for NTG-24817, please check</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[['fileText', 'SI_NTG24817.pdf'], ['fileText', 'Draft BL v2.pdf'], ['camera', 'IMG_2041.jpg']].map(([ic, n]) => (
              <span key={n} className="inline-flex items-center gap-1.5 rounded border border-line bg-slate-50 px-2 py-1 text-[12px] text-ink-700"><Icon name={ic} size={13} className="text-ink-400"/>{n}</span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[['upload', 'Upload'], ['mailImport', 'Email import'], ['camera', 'Phone photo']].map(([ic, l]) => (
            <div key={l} className="rounded-md border border-dashed border-slate-300 bg-white/60 px-2 py-3 text-[12px] text-ink-600"><Icon name={ic} size={16} className="mx-auto text-brand-600 mb-1"/>{l}</div>
          ))}
        </div>
      </div>
    );
  }
  if (k === 'classify') {
    const cats: [string, number, string][] = [['Document check', 13, '#2366AA'], ['SI request', 2, '#0E7871'], ['Invoice query', 0, '#7A5C1E'], ['General', 1, '#4D6177'], ['Spam', 0, '#9A3412']];
    return (
      <div className="bg-white rounded-md border border-line p-4">
        <div className="text-[12px] text-ink-400">Subject</div>
        <div className="text-[13.5px] font-medium text-ink-900">URGENT: invoice question on booking NTG-24817</div>
        <div className="text-[12px] text-ink-400 mt-3">Message</div>
        <div className="text-[13px] text-ink-700">Attached the SI and draft BL. Please compare and revert with any discrepancy.</div>
        <div className="mt-4 space-y-2">
          {cats.map(([l, v, c]) => (
            <div key={l} className="flex items-center gap-3 text-[12px]">
              <span className="w-28 text-ink-600">{l}</span>
              <span className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${(v / 13) * 100}%`, background: c }}/></span>
              <span className="w-6 text-right tabular-nums text-ink-500">{v}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 text-[12px] text-emerald-800 bg-emerald-50 rounded px-2 py-1.5">Routed as a document check. The body outweighs the word &ldquo;invoice&rdquo; in the subject.</div>
      </div>
    );
  }
  if (k === 'read') {
    return (
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="bg-white rounded-md border border-line p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 mb-2">PDF page</div>
          <div className="space-y-2" aria-hidden="true">
            <div className="h-2.5 w-1/2 rounded bg-slate-300"/>
            {[70, 90, 55, 80, 65, 85].map((w, i) => (
              <div key={i} className="flex gap-2"><div className="h-2 w-[30%] rounded bg-slate-200"/><div className="h-2 rounded bg-slate-200" style={{ width: `${w * 0.6}%` }}/></div>
            ))}
            <div className="grid grid-cols-3 gap-1 pt-1">{Array.from({ length: 9 }).map((_, i) => <div key={i} className="h-2 rounded bg-slate-100"/>)}</div>
          </div>
        </div>
        <div className="bg-navy-950 rounded-md p-4 font-mono text-[11.5px] leading-relaxed text-slate-300">
          <div><span className="text-aqua-300">Shipper:</span> NORDHAVN PAPER TRADING FZE</div>
          <div className="pl-3 text-slate-500">PO BOX 61204, DUBAI</div>
          <div><span className="text-aqua-300">Port of Loading:</span> NANTONG, CHINA</div>
          <div><span className="text-aqua-300">Port of Discharge:</span> JEBEL ALI</div>
          <div className="text-slate-500 mt-1">TGBU4471236 | 40HC | 20,163 KG</div>
          <div className="text-slate-500">MSKU9081127 | 40HC | 20,163 KG</div>
        </div>
      </div>
    );
  }
  if (k === 'compare') {
    const rows: [string, string, boolean][] = [
      ['Shipper', 'exact legal name, formatting ignored', true],
      ['Consignee', 'exact legal name', true],
      ['Notify party', 'exact legal name', true],
      ['Port of loading', 'city and UN/LOCODE', true],
      ['Port of discharge', 'city and UN/LOCODE', true],
      ['Containers', 'exact count', true],
      ['Gross weight', 'exact, after unit conversion', false],
    ];
    return (
      <div className="bg-white rounded-md border border-line divide-y divide-line">
        {rows.map(([f, rule, ok]) => (
          <div key={f} className="flex items-center gap-3 px-4 py-2">
            <span className="w-32 text-[12.5px] font-medium text-ink-800">{f}</span>
            <span className="flex-1 text-[12px] text-ink-400">{rule}</span>
            {ok ? <Icon name="check" size={15} strokeWidth={2.6} className="text-emerald-700"/> : <Icon name="x" size={15} strokeWidth={2.6} className="text-red-700"/>}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[['Match', '#15803D', '#EDF7F0'], ['Discrepancy', '#B42318', '#FDF0EE'], ['Needs review', '#B45309', '#FDF5E7']].map(([l, c, bg]) => (
          <div key={l} className="rounded-md px-3 py-2 text-[12.5px] font-semibold text-center" style={{ color: c, background: bg }}>{l}</div>
        ))}
      </div>
      <div className="bg-white rounded-md border border-line p-4">
        <div className="text-[12px] text-ink-400">Drafted reply · amendment request</div>
        <div className="mt-2 font-mono text-[11.5px] leading-relaxed text-ink-700 whitespace-pre-line">
          {'Dear Operations,\n\nPlease amend the draft BL before issue:\n  Gross Weight   SI: 40,326 kg   BL: 41,326 kg\n\nBest regards,\nShipping Documentation'}
        </div>
      </div>
    </div>
  );
}

export function Workflow() {
  const [i, setI] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + STEPS.length) % STEPS.length;
    setI(n);
    tabs.current[n]?.focus();
  };
  const s = STEPS[i];
  return (
    <div className="grid lg:grid-cols-[300px_1fr] gap-6 lg:gap-10">
      <div role="tablist" aria-label="How a check works" aria-orientation="vertical" onKeyDown={onKey} className="flex lg:flex-col gap-1 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0 pb-1">
        {STEPS.map((st, n) => (
          <button
            key={st.key}
            ref={(el) => { tabs.current[n] = el; }}
            role="tab"
            id={`wf-tab-${st.key}`}
            aria-selected={n === i}
            aria-controls={`wf-panel-${st.key}`}
            tabIndex={n === i ? 0 : -1}
            onClick={() => setI(n)}
            className={cx(
              'group shrink-0 text-left rounded-md px-3.5 py-3 transition-colors flex items-start gap-3 border',
              n === i ? 'bg-white border-line shadow-card' : 'border-transparent hover:bg-white/60',
            )}
          >
            <span className={cx('mt-0.5 w-6 h-6 rounded-full text-[11.5px] font-semibold flex items-center justify-center shrink-0 tabular-nums', n === i ? 'bg-brand-600 text-white' : 'bg-slate-200 text-ink-500')}>{n + 1}</span>
            <span className="min-w-0">
              <span className={cx('block text-[14px] font-semibold whitespace-nowrap', n === i ? 'text-ink-900' : 'text-ink-600')}>{st.title}</span>
              <span className="hidden lg:block text-[12.5px] text-ink-400 mt-0.5">{st.lead}</span>
            </span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`wf-panel-${s.key}`} aria-labelledby={`wf-tab-${s.key}`} className="grid md:grid-cols-[1fr_1.15fr] gap-6 items-start">
        <div key={s.key} className="animate-fadeUp">
          <div className="eyebrow text-brand-600">Step {i + 1} of {STEPS.length}</div>
          <h3 className="mt-2 text-[22px] leading-tight font-semibold text-ink-900">{s.lead}</h3>
          <p className="mt-3 text-[14.5px] leading-relaxed text-ink-600">{s.body}</p>
          <div className="mt-5 flex gap-2">
            <button onClick={() => setI((i + STEPS.length - 1) % STEPS.length)} className="btn-ghost btn-sm" aria-label="Previous step"><Icon name="chevronLeft" size={14}/></button>
            <button onClick={() => setI((i + 1) % STEPS.length)} className="btn-ghost btn-sm">Next step<Icon name="chevronRight" size={14}/></button>
          </div>
        </div>
        <div key={`p-${s.key}`} className="animate-fadeUp rounded-lg bg-slate-100/80 border border-line p-4">
          <Preview k={s.key}/>
          <div className="mt-2.5 text-[11px] text-ink-400">Simplified view of the product. Example data.</div>
        </div>
      </div>
    </div>
  );
}
