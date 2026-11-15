'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { REVIEW_REASONS, type ReviewReason, type FieldKey } from '@/data/taxonomy';
import { Icon } from '@/components/icons';
import { ReasonBadge, CategoryBadge, TextField, Skeleton, EmptyState, useToast } from '@/components/ui';
import { useSession, can } from '@/components/shell';
import { cx } from '@/lib/utils';

interface CaseView {
  id: string;
  emailId: string;
  reason: ReviewReason;
  summary: string;
  suggestion: string;
  evidence: { doc: 'SI' | 'BL'; tone: 'ok' | 'warn' | 'bad'; lines: string[] }[];
  editFields: { field: FieldKey; label: string; si: string | null; bl: string | null }[];
  status: 'open' | 'resolved';
  resolution?: { action: string; note?: string; updatedStatus?: string };
  email: { id: string; subject: string; from: string; category: string; confidence: number; status: string } | null;
}

const TONE_BG: Record<string, string> = { ok: 'bg-emerald-50/70 border-emerald-100', warn: 'bg-amber-50/70 border-amber-100', bad: 'bg-red-50/70 border-red-100' };
const TONE_TEXT: Record<string, string> = { ok: 'text-emerald-700', warn: 'text-amber-700', bad: 'text-red-700' };

function ReviewCard({ kase, onResolve, readOnly }: { kase: CaseView; readOnly: boolean; onResolve: (id: string, action: 'approve' | 'correct' | 'reject', edits?: Record<string, { si?: string; bl?: string }>, note?: string) => Promise<void> }) {
  const [edits, setEdits] = useState<Record<string, { si: string; bl: string }>>(() =>
    Object.fromEntries(kase.editFields.map((f) => [f.field, { si: f.si ?? '', bl: f.bl ?? '' }])),
  );
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const anyEdit = kase.editFields.length > 0;

  const submit = async (action: 'approve' | 'correct' | 'reject') => {
    setBusy(true);
    try {
      await onResolve(kase.id, action, anyEdit ? Object.fromEntries(Object.entries(edits).map(([k, v]) => [k, { si: v.si, bl: v.bl }])) : undefined, note || undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card overflow-hidden animate-fadeUp">
      <div className="px-5 py-4 border-b border-line flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[11px] text-ink-400">{kase.id}</span>
            <ReasonBadge reason={kase.reason}/>
            {kase.email && <CategoryBadge cat={kase.email.category as never}/>}
          </div>
          {kase.email && (
            <div className="mt-1.5">
              <div className="text-[15px] font-semibold text-ink-900 break-words">{kase.email.subject}</div>
              <div className="text-[12px] text-ink-400"><span className="font-mono">{kase.email.id}</span> · {kase.email.from}</div>
            </div>
          )}
        </div>
        {kase.email && <Link href={`/emails/${encodeURIComponent(kase.email.id)}`} className="btn-ghost btn-sm shrink-0">Open item<Icon name="externalLink" size={13}/></Link>}
      </div>

      <div className="px-5 py-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* evidence */}
        <div className="space-y-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Evidence</div>
          {kase.evidence.map((ev, i) => (
            <div key={i} className={cx('rounded-md border px-3 py-2.5', TONE_BG[ev.tone])}>
              <div className={cx('text-[10px] font-semibold uppercase tracking-wider mb-1', TONE_TEXT[ev.tone])}>{ev.doc}</div>
              <div className="space-y-0.5">
                {ev.lines.map((l, j) => (
                  <code key={j} className={cx('block text-[11px] font-mono break-all', TONE_TEXT[ev.tone])}>{l}</code>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* summary + edits */}
        <div className="space-y-3">
          <p className="text-[13.5px] text-ink-800 leading-relaxed">{kase.summary}</p>
          <p className="text-[13px] text-ink-500 rounded-md bg-slate-50 border border-line px-3 py-2"><b className="font-semibold text-ink-700">Suggested next step:</b> {kase.suggestion}</p>

          {anyEdit && (
            <div className="space-y-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Corrections</div>
              {kase.editFields.map((f) => (
                <div key={f.field} className="rounded-md border border-line p-3 space-y-2 bg-slate-50/60">
                  <div className="text-[11.5px] font-semibold text-ink-700">{f.label}</div>
                  {(['si', 'bl'] as const).map((side) => (
                    <div key={side} className="flex items-center gap-2">
                      <span className={cx('text-[9.5px] font-semibold uppercase tracking-wider rounded px-1.5 py-0.5 w-8 text-center shrink-0', side === 'si' ? 'bg-brand-50 text-brand-500' : 'bg-aqua-50 text-aqua-600')}>
                        {side}
                      </span>
                      <TextField
                        compact
                        className="flex-1"
                        placeholder={side === 'si' ? 'Value from SI' : 'Value from draft BL'}
                        value={edits[f.field]?.[side] ?? ''}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [f.field]: { ...prev[f.field], [side]: e.target.value } }))}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {readOnly ? (
            <p className="text-[12.5px] text-ink-400">Your role is read-only. An operator or administrator resolves review cases.</p>
          ) : (<>
          <TextField compact placeholder="Note for the activity log (optional)" aria-label="Note for the activity log" value={note} onChange={(e) => setNote(e.target.value)}/>

          <div className="flex flex-wrap gap-2 pt-1">
            {anyEdit && (
              <button onClick={() => void submit('correct')} disabled={busy} className="btn-primary btn-sm">
                <Icon name="pencil" size={13}/>{busy ? 'Saving' : 'Correct and approve'}
              </button>
            )}
            <button onClick={() => void submit('approve')} disabled={busy} className={cx('btn-sm', anyEdit ? 'btn-ghost' : 'btn-primary')} title="Close the case; the item stays marked as needing review, with your note">
              <Icon name="userCheck" size={13}/>Mark as reviewed
            </button>
            <button onClick={() => void submit('reject')} disabled={busy} className="btn-danger-o btn-sm" title="Close the case and record that the documents were rejected">
              <Icon name="x" size={13}/>Reject documents
            </button>
          </div>
          </>)}
        </div>
      </div>
    </div>
  );
}

export default function ReviewsPage() {
  const toast = useToast();
  const { user } = useSession();
  const [open, setOpen] = useState<CaseView[] | null>(null);
  const [resolved, setResolved] = useState<CaseView[]>([]);
  const [filter, setFilter] = useState<'ALL' | ReviewReason>('ALL');
  const [sel, setSel] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/reviews');
    const d = await r.json();
    setOpen(d.open);
    setResolved(d.resolved);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const resolve = async (id: string, action: 'approve' | 'correct' | 'reject', edits?: Record<string, { si?: string; bl?: string }>, note?: string) => {
    const r = await fetch(`/api/reviews/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, edits, note }),
    });
    const d = await r.json();
    if (!r.ok || d.error) {
      toast('Could not resolve the case', d.error ?? 'Unknown error', 'danger');
      return;
    }
    if (d.stillOpen) {
      toast('Corrections saved', 'Some required values are still missing, so the case stays open.', 'warn');
    } else {
      const label: Record<string, string> = { OK: 'Match', MISMATCH: 'Discrepancy', NEEDS_REVIEW: 'Needs review' };
      toast(
        action === 'correct' ? 'Correction applied' : action === 'approve' ? 'Marked as reviewed' : 'Documents rejected',
        d.status ? `Result: ${label[d.status] ?? d.status}` : undefined,
        d.status === 'OK' ? 'success' : d.status === 'MISMATCH' ? 'danger' : 'info',
      );
      setSel(null);
    }
    await load();
  };

  const shown = useMemo(() => (open ?? []).filter((k) => filter === 'ALL' || k.reason === filter), [open, filter]);
  const reasonCounts = useMemo(() => {
    const m = new Map<ReviewReason, number>();
    for (const k of open ?? []) m.set(k.reason, (m.get(k.reason) ?? 0) + 1);
    return m;
  }, [open]);
  const current = shown.find((k) => k.id === sel) ?? shown[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Review queue</h1>
          <p className="page-sub">Cases the engine could not decide on its own. Check the evidence, then correct, mark as reviewed or reject.</p>
        </div>
        <div className="text-[12.5px] text-ink-400">{open ? `${open.length} open · ${resolved.length} resolved` : ''}</div>
      </div>

      {open === null ? (
        <div className="grid lg:grid-cols-[340px_1fr] gap-4"><Skeleton className="h-96"/><Skeleton className="h-96"/></div>
      ) : open.length === 0 ? (
        <div className="card">
          <EmptyState icon="checkCircle" title="The review queue is empty" sub="New cases appear here when the engine cannot decide on its own."/>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[340px_minmax(0,1fr)] gap-4 items-start">
          <section className="card overflow-hidden lg:sticky lg:top-20" aria-label="Open cases">
            <div className="p-3 border-b border-line">
              <label className="flex items-center gap-2 text-[12.5px] text-ink-500">
                <span className="whitespace-nowrap">Reason</span>
                <select value={filter} onChange={(e) => { setFilter(e.target.value as 'ALL' | ReviewReason); setSel(null); }} className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[13px] text-ink-800">
                  <option value="ALL">All reasons ({open.length})</option>
                  {[...reasonCounts.entries()].map(([r, n]) => <option key={r} value={r}>{REVIEW_REASONS[r].label} ({n})</option>)}
                </select>
              </label>
            </div>
            <ul className="divide-y divide-line max-h-[70vh] overflow-y-auto">
              {shown.map((k) => {
                const active = current?.id === k.id;
                return (
                  <li key={k.id}>
                    <button
                      onClick={() => setSel(k.id)}
                      aria-current={active ? 'true' : undefined}
                      className={cx('w-full text-left px-4 py-3 transition-colors relative', active ? 'bg-brand-50' : 'hover:bg-slate-50')}
                    >
                      {active && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-brand-600" aria-hidden="true"/>}
                      <div className="text-[13px] font-medium text-ink-900 truncate">{k.email?.subject ?? k.emailId}</div>
                      <div className="mt-1 flex items-center gap-2 min-w-0">
                        <ReasonBadge reason={k.reason}/>
                        <span className="text-[11.5px] font-mono text-ink-400 truncate">{k.emailId}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
          {current && <ReviewCard key={current.id} kase={current} onResolve={resolve} readOnly={!can(user, 'operator')}/>}
        </div>
      )}

      {resolved.length > 0 && (
        <details className="card group">
          <summary className="cursor-pointer list-none px-5 py-3.5 flex items-center gap-2 text-[14px] font-semibold text-ink-900">
            <Icon name="chevronRight" size={15} className="text-ink-400 transition-transform group-open:rotate-90"/>Resolved cases
            <span className="text-[12.5px] font-normal text-ink-400">({resolved.length})</span>
          </summary>
          <div className="divide-y divide-line border-t border-line">
            {resolved.slice().reverse().slice(0, 25).map((k) => (
              <Link key={k.id} href={`/emails/${encodeURIComponent(k.emailId)}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50">
                <ReasonBadge reason={k.reason}/>
                <span className="text-[13px] text-ink-700 truncate flex-1">{k.email?.subject ?? k.emailId}</span>
                <span className="text-[12px] text-ink-400 shrink-0">{({ approve: 'Marked as reviewed', correct: 'Corrected', reject: 'Rejected' } as Record<string, string>)[k.resolution?.action ?? ''] ?? ''}</span>
                {k.resolution?.updatedStatus && <StatusMini status={k.resolution.updatedStatus}/>}
              </Link>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function StatusMini({ status }: { status: string }) {
  const map: Record<string, [string, string]> = { OK: ['bg-emerald-50 text-emerald-800', 'Match'], MISMATCH: ['bg-red-50 text-red-800', 'Discrepancy'], NEEDS_REVIEW: ['bg-amber-50 text-amber-800', 'Needs review'] };
  const [c, l] = map[status] ?? ['bg-slate-100 text-ink-500', status];
  return <span className={cx('tag shrink-0', c)}>{l}</span>;
}
