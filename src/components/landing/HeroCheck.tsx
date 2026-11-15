'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icons';
import { cx } from '@/lib/utils';

/** Illustrative example only: fictional companies, real rules. */
const ROWS: { label: string; si: string; bl: string; ok: boolean }[] = [
  { label: 'Shipper', si: 'NORDHAVN PAPER TRADING FZE', bl: 'NORDHAVN PAPER TRADING FZE', ok: true },
  { label: 'Consignee', si: 'BLUEWATER STATIONERY LLC', bl: 'BLUEWATER STATIONERY L.L.C.', ok: true },
  { label: 'Notify party', si: 'BLUEWATER STATIONERY LLC', bl: 'BLUEWATER STATIONERY LLC', ok: true },
  { label: 'Port of loading', si: 'NANTONG, CHINA (CNNTG)', bl: 'NANTONG (CNNTG)', ok: true },
  { label: 'Port of discharge', si: 'JEBEL ALI, UAE (AEJEA)', bl: 'JEBEL ALI, UAE (AEJEA)', ok: true },
  { label: 'Containers', si: "2 x 40'HC", bl: "2 x 40'HC", ok: true },
  { label: 'Gross weight', si: '40,326 KG', bl: '41,326 KG', ok: false },
];
const STEP_MS = 520;

export function HeroCheck() {
  const [step, setStep] = useState(-1); // rows checked so far
  const box = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const play = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setStep(ROWS.length);
      return;
    }
    setStep(0);
    timer.current = setInterval(() => {
      setStep((s) => {
        if (s >= ROWS.length) {
          if (timer.current) clearInterval(timer.current);
          return s;
        }
        return s + 1;
      });
    }, STEP_MS);
  }, []);

  // start once, when the card scrolls into view
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        play();
        io.disconnect();
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer.current) clearInterval(timer.current);
    };
  }, [play]);

  const done = step >= ROWS.length;

  return (
    <div ref={box} className="bg-white rounded-lg shadow-lift border border-white/10 overflow-hidden text-left">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-slate-50">
        <Icon name="gitCompare" size={16} className="text-brand-600 shrink-0"/>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-ink-900 truncate">Draft BL check · booking NTG-24817</div>
          <div className="text-[11.5px] text-ink-400">Shipping Instruction is the reference</div>
        </div>
        <span className="tag bg-slate-200/70 text-ink-500">Illustration</span>
      </div>

      <div className="divide-y divide-line" role="table" aria-label="Field comparison, illustrative example">
        <div className="hidden sm:grid grid-cols-[120px_1fr_1fr_28px] gap-3 px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-ink-400" role="row">
          <span role="columnheader">Field</span><span role="columnheader">SI</span><span role="columnheader">Draft BL</span><span role="columnheader" className="sr-only">Result</span>
        </div>
        {ROWS.map((r, i) => {
          const checked = step > i;
          const active = step === i;
          const bad = checked && !r.ok;
          return (
            <div
              key={r.label}
              role="row"
              className={cx(
                'grid grid-cols-[1fr_28px] sm:grid-cols-[120px_1fr_1fr_28px] gap-x-3 gap-y-0.5 px-4 py-2 transition-colors duration-300',
                active && 'bg-brand-50/60',
                bad && 'bg-red-50/70',
              )}
            >
              <span role="cell" className="text-[12px] font-medium text-ink-600 col-span-1 sm:col-span-1">{r.label}</span>
              <span role="cell" className="hidden sm:block text-[11.5px] font-mono text-ink-700 truncate" title={r.si}>{r.si}</span>
              <span role="cell" className={cx('hidden sm:block text-[11.5px] font-mono truncate', bad ? 'text-red-700 font-medium' : 'text-ink-700')} title={r.bl}>{r.bl}</span>
              <span role="cell" className="flex items-center justify-end row-span-2 sm:row-span-1">
                {checked ? (
                  r.ok
                    ? <Icon name="check" size={15} strokeWidth={2.6} className="text-emerald-700"/>
                    : <Icon name="x" size={15} strokeWidth={2.6} className="text-red-700"/>
                ) : active ? (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin"/>
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300"/>
                )}
                <span className="sr-only">{checked ? (r.ok ? 'match' : 'differs') : 'not checked yet'}</span>
              </span>
              <span className="sm:hidden text-[11px] font-mono text-ink-500 truncate">SI {r.si} · BL {r.bl}</span>
            </div>
          );
        })}
      </div>

      <div className={cx('px-4 py-3 border-t border-line flex items-center gap-3 transition-colors duration-300', done ? 'bg-red-50' : 'bg-white')} aria-live="polite">
        {done ? (
          <>
            <Icon name="alertCircle" size={16} className="text-red-700 shrink-0"/>
            <div className="flex-1 min-w-0 text-[12.5px] text-red-900">
              <b>Discrepancy in 1 field.</b> Amendment request drafted: gross weight SI 40,326 KG, BL 41,326 KG.
            </div>
            <button onClick={play} className="text-[12px] font-medium text-ink-500 hover:text-ink-800 inline-flex items-center gap-1 shrink-0">
              <Icon name="rotateCcw" size={12}/>Replay
            </button>
          </>
        ) : (
          <div className="text-[12.5px] text-ink-400">{step < 0 ? 'Waiting to start' : `Comparing field ${Math.min(step + 1, ROWS.length)} of ${ROWS.length}`}</div>
        )}
      </div>
    </div>
  );
}
