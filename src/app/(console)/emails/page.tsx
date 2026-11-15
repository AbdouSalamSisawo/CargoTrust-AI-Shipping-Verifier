'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CATEGORIES, CATEGORY_ORDER, type Category, type Status } from '@/data/taxonomy';
import { Icon } from '@/components/icons';
import { CategoryBadge, StatusBadge, ReasonBadge, TextField, Skeleton, EmptyState } from '@/components/ui';
import { useSession, can } from '@/components/shell';
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
  awaitingDocuments?: boolean;
  hasAttachments: boolean;
  summary: string;
  source: 'sample' | 'upload' | 'email';
  receivedAt: string | null;
  aiRead: boolean;
}

const STATUS_FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'OK', label: 'Match' },
  { key: 'MISMATCH', label: 'Discrepancy' },
  { key: 'NEEDS_REVIEW', label: 'Needs review' },
];
const SOURCE_FILTERS = [
  { key: 'ALL', label: 'All sources' },
  { key: 'live', label: 'Uploads and email' },
  { key: 'sample', label: 'Sample data' },
];
const PAGE_SIZE = 15;

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="shrink-0">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-md border border-slate-300 bg-white pl-2.5 pr-8 text-[13px] text-ink-800">
        {children}
      </select>
    </label>
  );
}

export default function InboxPage() {
  const router = useRouter();
  const { user } = useSession();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'ALL' | Category>('ALL');
  const [status, setStatus] = useState('ALL');
  const [source, setSource] = useState('ALL');

  // filters can arrive in the URL (links from the dashboard)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const c = sp.get('category');
    if (c && (CATEGORY_ORDER as string[]).includes(c)) setCat(c as Category);
    const s = sp.get('status');
    if (s && STATUS_FILTERS.some((f) => f.key === s)) setStatus(s);
    const src = sp.get('source');
    if (src && SOURCE_FILTERS.some((f) => f.key === src)) setSource(src);
    setReady(true);
  }, []);

  const load = useCallback(async () => {
    setRows(null);
    const sp = new URLSearchParams({ q, category: cat, status, source, page: String(page), pageSize: String(PAGE_SIZE) });
    const r = await fetch('/api/emails?' + sp.toString());
    const d = await r.json();
    setRows(d.items ?? []);
    setTotal(d.total ?? 0);
    setPages(d.pages ?? 1);
  }, [q, cat, status, source, page]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load, ready]);

  const reset = () => { setQ(''); setCat('ALL'); setStatus('ALL'); setSource('ALL'); setPage(1); router.replace('/emails'); };
  const filtered = q !== '' || cat !== 'ALL' || status !== 'ALL' || source !== 'ALL';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Inbox</h1>
          <p className="page-sub">Every email and uploaded check, with the result of its document check</p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/export${source === 'live' ? '?source=live' : ''}`} className="btn-ghost btn-sm"><Icon name="download" size={14}/>Export CSV</a>
          {can(user, 'operator') && <Link href="/new" className="btn-primary btn-sm"><Icon name="upload" size={14}/>Add documents</Link>}
        </div>
      </div>

      <div className="card overflow-hidden">
        {/* filters */}
        <div className="p-3 border-b border-line flex flex-wrap xl:flex-nowrap items-center gap-2.5">
          <TextField
            compact
            className="h-9 flex-1 min-w-[220px] basis-full sm:basis-auto"
            icon={<Icon name="search" size={15}/>}
            placeholder="Search subject, sender or ID"
            aria-label="Search the inbox"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
          />
          <div className="h-9 inline-flex items-center shrink-0 rounded-md border border-slate-300 p-0.5 bg-slate-50" role="group" aria-label="Filter by result">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s.key}
                onClick={() => { setStatus(s.key); setPage(1); }}
                aria-pressed={status === s.key}
                className={cx('h-full px-2.5 rounded text-[12.5px] font-medium whitespace-nowrap transition-colors', status === s.key ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800')}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <Select label="Type" value={cat} onChange={(v) => { setCat(v as 'ALL' | Category); setPage(1); }}>
              <option value="ALL">All types</option>
              {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORIES[c].label}</option>)}
            </Select>
            <Select label="Source" value={source} onChange={(v) => { setSource(v); setPage(1); }}>
              {SOURCE_FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </Select>
          </div>
        </div>
        <div className="px-4 py-2 border-b border-line flex items-center justify-between text-[12.5px] text-ink-400">
          <span aria-live="polite">{rows ? `${total.toLocaleString()} item${total === 1 ? '' : 's'}` : 'Loading'}</span>
          {filtered && <button onClick={reset} className="font-medium text-brand-600 hover:underline">Clear filters</button>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="border-b border-line">
                <th className="th">Email</th>
                <th className="th">Type</th>
                <th className="th">Result</th>
                <th className="th w-8"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows === null
                ? [...Array(8)].map((_, i) => (
                    <tr key={i}><td colSpan={4} className="px-4 py-3"><Skeleton className="h-9"/></td></tr>
                  ))
                : rows.length === 0
                  ? (
                    <tr>
                      <td colSpan={4}>
                        <EmptyState
                          icon="search"
                          title="No items match these filters"
                          sub="Try another search term or clear the filters."
                          action={filtered ? <button onClick={reset} className="btn-ghost btn-sm">Clear filters</button> : undefined}
                        />
                      </td>
                    </tr>
                  )
                  : rows.map((e) => (
                    <tr key={e.id} className="group hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => router.push(`/emails/${encodeURIComponent(e.id)}`)}>
                      <td className="px-4 py-3 max-w-0 w-[52%]">
                        <Link href={`/emails/${encodeURIComponent(e.id)}`} className="block min-w-0" onClick={(ev) => ev.stopPropagation()}>
                          <div className="text-[13.5px] font-medium text-ink-900 truncate group-hover:text-brand-700">{e.subject}</div>
                          <div className="flex items-center gap-2 mt-0.5 text-[12px] text-ink-400 min-w-0">
                            <span className="font-mono shrink-0">{e.id}</span>
                            <span className="truncate">{e.from}</span>
                            {e.hasAttachments && <Icon name="paperclip" size={12} className="shrink-0"/>}
                            {e.source !== 'sample' && <span className="tag bg-brand-50 text-brand-700 shrink-0">{e.source === 'upload' ? 'Upload' : 'Email'}</span>}
                            {e.aiRead && <span className="tag bg-ai-50 text-ai-700 shrink-0">AI read</span>}
                            {e.receivedAt && <span className="tabular-nums shrink-0">{new Date(e.receivedAt).toLocaleDateString()}</span>}
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3"><CategoryBadge cat={e.category}/></td>
                      <td className="px-4 py-3 max-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {e.category === 'BL_COMPARISON' && !e.awaitingDocuments && <StatusBadge status={e.status} size="sm"/>}
                          {e.reviewReason ? <ReasonBadge reason={e.reviewReason as never}/> : e.defectCount > 0 ? (
                            <span className="text-[12px] text-ink-500 whitespace-nowrap">{e.defectCount} field{e.defectCount > 1 ? 's' : ''}</span>
                          ) : e.awaitingDocuments ? (
                            <span className="tag bg-slate-100 text-ink-500">Awaiting documents</span>
                          ) : e.category !== 'BL_COMPARISON' ? (
                            <span className="text-[12px] text-ink-400">No check needed</span>
                          ) : null}
                        </div>
                        <div className="text-[12px] text-ink-400 truncate mt-1">{e.summary}</div>
                      </td>
                      <td className="px-3 py-3">
                        <Icon name="chevronRight" size={15} className="text-ink-300 group-hover:text-ink-500"/>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {rows && pages > 1 && (
          <nav className="flex items-center justify-between px-4 py-2.5 border-t border-line" aria-label="Pagination">
            <span className="text-[12.5px] text-ink-400">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="btn-ghost btn-sm">
                <Icon name="chevronLeft" size={14}/>Previous
              </button>
              <button disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))} className="btn-ghost btn-sm">
                Next<Icon name="chevronRight" size={14}/>
              </button>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
