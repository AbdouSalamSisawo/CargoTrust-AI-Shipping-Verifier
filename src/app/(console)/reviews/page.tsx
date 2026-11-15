'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { REVIEW_REASONS, type ReviewReason, type FieldKey } from '@/data/taxonomy';
import { Icon } from '@/components/icons';
import { ReasonBadge, CategoryBadge, ConfBar, TextField, Skeleton, EmptyState, useToast, M } from '@/components/ui';
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

function ReviewCard({ kase, onResolve }: { kase: CaseView; onResolve: (id: string, action: 'approve' | 'correct' | 'reject', edits?: Record<string, { si?: string; bl?: string }>, note?: string) => Promise<void> }) {
  const reasonMeta = REVIEW_REASONS[kase.reason];
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
    <M from={{ opacity: 0, transform: 'translateY(16px)' }} to={{ opacity: 1, transform: 'none' }} className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-line flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[11px] text-ink-400">{kase.id}</span>
            <ReasonBadge reason={kase.reason}/>
            {kase.email && <CategoryBadge cat={kase.email.category as never}/>}
          </div>
          {kase.email && (
            <a href={`/emails/${kase.email.id}`} className="block mt-1.5 group">
              <div className="text-[13.5px] font-semibold text-ink-800 group-hover:text-brand-600 transition-colors truncate max-w-xl">{kase.email.subject}</div>
              <div className="text-[11px] text-ink-400 font-mono truncate">{kase.email.id} · {kase.email.from}</div>
            </a>
          )}
        </div>
        {kase.email && <ConfBar v={kase.email.confidence}/>}
      </div>

      <div className="px-5 py-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* evidence */}
        <div className="space-y-2.5">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-400">Engine evidence</div>
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
          <p className="text-[12.5px] text-ink-500 leading-relaxed">{kase.summary}</p>
          <p className="text-[12px] text-ink-400 italic">{kase.suggestion}</p>

          {anyEdit && (
            <div className="space-y-2.5">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-400">Reviewer corrections</div>
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

          <TextField compact placeholder="Optional note for the audit trail…" value={note} onChange={(e) => setNote(e.target.value)}/>

          <div className="flex flex-wrap gap-2 pt-1">
            {anyEdit && (
              <button onClick={() => void submit('correct')} disabled={busy} className="btn-primary btn-sm">
                <Icon name="pencil" size={13}/>{busy ? 'Saving…' : 'Correct & approve'}
              </button>
            )}
            <button onClick={() => void submit('approve')} disabled={busy} className={cx('btn-sm', anyEdit ? 'btn-ghost' : 'btn-primary')}>
              <Icon name="userCheck" size={13}/>Approve escalation
            </button>
            <button onClick={() => void submit('reject')} disabled={busy} className="btn-danger-o btn-sm">
              <Icon name="x" size={13}/>Reject
            </button>
          </div>
        </div>
      </div>
    </M>
  );
}

export default function ReviewsPage() {
  const toast = useToast();
  const [open, setOpen] = useState<CaseView[] | null>(null);
  const [resolved, setResolved] = useState<CaseView[]>([]);
  const [filter, setFilter] = useState<'ALL' | ReviewReason>('ALL');

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
      toast('Could not resolve case', d.error ?? 'Unknown error', 'danger');
      return;
    }
    if (d.stillOpen) {
      toast('Corrections saved. The case is still open', 'Some required values are still missing.', 'warn');
    } else {
      toast(
        action === 'correct' ? 'Correction applied' : action === 'approve' ? 'Escalation approved' : 'Case rejected',
        d.status ? `Email result: ${d.status.replace('_', ' ')}` : undefined,
        d.status === 'OK' ? 'success' : d.status === 'MISMATCH' ? 'danger' : 'info',
      );
    }
    await load();
  };

  const shown = useMemo(() => (open ?? []).filter((k) => filter === 'ALL' || k.reason === filter), [open, filter]);
  const reasonCounts = useMemo(() => {
    const m = new Map<ReviewReason, number>();
    for (const k of open ?? []) m.set(k.reason, (m.get(k.reason) ?? 0) + 1);
    return m;
  }, [open]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Human Review</h1>
          <p className="page-sub">Cases the engine could not decide on its own. Confirm, correct or reject each one.</p>
        </div>
        <div className="text-[12.5px] font-semibold text-ink-400">{open ? `${shown.length} open · ${resolved.length} resolved` : ''}</div>
      </div>

      {open === null ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64"/>)}</div>
      ) : open.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="shieldCheck"
            tint="#10B981"
            title="Review queue is clear"
            sub="Every email in the inbox was decided by the engine with sufficient confidence. New escalations will appear here."
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilter('ALL')}
              className={cx('px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors border', filter === 'ALL' ? 'bg-navy-900 text-white border-transparent' : 'bg-white text-ink-500 hover:bg-slate-50 border-line')}
            >
              All reasons
            </button>
            {[...reasonCounts.entries()].map(([r, n]) => (
              <button
                key={r}
                onClick={() => setFilter(r)}
                className={cx('px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors inline-flex items-center gap-1.5 border', filter === r ? 'text-white border-transparent' : 'bg-white text-ink-500 hover:bg-slate-50 border-line')}
                style={filter === r ? { background: REVIEW_REASONS[r].color } : undefined}
              >
                <Icon name={REVIEW_REASONS[r].icon} size={12}/>{REVIEW_REASONS[r].label} · {n}
              </button>
            ))}
          </div>
          <div className="space-y-4">
            {shown.map((k) => <ReviewCard key={k.id} kase={k} onResolve={resolve}/>)}
          </div>
        </>
      )}

      {resolved.length > 0 && (
        <div className="card p-5">
          <h3 className="text-[14px] font-semibold text-ink-900 mb-3 flex items-center gap-2"><Icon name="clipboardCheck" size={15} className="text-ink-400"/>Resolved cases</h3>
          <div className="divide-y divide-line">
            {resolved.slice().reverse().slice(0, 8).map((k) => (
              <div key={k.id} className="flex items-center gap-3 py-2.5">
                <span className="font-mono text-[11px] text-ink-400 shrink-0">{k.id}</span>
                <ReasonBadge reason={k.reason}/>
                <span className="text-[12px] text-ink-500 truncate flex-1">{k.email?.subject ?? k.emailId}</span>
                <span className="text-[11px] font-semibold capitalize text-ink-400 shrink-0">{k.resolution?.action}</span>
                {k.resolution?.updatedStatus && <StatusMini status={k.resolution.updatedStatus}/>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusMini({ status }: { status: string }) {
  const map: Record<string, string> = { OK: 'bg-emerald-50 text-emerald-600', MISMATCH: 'bg-red-50 text-red-600', NEEDS_REVIEW: 'bg-amber-50 text-amber-600' };
  return <span className={cx('text-[10px] font-semibold uppercase tracking-wider rounded px-1.5 py-0.5', map[status] ?? 'bg-slate-100 text-ink-500')}>{status.replace('_', ' ')}</span>;
}
