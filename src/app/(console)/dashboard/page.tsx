'use client';

import { useSession, can } from '@/components/shell';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { DashboardMetrics } from '@/lib/metrics';
import { CATEGORIES, PRODUCT, type Status } from '@/data/taxonomy';
import { Icon } from '@/components/icons';
import { M, useCountUp, Ring, Donut, StatusBadge, CategoryBadge, ReasonBadge, Skeleton, useToast } from '@/components/ui';
import { cx, fmt } from '@/lib/utils';

type FeedItem = DashboardMetrics['feed'][number];

function FeedRow({ item, fresh }: { item: FeedItem; fresh: boolean }) {
  const color = item.status === 'MISMATCH' ? '#EF4444' : item.status === 'NEEDS_REVIEW' ? '#F59E0B' : '#10B981';
  const icon = item.status === 'MISMATCH' ? 'xCircle' : item.status === 'NEEDS_REVIEW' ? 'userCheck' : 'checkCircle';
  return (
    <M from={{ opacity: 0, transform: 'translateY(-10px)' }} to={{ opacity: 1, transform: 'none' }} dur={0.4} className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-white/5 transition-colors">
      <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: color + '26', color }}>
        <Icon name={icon} size={13.5}/>
      </span>
      <div className="min-w-0">
        <div className={cx('text-[12px] font-semibold text-white/85 leading-snug', fresh && 'text-white')}>
          <span className="font-mono text-[11px] text-white/50 mr-1.5">{item.id.replace('email_', '#')}</span>
          {item.status === 'OK' ? 'verified — all 7 fields match' : item.status === 'MISMATCH' ? `mismatch — ${item.defectCount} field${item.defectCount > 1 ? 's' : ''} flagged` : 'escalated to human review'}
        </div>
        <div className="text-[10px] text-white/35 mt-0.5 truncate">{item.subject}</div>
      </div>
    </M>
  );
}

function LiveFeed({ items }: { items: FeedItem[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setIdx((i) => i + 1), 3200);
    return () => clearInterval(t);
  }, [items.length]);
  const visible = Array.from({ length: Math.min(6, items.length) }, (_, k) => items[(idx + k) % items.length]);
  return (
    <div className="space-y-1">
      {visible.map((it, k) => <FeedRow key={`${it.id}-${idx}-${k}`} item={it} fresh={k === 0 && idx > 0}/>)}
    </div>
  );
}

function MetricCard({ icon, tint, label, value, note, delay = 0, spark }: {
  icon: string; tint: { c: string; bg: string }; label: string; value: number; note: string; delay?: number; spark: number[];
}) {
  const v = useCountUp(value, { delay: 350 + delay, duration: 1100 });
  return (
    <M from={{ opacity: 0, transform: 'translateY(18px)' }} to={{ opacity: 1, transform: 'none' }} delay={delay}>
      <div className="card p-5 relative overflow-hidden group hover:shadow-lift hover:-translate-y-1 transition-all duration-300 h-full">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-brand-400/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"/>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: tint.bg, color: tint.c }}>
          <Icon name={icon} size={19} strokeWidth={2.2}/>
        </div>
        <div className="mt-4 text-[12px] font-semibold text-slate-400 truncate">{label}</div>
        <div className="mt-0.5 flex items-end justify-between gap-2 min-w-0">
          <div className="font-display text-[26px] font-bold text-navy-900 leading-none tabular-nums truncate">{fmt(v)}</div>
        </div>
        <div className="mt-1.5 text-[11px] text-slate-400 truncate">{note}</div>
        <div className="mt-2 -mb-1 opacity-70">{null}<SparkMini data={spark} color={tint.c}/></div>
      </div>
    </M>
  );
}

function SparkMini({ data, color }: { data: number[]; color: string }) {
  const w = 200, h = 26;
  const max = Math.max(...data, 1);
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - 2 - (d / max) * (h - 5)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".5"/>
    </svg>
  );
}

function PipelineFlow({ stages }: { stages: DashboardMetrics['pipeline'] }) {
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="flex min-w-[560px] mt-6">
        {stages.map((s, i) => (
          <div key={s.label} className="relative flex-1 flex flex-col items-center text-center px-1 min-w-0">
            {i < stages.length - 1 && (
              <div className="absolute top-[19px] hidden md:block pointer-events-none" style={{ left: 'calc(50% + 26px)', width: 'calc(100% - 52px)' }}>
                <div className="h-[2px] rounded-full bg-white/15"/>
                <div className="absolute -top-[3px] w-2 h-2 rounded-full bg-aqua-300 shadow-[0_0_10px_rgba(34,211,238,.95)] animate-flowDot" style={{ animationDelay: `${i * 0.5}s` }}/>
              </div>
            )}
            <M from={{ opacity: 0, scale: 0.7 }} to={{ opacity: 1, scale: 1 }} delay={0.15 + i * 0.12} dur={0.4}>
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 backdrop-blur flex items-center justify-center text-aqua-300 shadow-lg">
                <Icon name={s.icon} size={18}/>
              </div>
            </M>
            <div className="mt-2.5 text-[11px] font-bold tracking-wide text-white/85 uppercase">{s.label}</div>
            <div className="font-display text-[17px] font-bold text-white mt-0.5">{s.stat}</div>
            <div className="text-[10px] text-white/45">{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const toast = useToast();
  const { user } = useSession();
  const [m, setM] = useState<DashboardMetrics | null>(null);
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    setDateStr(new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    fetch('/api/metrics')
      .then((r) => r.json())
      .then(setM)
      .catch(() => toast('Could not load metrics', 'Is the API server running?', 'danger'));
  }, [toast]);

  const donut = useMemo(() => (m ? m.byCategory.map((c) => ({ label: c.label, count: c.count, color: c.color })) : []), [m]);
  const maxDefect = useMemo(() => (m ? Math.max(1, ...m.defectHist.map((d) => d.count)) : 1), [m]);
  const statusSplit = useMemo(() => {
    if (!m) return [];
    return [
      { label: 'OK', value: m.matches, color: '#10B981' },
      { label: 'Mismatch', value: m.mismatches, color: '#EF4444' },
      { label: 'Needs review', value: m.needsReview, color: '#F59E0B' },
      { label: 'Awaiting docs', value: m.awaitingDocs, color: '#94A3B8' },
    ];
  }, [m]);

  if (!m) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-16 w-2/3"/>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5"><Skeleton className="h-72 xl:col-span-2"/><Skeleton className="h-72"/></div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-40"/>)}</div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5"><Skeleton className="h-80"/><Skeleton className="h-80"/></div>
      </div>
    );
  }

  const decided = m.matches + m.mismatches;
  const accuracy = m.docChecks ? Math.round((decided / m.docChecks) * 1000) / 10 : 0;
  const totalDefects = m.docChecks ? m.defectHist.reduce((s, d) => s + d.count, 0) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[26px] font-bold text-navy-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">{dateStr || '\u00A0'} · Verification overview across the processed inbox</p>
        </div>
        <div className="flex items-center gap-2.5">
          <a href="/api/export" className="btn-ghost">
            <Icon name="download" size={15}/>Export CSV
          </a>
          {can(user, 'operator') && <Link href="/new" className="btn-primary"><Icon name="upload" size={15}/>New check</Link>}
        </div>
      </div>

      {/* status + pipeline + live feed */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <M from={{ opacity: 0, transform: 'translateY(22px)' }} to={{ opacity: 1, transform: 'none' }} className="xl:col-span-2">
          <div className="relative rounded-3xl overflow-hidden shadow-lift p-6 lg:p-8 h-full" style={{ background: 'linear-gradient(120deg,#081426 0%,#12294D 45%,#0C4A6E 80%,#0E7490 115%)' }}>
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px)', backgroundSize: '28px 28px' }}/>
            <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full blur-3xl opacity-40 animate-drift pointer-events-none" style={{ background: 'radial-gradient(circle,#06B6D466,transparent 65%)' }}/>
            <div className="relative">
              <div className="flex flex-col lg:flex-row lg:items-center gap-7">
                <div className="flex justify-center lg:justify-start shrink-0">
                  <Ring value={accuracy} size={168} thickness={13} from="#22D3EE" to="#60A5FA" delay={500}>
                    {(v) => (
                      <>
                        <div className="font-display text-[32px] font-bold text-white leading-none tabular-nums">{v.toFixed(1)}<span className="text-[18px] text-white/60">%</span></div>
                        <div className="text-[10px] font-bold tracking-[0.14em] text-white/50 uppercase mt-1.5">Auto-resolved</div>
                      </>
                    )}
                  </Ring>
                </div>
                <div className="text-center lg:text-left min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulseDot"/>
                    <span className="text-[10.5px] font-bold tracking-wide text-emerald-300 uppercase whitespace-nowrap">Live</span>
                    <span className="text-[10.5px] text-white/50 whitespace-nowrap">{PRODUCT.engine}</span>
                  </div>
                  <h2 className="font-display text-[24px] font-bold text-white mt-3">AI Verification Status</h2>
                  <p className="text-white/55 text-[13.5px] leading-relaxed mt-1.5 max-w-md">
                    {fmt(m.total)} emails processed. {fmt(m.docChecks - m.awaitingDocs)} document sets compared across seven fields ({m.awaitingDocs} threads still awaiting documents) — {m.needsReview} escalated to human review, never guessed.
                  </p>
                  <div className="flex flex-wrap justify-center lg:justify-start gap-2.5 mt-4">
                    {[
                      ['inbox', fmt(m.total), 'emails ingested'],
                      ['scan', `${m.extractionCoveragePct}%`, 'full field coverage'],
                      ['shieldCheck', fmt(decided), 'auto-decided'],
                    ].map(([ic, v, l]) => (
                      <div key={l} className="flex items-center gap-2.5 rounded-xl bg-white/[.07] border border-white/10 backdrop-blur px-3.5 py-2.5">
                        <Icon name={ic} size={15} className="text-aqua-300 shrink-0"/>
                        <div className="text-left">
                          <div className="text-[13.5px] font-bold text-white leading-none whitespace-nowrap">{v}</div>
                          <div className="text-[9.5px] text-white/45 mt-0.5 whitespace-nowrap">{l}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <PipelineFlow stages={m.pipeline}/>
            </div>
          </div>
        </M>
        <M from={{ opacity: 0, transform: 'translateY(22px)' }} to={{ opacity: 1, transform: 'none' }} delay={0.12}>
          <div className="h-full rounded-3xl overflow-hidden shadow-lift relative">
            <div className="h-full rounded-3xl p-5" style={{ background: 'linear-gradient(160deg,#0E2039,#132A46 60%,#1B3554)' }}>
              <div className="flex items-center justify-between mb-1 gap-2">
                <div className="flex items-center gap-2 text-white min-w-0">
                  <Icon name="activity" size={15} className="text-aqua-300 shrink-0"/>
                  <span className="text-[13.5px] font-bold truncate">Recent decisions</span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-[10px] font-bold tracking-wider text-red-300 uppercase shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulseDot"/>Streaming
                </span>
              </div>
              <p className="text-[11px] text-white/40 mb-2 px-3">Replaying the latest engine decisions</p>
              <LiveFeed items={m.feed}/>
            </div>
          </div>
        </M>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <MetricCard icon="inbox" tint={{ c: '#2563EB', bg: '#EFF6FF' }} label="Total Emails" value={m.total} note="in processed inbox" delay={0} spark={[3, 5, 4, 6, 5, 7, m.total]}/>
        <MetricCard icon="gitCompare" tint={{ c: '#06B6D4', bg: '#ECFEFF' }} label="BL Comparisons" value={m.docChecks} note="document-check requests" delay={0.08} spark={[2, 3, 3, 4, 4, 5, m.docChecks]}/>
        <MetricCard icon="checkCircle" tint={{ c: '#10B981', bg: '#ECFDF5' }} label="Clean Matches" value={m.matches} note={`${accuracy}% of checks`} delay={0.16} spark={[2, 3, 3, 4, 5, 5, m.matches]}/>
        <MetricCard icon="alertTriangle" tint={{ c: '#EF4444', bg: '#FEF2F2' }} label="Defects Caught" value={totalDefects} note={`${m.mismatches} emails flagged`} delay={0.24} spark={[1, 2, 2, 3, 3, 4, totalDefects]}/>
        <MetricCard icon="userCheck" tint={{ c: '#8B5CF6', bg: '#F5F3FF' }} label="Human Reviews" value={m.reviewOpen} note={`${m.reviewResolved} resolved by reviewers`} delay={0.32} spark={[1, 1, 2, 2, 3, 3, m.reviewOpen]}/>
      </div>

      {/* charts */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <M from={{ opacity: 0, transform: 'translateY(20px)' }} to={{ opacity: 1, transform: 'none' }} delay={0.15} className="card p-5 xl:col-span-4">
          <div className="mb-4">
            <h3 className="font-bold text-[15px] text-navy-900">Email Classification</h3>
            <p className="text-xs text-slate-400 mt-0.5">How the engine routed {fmt(m.total)} emails</p>
          </div>
          <div className="relative h-52 flex items-center justify-center">
            <Donut data={donut} size={185}/>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="font-display text-2xl font-bold text-navy-900">{fmt(m.total)}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total emails</div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {m.byCategory.map((c) => (
              <div key={c.cat} className="flex items-center gap-2.5 text-[12px] min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }}/>
                <span className="font-semibold text-ink-700 flex-1 truncate">{CATEGORIES[c.cat].label}</span>
                <span className="font-bold tabular-nums text-navy-900 shrink-0">{c.count}</span>
                <span className="text-slate-400 tabular-nums w-12 text-right shrink-0">{c.pct}%</span>
              </div>
            ))}
          </div>
        </M>

        <M from={{ opacity: 0, transform: 'translateY(20px)' }} to={{ opacity: 1, transform: 'none' }} delay={0.22} className="card p-5 xl:col-span-8">
          <div className="mb-4">
            <h3 className="font-bold text-[15px] text-navy-900">Top Defect Fields</h3>
            <p className="text-xs text-slate-400 mt-0.5">Where the comparison engine finds discrepancies across {fmt(m.docChecks)} checks</p>
          </div>
          <div className="space-y-3.5 mt-6">
            {m.defectHist.map((d, i) => (
              <div key={d.field} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-[12px] font-semibold text-ink-700 truncate">{d.label}</span>
                <div className="flex-1 h-5 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden">
                  <M from={{ width: 0 }} to={{ width: `${(d.count / maxDefect) * 100}%` }} dur={0.8} delay={0.3 + i * 0.08}
                    className="h-full rounded-lg" >
                    <div className="h-full rounded-lg" style={{ width: '100%', background: d.count === 0 ? '#E2E8F0' : `linear-gradient(90deg,#2563EB,${i === 0 ? '#22D3EE' : '#7F97F8'})` }}/>
                  </M>
                </div>
                <span className="w-10 text-right text-[12.5px] font-bold tabular-nums text-navy-900">{d.count}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Decision split — {fmt(m.docChecks)} document checks</div>
            <div className="flex h-7 rounded-xl overflow-hidden border border-slate-100">
              {statusSplit.map((s) => (
                <div key={s.label} className="flex items-center justify-center transition-all duration-700" style={{ width: `${(s.value / Math.max(1, m.docChecks)) * 100}%`, background: s.color + '22' }}>
                  <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: s.color }}>{s.value}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1.5">
              {statusSplit.map((s) => (
                <span key={s.label} className="text-[11px] font-semibold text-slate-400">{s.label}</span>
              ))}
            </div>
          </div>
        </M>
      </div>

      {/* needs attention */}
      <M from={{ opacity: 0, transform: 'translateY(20px)' }} to={{ opacity: 1, transform: 'none' }} delay={0.28} className="card p-5">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="min-w-0">
            <h3 className="font-bold text-[15px] text-navy-900 truncate">Needs attention</h3>
            <p className="text-xs text-slate-400 mt-0.5 truncate">Latest mismatches and escalations</p>
          </div>
          <span className="rounded-full bg-red-50 text-red-500 text-[11px] font-bold px-2.5 py-1 shrink-0">{m.attention.length} open</span>
        </div>
        {m.attention.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-400">No mismatches or escalations — every check this session passed.</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {m.attention.map((e) => (
              <Link key={e.id} href={`/emails/${e.id}`} className="w-full flex items-center gap-3 py-3 px-1 text-left group hover:bg-slate-50/80 rounded-xl transition-colors">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: e.status === 'MISMATCH' ? '#DC2626' : '#D97706' }}/>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold text-ink-800 truncate group-hover:text-brand-600 transition-colors">{e.subject}</div>
                  <div className="text-[11px] text-slate-400 font-mono truncate">{e.id} · {e.from}</div>
                </div>
                {e.reason ? <ReasonBadge reason={e.reason as never}/> : <StatusBadge status={e.status as Status} size="sm"/>}
                <Icon name="chevronRight" size={14} className="text-slate-300 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all shrink-0"/>
              </Link>
            ))}
          </div>
        )}
        <div className="mt-3 flex gap-4">
          <Link href="/emails" className="text-[12.5px] font-bold text-brand-500 hover:text-brand-600 inline-flex items-center gap-1.5">Open email inbox <Icon name="arrowRight" size={14}/></Link>
          <Link href="/reviews" className="text-[12.5px] font-bold text-brand-500 hover:text-brand-600 inline-flex items-center gap-1.5">Review queue <Icon name="arrowRight" size={14}/></Link>
        </div>
      </M>
    </div>
  );
}
