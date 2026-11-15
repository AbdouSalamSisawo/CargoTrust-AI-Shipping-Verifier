'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@/lib/utils';
import { CATEGORIES, STATUS, REVIEW_REASONS, type Category, type Status, type ReviewReason } from '@/data/taxonomy';
import { Icon } from './icons';

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

/* ---------- motion ---------- */
export function M({
  as = 'div',
  from = {},
  to = {},
  dur = 0.35,
  delay = 0,
  style,
  className,
  children,
  ...rest
}: {
  as?: string;
  from?: React.CSSProperties;
  to?: React.CSSProperties;
  dur?: number;
  delay?: number;
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
  [k: string]: unknown;
}) {
  const [on, setOn] = useState(false);
  const [still, setStill] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setStill(true);
      setOn(true);
      return;
    }
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)));
    return () => cancelAnimationFrame(id);
  }, []);
  const st = Object.assign({}, style, on ? to : from, still ? {} : { transition: `opacity ${dur}s ${EASE} ${delay}s, transform ${dur}s ${EASE} ${delay}s, width ${dur}s ${EASE} ${delay}s` }) as React.CSSProperties;
  return React.createElement(as, Object.assign({ className, style: st }, rest), children);
}

export function useCountUp(target: number, { duration = 1100, decimals = 0, delay = 0 }: { duration?: number; decimals?: number; delay?: number } = {}): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf: number;
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      if (now < t0) { raf = requestAnimationFrame(tick); return; }
      const p = Math.min(1, (now - t0) / duration);
      setVal(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay]);
  return decimals ? Number(val.toFixed(decimals)) : Math.round(val);
}

/* ---------- badges ---------- */
export function StatusBadge({ status, size = 'md' }: { status: Status; size?: 'sm' | 'md' }) {
  const s = STATUS[status] ?? STATUS.OK;
  const sm = size === 'sm';
  return (
    <span
      className={cx('inline-flex items-center gap-1 rounded font-semibold whitespace-nowrap shrink-0', sm ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-[12px]')}
      style={{ background: s.bg, color: s.color }}
    >
      <Icon name={s.icon} size={sm ? 11 : 12} strokeWidth={2.4}/>{s.label}
    </span>
  );
}

/** Category is secondary information: neutral text with a small colour cue. */
export function CategoryBadge({ cat }: { cat: Category }) {
  const c = CATEGORIES[cat] ?? CATEGORIES.GENERAL;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-600 whitespace-nowrap shrink-0">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.color }}/>{c.label}
    </span>
  );
}

export function ReasonBadge({ reason }: { reason: ReviewReason }) {
  const r = REVIEW_REASONS[reason];
  if (!r) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-white px-1.5 py-0.5 text-[11.5px] font-medium text-amber-800 whitespace-nowrap shrink-0">
      <Icon name={r.icon} size={11.5} strokeWidth={2.2}/>{r.label}
    </span>
  );
}

export function ConfBar({ v }: { v: number }) {
  const c = v >= 0.9 ? '#15803D' : v >= 0.7 ? '#B45309' : '#B42318';
  return (
    <div className="flex items-center gap-2" title="Classifier confidence">
      <div className="w-12 h-1 rounded-full bg-slate-200 overflow-hidden shrink-0">
        <div className="h-full rounded-full" style={{ width: `${Math.round(v * 100)}%`, background: c }}/>
      </div>
      <span className="text-[12px] font-medium tabular-nums whitespace-nowrap text-ink-500">{Math.round(v * 100)}%</span>
    </div>
  );
}

/* ---------- form fields: icon / text / trailing each in a locked flex cell ---------- */
export function TextField({ icon, trailing, compact = false, className = '', ...inputProps }: {
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  compact?: boolean;
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div
      className={cx(
        'flex items-stretch rounded-md border border-slate-300 bg-white transition-colors duration-150',
        'focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/15 overflow-hidden',
        className,
      )}
    >
      {icon && <span className="flex items-center pl-3 pr-2 text-ink-300 pointer-events-none shrink-0" aria-hidden="true">{icon}</span>}
      <input
        className={cx(
          'flex-1 min-w-0 bg-transparent border-0 text-[13.5px] text-ink-800 placeholder-ink-300 outline-none focus-visible:outline-none',
          compact ? 'py-1.5' : 'py-2',
          icon ? 'pl-0' : 'pl-3',
          trailing ? 'pr-1.5' : 'pr-3',
        )}
        {...inputProps}
      />
      {trailing && <span className="flex items-center pr-2.5 pl-0.5 shrink-0">{trailing}</span>}
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cx('relative w-10 h-[22px] rounded-full transition-colors duration-150 shrink-0', on ? 'bg-brand-600' : 'bg-slate-300')}
    >
      <span className={cx('absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-150', on && 'translate-x-[18px]')}/>
    </button>
  );
}

export function SettingRow({ title, desc, on, onChange }: { title: string; desc: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-slate-100 last:border-0">
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium text-ink-800">{title}</div>
        <div className="text-[12.5px] text-ink-400 mt-0.5">{desc}</div>
      </div>
      <Switch on={on} onChange={onChange} label={title}/>
    </div>
  );
}

/* ---------- states ---------- */
export function EmptyState({ icon = 'inbox', tint = '#4D6177', title, sub, action }: {
  icon?: string; tint?: string; title: string; sub?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-3.5 border border-line bg-slate-50" style={{ color: tint }}>
        <Icon name={icon} size={20} strokeWidth={1.8}/>
      </div>
      <h3 className="text-[15px] font-semibold text-ink-900">{title}</h3>
      {sub && <p className="text-[13px] text-ink-400 mt-1 max-w-sm">{sub}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-md bg-slate-200/70', className)}/>;
}

/* ---------- charts (dependency-free SVG) ---------- */
export function Ring({ value, size = 170, thickness = 13, from = '#22D3EE', to = '#60A5FA', track = 'rgba(255,255,255,.12)', delay = 250, dur = 1300, children }: {
  value: number; size?: number; thickness?: number; from?: string; to?: string; track?: string; delay?: number; dur?: number;
  children?: React.ReactNode | ((v: number) => React.ReactNode);
}) {
  const [v, setV] = useState(0);
  const gid = useMemo(() => 'ring' + Math.random().toString(36).slice(2), []);
  useEffect(() => {
    let raf: number;
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      if (now < t0) { raf = requestAnimationFrame(tick); return; }
      const p = Math.min(1, (now - t0) / dur);
      setV(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, delay, dur]);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={from}/><stop offset="100%" stopColor={to}/></linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={thickness}/>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${gid})`} strokeWidth={thickness} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * v) / 100}/>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {typeof children === 'function' ? children(v) : children}
      </div>
    </div>
  );
}

export function Donut({ data, size = 190, thickness = 26 }: { data: { label: string; count: number; color: string }[]; size?: number; thickness?: number }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      {data.map((d, i) => {
        const frac = d.count / total;
        const len = Math.max(frac * c - 3, 0);
        const el = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={d.color}
            strokeWidth={thickness}
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-acc * c}
          />
        );
        acc += frac;
        return el;
      })}
    </svg>
  );
}

export function LineChart({ series, labels, height = 230 }: {
  series: { label: string; color: string; data: number[] }[];
  labels: string[];
  height?: number;
}) {
  const w = 620;
  const h = height;
  const padL = 38, padR = 12, padT = 14, padB = 26;
  const all = series.flatMap((s) => s.data);
  // series data are 0..1 fractions; draw on a 0..100% scale
  const maxPct = Math.max(1, ...all) * 115;
  const x = (i: number) => padL + (i * (w - padL - padR)) / Math.max(1, labels.length - 1);
  const y = (v: number) => padT + (1 - (v * 100) / maxPct) * (h - padT - padB);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxPct);
  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={y(t / 100)} x2={w - padR} y2={y(t / 100)} stroke="rgba(94,115,152,.12)" strokeWidth="1"/>
            <text x={padL - 8} y={y(t / 100) + 3.5} textAnchor="end" fontSize="9.5" fill="#8C9DB8">{Math.round(t)}%</text>
          </g>
        ))}
        {series.map((s) => {
          const pts = s.data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
          return (
            <g key={s.label}>
              <polyline points={pts} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              {s.data.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" fill="#fff" stroke={s.color} strokeWidth="2"/>)}
            </g>
          );
        })}
        {labels.map((l, i) => (
          <text key={i} x={x(i)} y={h - 8} textAnchor="middle" fontSize="9.5" fill="#8C9DB8">{l}</text>
        ))}
      </svg>
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 mt-1">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <span className="w-2 h-2 rounded-full" style={{ background: s.color }}/>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- toasts ---------- */
export interface Toast { id: number; title: string; desc?: string; type: 'success' | 'danger' | 'warn' | 'info' | 'ai' }
type ToastFn = (title: string, desc?: string, type?: Toast['type']) => void;
const ToastCtx = createContext<ToastFn>(() => undefined);
export const useToast = () => useContext(ToastCtx);

const TOAST_META: Record<Toast['type'], { icon: string; c: string }> = {
  success: { icon: 'checkCircle', c: '#15803D' },
  danger: { icon: 'alertCircle', c: '#B42318' },
  warn: { icon: 'alertTriangle', c: '#B45309' },
  info: { icon: 'info', c: '#1B5592' },
  ai: { icon: 'info', c: '#2D6280' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(1);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback<ToastFn>((title, desc, type = 'info') => {
    const id = seq.current++;
    setToasts((t) => [...t.slice(-4), { id, title, desc, type }]);
    setTimeout(() => dismiss(id), 4200);
  }, [dismiss]);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="fixed bottom-5 right-5 z-[80] flex flex-col gap-2.5 w-[340px] max-w-[calc(100vw-40px)]" role="status" aria-live="polite">
        {toasts.map((t) => {
          const m = TOAST_META[t.type];
          return (
            <M key={t.id} from={{ opacity: 0, transform: 'translateY(8px)' }} to={{ opacity: 1, transform: 'none' }} dur={0.2}
              className="bg-white rounded-md border border-line border-l-[3px] p-3.5 flex items-start gap-2.5 shadow-lift relative overflow-hidden" style={{ borderLeftColor: m.c }}>
              <span className="shrink-0 mt-px" style={{ color: m.c }}><Icon name={m.icon} size={16} strokeWidth={2.2}/></span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-ink-900 leading-snug">{t.title}</div>
                {t.desc && <div className="text-[12.5px] text-ink-500 mt-0.5 leading-snug break-words">{t.desc}</div>}
              </div>
              <button onClick={() => dismiss(t.id)} className="text-ink-300 hover:text-ink-600 transition-colors shrink-0" aria-label="Dismiss notification">
                <Icon name="x" size={14}/>
              </button>
            </M>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
