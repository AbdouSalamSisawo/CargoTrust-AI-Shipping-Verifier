'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CATEGORIES, CATEGORY_ORDER, type Category, type Status } from '@/data/taxonomy';
import { Icon } from '@/components/icons';
import { CategoryBadge, StatusBadge, ReasonBadge, ConfBar, TextField, Skeleton, EmptyState, M } from '@/components/ui';
import { cx } from '@/lib/utils';

interface Row {
  id: string;
  subject: string;
  from: string;
  category: Category;
  status: Status;
  confidence: number;
  defectCount: number;
  reviewReason: string | null;
  hasAttachments: boolean;
  summary: string;
}

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'All statuses' },
  { key: 'OK', label: 'OK' },
  { key: 'MISMATCH', label: 'Mismatch' },
  { key: 'NEEDS_REVIEW', label: 'Needs review' },
];

export default function EmailsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'ALL' | Category>('ALL');
  const [status, setStatus] = useState('ALL');

  const load = useCallback(async () => {
    setRows(null);
    const sp = new URLSearchParams({ q, category: cat, status, page: String(page), pageSize: '10' });
    const r = await fetch('/api/emails?' + sp.toString());
    const d = await r.json();
    setRows(d.items);
    setTotal(d.total);
    setPages(d.pages);
  }, [q, cat, status, page]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  const reset = () => { setQ(''); setCat('ALL'); setStatus('ALL'); setPage(1); };
  const changed = q !== '' || cat !== 'ALL' || status !== 'ALL';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] font-bold text-navy-900 tracking-tight">Email Intelligence</h1>
          <p className="text-sm text-slate-400 mt-1">Every inbox message, classified and verified by the engine.</p>
        </div>
        <div className="text-[12.5px] font-semibold text-slate-400">{rows ? `${total} matching emails` : 'Loading…'}</div>
      </div>

      {/* filters */}
      <div className="card p-4 flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="w-full lg:w-72">
          <TextField
            compact
            icon={<Icon name="search" size={15}/>}
            placeholder="Search subject, sender, ID…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5 flex-1">
          <button
            onClick={() => { setCat('ALL'); setPage(1); }}
            className={cx('px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors', cat === 'ALL' ? 'bg-navy-900 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-100')}
          >
            All
          </button>
          {CATEGORY_ORDER.map((c) => (
            <button
              key={c}
              onClick={() => { setCat(c); setPage(1); }}
              className={cx('px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors inline-flex items-center gap-1.5 border', cat === c ? 'text-white border-transparent' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border-slate-100')}
              style={cat === c ? { background: CATEGORIES[c].color } : undefined}
            >
              <Icon name={CATEGORIES[c].icon} size={12}/>{CATEGORIES[c].label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.key}
              onClick={() => { setStatus(s.key); setPage(1); }}
              className={cx('px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors', status === s.key ? 'bg-navy-900 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-100')}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead className="bg-slate-50/80 border-b border-slate-100">
              <tr>
                <th className="th">Email</th>
                <th className="th">Category</th>
                <th className="th">Result</th>
                <th className="th">Confidence</th>
                <th className="th w-8"/>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows === null
                ? [...Array(8)].map((_, i) => (
                    <tr key={i}><td colSpan={5} className="px-4 py-3"><Skeleton className="h-10"/></td></tr>
                  ))
                : rows.length === 0
                  ? (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState
                          icon="search"
                          tint="#64748B"
                          title="No emails match your filters"
                          sub="Try a different search term or clear the filters."
                          action={<button onClick={reset} className="btn-ghost btn-sm">Clear filters</button>}
                        />
                      </td>
                    </tr>
                  )
                : rows.map((e, i) => (
                    <tr key={e.id} className="group hover:bg-brand-50/40 transition-colors">
                      <td className="px-4 py-3.5">
                        <M from={{ opacity: 0, y: 6 }} to={{ opacity: 1, y: 0 }} dur={0.3} delay={Math.min(i * 0.03, 0.3)}>
                          <Link href={`/emails/${e.id}`} className="block min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] text-slate-400 shrink-0">{e.id}</span>
                              {e.hasAttachments && <Icon name="paperclip" size={12} className="text-slate-300 shrink-0"/>}
                            </div>
                            <div className="text-[13px] font-semibold text-ink-800 truncate group-hover:text-brand-600 transition-colors max-w-[420px]">{e.subject}</div>
                            <div className="text-[11.5px] text-slate-400 truncate max-w-[420px]">{e.from}</div>
                          </Link>
                        </M>
                      </td>
                      <td className="px-4 py-3.5"><CategoryBadge cat={e.category}/></td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={e.status} size="sm"/>
                          {e.reviewReason ? <ReasonBadge reason={e.reviewReason as never}/> : e.defectCount > 0 ? (
                            <span className="text-[11px] font-bold text-red-500 whitespace-nowrap">{e.defectCount} field{e.defectCount > 1 ? 's' : ''}</span>
                          ) : null}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[260px] mt-1">{e.summary}</div>
                      </td>
                      <td className="px-4 py-3.5"><ConfBar v={e.confidence}/></td>
                      <td className="px-2 py-3.5">
                        <Icon name="chevronRight" size={15} className="text-slate-300 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all"/>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {rows && pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-[12px] text-slate-400 font-semibold">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="btn-ghost btn-sm disabled:opacity-40">
                <Icon name="chevronLeft" size={14}/>Prev
              </button>
              <button disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))} className="btn-ghost btn-sm disabled:opacity-40">
                Next<Icon name="chevronRight" size={14}/>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
