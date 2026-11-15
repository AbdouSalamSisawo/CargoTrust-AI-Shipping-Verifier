'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { DashboardMetrics } from '@/lib/metrics';
import { STATUS, type Status } from '@/data/taxonomy';
import { Icon } from '@/components/icons';
import { StatusBadge, ReasonBadge, Skeleton, EmptyState, useToast } from '@/components/ui';
import { useSession, can } from '@/components/shell';
import { cx, fmt } from '@/lib/utils';

/** One cell of the summary strip; links to the inbox filtered to the same items. */
function Stat({ label, value, note, href, tone }: { label: string; value: number; note?: string; href: string; tone?: Status | 'muted' }) {
  const color = tone && tone !== 'muted' ? STATUS[tone].color : undefined;
  return (
    <Link href={href} className="group block px-5 py-4 hover:bg-slate-50 transition-colors focus-visible:relative">
      <div className="text-[12px] font-medium text-ink-400 flex items-center gap-1.5 whitespace-nowrap" title={label}>
        {color && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} aria-hidden="true"/>}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-[24px] leading-8 font-semibold tabular-nums text-ink-900">{fmt(value)}</div>
      {note && <div className="text-[12px] text-ink-400 truncate">{note}</div>}
    </Link>
  );
}

function BarRow({ label, count, max, color, href }: { label: string; count: number; max: number; color: string; href?: string }) {
  const body = (
    <>
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-ink-700 truncate">{label}</span>
        <span className="font-medium tabular-nums text-ink-900 ml-3">{fmt(count)}</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${max ? (count / max) * 100 : 0}%`, background: color }}/>
      </div>
    </>
  );
  return href ? <Link href={href} className="block rounded px-1 -mx-1 py-1 hover:bg-slate-50">{body}</Link> : <div className="py-1">{body}</div>;
}

export default function DashboardPage() {
  const toast = useToast();
  const { user, organisation } = useSession();
  const [m, setM] = useState<DashboardMetrics | null>(null);

  useEffect(() => {
    fetch('/api/metrics')
      .then((r) => r.json())
      .then(setM)
      .catch(() => toast('Could not load the dashboard', 'The server did not respond. Try reloading the page.', 'danger'));
  }, [toast]);

  if (!m) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-1/3"/>
        <Skeleton className="h-28"/>
        <div className="grid xl:grid-cols-3 gap-5"><Skeleton className="h-80 xl:col-span-2"/><Skeleton className="h-80"/></div>
      </div>
    );
  }

  const withDocs = m.matches + m.mismatches + m.needsReview;
  const outcome = [
    { key: 'OK' as const, label: 'Match', value: m.matches, color: STATUS.OK.color },
    { key: 'MISMATCH' as const, label: 'Discrepancy', value: m.mismatches, color: STATUS.MISMATCH.color },
    { key: 'NEEDS_REVIEW' as const, label: 'Needs review', value: m.needsReview, color: STATUS.NEEDS_REVIEW.color },
  ];
  const maxDefect = Math.max(1, ...m.defectHist.map((d) => d.count));
  const maxCat = Math.max(1, ...m.byCategory.map((c) => c.count));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Document checks in {organisation}</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/export" className="btn-ghost btn-sm"><Icon name="download" size={14}/>Export CSV</a>
          {can(user, 'operator') && <Link href="/new" className="btn-primary btn-sm"><Icon name="upload" size={14}/>New check</Link>}
        </div>
      </div>

      {m.sampleCount > 0 && (
        <div className="rounded-md border border-brand-100 bg-brand-50/60 px-4 py-2.5 text-[13px] text-brand-800 flex flex-wrap items-center gap-x-2 gap-y-1">
          <Icon name="info" size={15} className="shrink-0"/>
          <span className="flex-1 min-w-[240px]">
            The figures include <b>{fmt(m.sampleCount)} sample emails</b> provided for demonstration
            {m.liveCount ? <>, plus {fmt(m.liveCount)} item{m.liveCount === 1 ? '' : 's'} added by your team</> : null}.
          </span>
          {user.role === 'admin' && <Link href="/settings" className="font-semibold underline underline-offset-2 whitespace-nowrap">Manage sample data</Link>}
        </div>
      )}

      {/* summary strip */}
      <section className="card grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 divide-x divide-y xl:divide-y-0 divide-line overflow-hidden" aria-label="Summary">
        <Stat label="Items in inbox" value={m.total} note={`${fmt(m.docChecks)} document threads`} href="/emails"/>
        <Stat label="Document checks" value={withDocs} note="SI and BL compared" href="/emails?category=BL_COMPARISON"/>
        <Stat label="Match" value={m.matches} tone="OK" note="all 7 fields agree" href="/emails?status=OK&category=BL_COMPARISON"/>
        <Stat label="Discrepancy" value={m.mismatches} tone="MISMATCH" note="amendment needed" href="/emails?status=MISMATCH"/>
        <Stat label="Needs review" value={m.needsReview} tone="NEEDS_REVIEW" note={`${m.reviewOpen} open in the queue`} href="/reviews"/>
        <Stat label="Awaiting documents" value={m.awaitingDocs} tone="muted" note="draft BL requested" href="/emails?category=BL_COMPARISON"/>
      </section>

      <div className="grid xl:grid-cols-3 gap-5">
        {/* needs attention */}
        <section className="card xl:col-span-2 overflow-hidden" aria-labelledby="attention-h">
          <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-line">
            <div>
              <h2 id="attention-h" className="panel-title">Needs attention</h2>
              <p className="panel-sub">Latest discrepancies and items waiting for a person</p>
            </div>
            <Link href="/reviews" className="text-[13px] font-medium text-brand-600 hover:underline whitespace-nowrap">Open review queue</Link>
          </div>
          {m.attention.length === 0 ? (
            <EmptyState icon="checkCircle" title="Nothing needs attention" sub="Discrepancies and escalations will appear here."/>
          ) : (
            <ul className="divide-y divide-line">
              {m.attention.map((e) => (
                <li key={e.id}>
                  <Link href={`/emails/${encodeURIComponent(e.id)}`} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-medium text-ink-900 truncate">{e.subject}</div>
                      <div className="text-[12px] text-ink-400 truncate"><span className="font-mono">{e.id}</span> · {e.from}</div>
                    </div>
                    <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                      <StatusBadge status={e.status} size="sm"/>
                      {e.reason && <ReasonBadge reason={e.reason as never}/>}
                    </div>
                    <Icon name="chevronRight" size={15} className="text-ink-300 shrink-0"/>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* outcome */}
        <section className="card p-5" aria-labelledby="outcome-h">
          <h2 id="outcome-h" className="panel-title">Outcome of document checks</h2>
          <p className="panel-sub">{fmt(withDocs)} SI and draft BL pairs compared</p>
          <div className="mt-5 flex h-3 rounded-full overflow-hidden bg-slate-100" role="img" aria-label={outcome.map((o) => `${o.label} ${o.value}`).join(', ')}>
            {outcome.map((o) => o.value > 0 && (
              <div key={o.key} style={{ width: `${(o.value / Math.max(1, withDocs)) * 100}%`, background: o.color }} className="transition-[width] duration-500"/>
            ))}
          </div>
          <dl className="mt-5 space-y-2.5">
            {outcome.map((o) => (
              <div key={o.key} className="flex items-center gap-2.5 text-[13px]">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: o.color }} aria-hidden="true"/>
                <dt className="flex-1 text-ink-600">{o.label}</dt>
                <dd className="font-medium tabular-nums text-ink-900">{fmt(o.value)}</dd>
                <dd className="w-12 text-right tabular-nums text-ink-400">{withDocs ? Math.round((o.value / withDocs) * 100) : 0}%</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 pt-4 border-t border-line text-[12.5px] text-ink-400 leading-relaxed">
            A match means the seven compared fields agree. It does not certify that a document is authentic.
          </p>
        </section>
      </div>

      <div className="grid xl:grid-cols-2 gap-5">
        <section className="card p-5" aria-labelledby="defects-h">
          <h2 id="defects-h" className="panel-title">Discrepancies by field</h2>
          <p className="panel-sub">Which fields most often differ between the SI and the draft BL</p>
          <div className="mt-4 space-y-1.5">
            {m.defectHist.map((d) => <BarRow key={d.field} label={d.label} count={d.count} max={maxDefect} color={STATUS.MISMATCH.color}/>)}
          </div>
        </section>
        <section className="card p-5" aria-labelledby="cats-h">
          <h2 id="cats-h" className="panel-title">Incoming email by type</h2>
          <p className="panel-sub">How the classifier routed every email</p>
          <div className="mt-4 space-y-1.5">
            {m.byCategory.map((c) => <BarRow key={c.cat} label={c.label} count={c.count} max={maxCat} color={c.color} href={`/emails?category=${c.cat}`}/>)}
          </div>
        </section>
      </div>

      <section className="card overflow-hidden" aria-labelledby="recent-h">
        <div className="px-5 py-4 border-b border-line">
          <h2 id="recent-h" className="panel-title">Recently added by your team</h2>
          <p className="panel-sub">Uploaded checks and imported emails, newest first</p>
        </div>
        {m.recent.length === 0 ? (
          <EmptyState
            icon="upload"
            title="No checks added yet"
            sub="Upload a Shipping Instruction and its draft Bill of Lading, or import customer emails."
            action={can(user, 'operator') ? <Link href="/new" className="btn-primary btn-sm"><Icon name="upload" size={14}/>New check</Link> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead><tr className="border-b border-line"><th className="th">Item</th><th className="th">Added</th><th className="th">Result</th></tr></thead>
              <tbody className="divide-y divide-line">
                {m.recent.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="td">
                      <Link href={`/emails/${encodeURIComponent(e.id)}`} className="font-medium text-ink-900 hover:text-brand-700">{e.subject}</Link>
                      <div className="text-[12px] text-ink-400"><span className="font-mono">{e.id}</span> · {e.source === 'upload' ? 'Upload' : 'Imported email'}</div>
                    </td>
                    <td className="td whitespace-nowrap text-ink-500 tabular-nums">{e.receivedAt ? new Date(e.receivedAt).toLocaleString() : ''}</td>
                    <td className="td">
                      <div className={cx('flex flex-wrap items-center gap-1.5')}>
                        <StatusBadge status={e.status} size="sm"/>
                        {e.reason && <ReasonBadge reason={e.reason as never}/>}
                        {e.status === 'MISMATCH' && <span className="text-[12px] text-ink-400">{e.defectCount} field{e.defectCount === 1 ? '' : 's'}</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
