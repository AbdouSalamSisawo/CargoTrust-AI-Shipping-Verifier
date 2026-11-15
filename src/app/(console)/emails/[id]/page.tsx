'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { ProcessedEmail, ReviewCase, FieldRow, AuditEvent } from '@/lib/types';
import { useSession, can } from '@/components/shell';
import { CATEGORIES, CATEGORY_ORDER } from '@/data/taxonomy';
import { Icon } from '@/components/icons';
import { CategoryBadge, StatusBadge, ReasonBadge, ConfBar, Skeleton, useToast, M } from '@/components/ui';
import { cx } from '@/lib/utils';
import { METHOD_LABEL } from '@/lib/engine/trace';
import { DecisionTrace, ReplyDraft } from '@/components/engine-views';

function MatchChip({ m }: { m: boolean | null }) {
  if (m === null) return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold bg-slate-100 text-slate-400">n/a</span>;
  return m ? (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold bg-emerald-50 text-emerald-600"><Icon name="check" size={11} strokeWidth={3}/>Match</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold bg-red-50 text-red-600"><Icon name="x" size={11} strokeWidth={3}/>Differs</span>
  );
}

/** Full source text of one attachment, with the lines the engine used highlighted. */
function AttachmentRow({ att, emailId, rows }: { att: ProcessedEmail['attachments'][number]; emailId: string; rows: FieldRow[] }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [aiText, setAiText] = useState<string | null>(null);
  const [view, setView] = useState<'ai' | 'ocr'>('ai');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const kind = att.kind === 'BL' ? 'bl' : 'si';
  const evidenceLines = rows.map((r) => r.evidence[kind]).filter((l): l is string => Boolean(l));
  const defectLines = rows.filter((r) => r.match === false).map((r) => r.evidence[kind]).filter((l): l is string => Boolean(l));
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

  const toggle = async () => {
    setOpen(!open);
    if (!open && text === null && !err) {
      setLoading(true);
      try {
        const r = await fetch(`/api/emails/${emailId}/source?att=${encodeURIComponent(att.path)}`);
        const d = await r.json();
        if (!r.ok || d.error) setErr(d.error ?? 'Could not load source');
        else {
          setText(d.text ?? `[${d.ext.toUpperCase()} — no text could be read]`);
          setAiText(d.aiText ?? null);
        }
      } catch {
        setErr('Network error');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
        <span className={cx('w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold uppercase',
          att.kind === 'SI' ? 'bg-brand-50 text-brand-600' : att.kind === 'BL' ? 'bg-aqua-50 text-aqua-600' : 'bg-slate-100 text-slate-400')}>
          {att.kind === 'other' ? att.ext : att.kind}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold text-ink-800 truncate">{att.name}</div>
          <div className="text-[11px] text-slate-400">
            {att.kind === 'SI' ? 'Shipping Instruction' : att.kind === 'BL' ? 'Draft Bill of Lading' : 'Unidentified document'}
            {' · '}
            {!att.readable ? (
              <span className="text-red-500 font-semibold">{att.error ?? 'unreadable'}</span>
            ) : att.ai && !att.ai.error ? (
              <span className="text-ai-600 font-semibold">
                scan → AI read ({att.ai.model})
                {att.ai.agreement && (() => {
                  const v = Object.values(att.ai.agreement).filter((x) => x != null);
                  return v.length ? ` · OCR agrees ${v.filter(Boolean).length}/${v.length}` : '';
                })()}
                {att.ai.unclear.length > 0 && <span className="text-amber-600"> · unclear: {att.ai.unclear.join(', ')}</span>}
              </span>
            ) : att.method === 'pdf-ocr' || att.method === 'image-ocr' ? (
              <span className="text-amber-600 font-semibold">{att.method === 'image-ocr' ? 'photo' : 'scan'} → OCR {att.ocrConfidence}%{att.ai?.error ? ` · AI read failed: ${att.ai.error}` : ''}</span>
            ) : (
              <span className="text-emerald-600 font-semibold">{METHOD_LABEL[att.method ?? 'text'] ?? 'text extracted'}</span>
            )}
          </div>
        </div>
        {att.kind !== 'other' && (
          <span className={cx('text-[9.5px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5',
            att.kind === 'SI' ? 'bg-brand-50 text-brand-500' : 'bg-aqua-50 text-aqua-600')}>{att.kind}</span>
        )}
        <a href={`/api/emails/${encodeURIComponent(emailId)}/source?att=${encodeURIComponent(att.path)}&raw=1`} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-slate-400 hover:text-brand-600 transition-colors inline-flex items-center gap-1 shrink-0" title="Open the original file">
          <Icon name="externalLink" size={12}/>Original
        </a>
        <button onClick={toggle} className="text-[11px] font-bold text-brand-500 hover:text-brand-600 transition-colors inline-flex items-center gap-1 shrink-0">
          <Icon name="eye" size={12}/>{open ? 'Hide text' : 'What was read'}
        </button>
      </div>
      {open && (
        <div className="mt-1.5 rounded-xl border border-slate-200 bg-navy-950 max-h-80 overflow-auto">
          {loading ? (
            <div className="p-4 text-[11.5px] font-mono text-slate-400">Loading source…</div>
          ) : err ? (
            <div className="p-4 text-[11.5px] font-mono text-red-300">{err}</div>
          ) : (
            <>
            {aiText && (
              <div className="sticky top-0 flex gap-1 p-2 bg-navy-950/95 border-b border-white/10">
                {(['ai', 'ocr'] as const).map((k) => (
                  <button key={k} onClick={() => setView(k)} className={cx('px-2.5 py-1 rounded-md text-[10.5px] font-bold', view === k ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-slate-200')}>
                    {k === 'ai' ? 'AI transcription (used)' : 'OCR text (cross-check)'}
                  </button>
                ))}
              </div>
            )}
            <pre className="p-4 text-[10.5px] leading-relaxed font-mono whitespace-pre-wrap">
              {((aiText && view === 'ai' ? aiText : text) ?? '').split(/\r?\n/).map((line, i) => {
                const isEv = evidenceLines.some((l) => norm(l) === norm(line));
                const isDef = defectLines.some((l) => norm(l) === norm(line));
                return (
                  <div
                    key={i}
                    className={cx(
                      'px-2 -mx-2 rounded',
                      isDef ? 'bg-red-500/25 text-red-200 font-semibold' : isEv ? 'bg-amber-400/15 text-amber-100' : 'text-slate-400',
                    )}
                  >
                    {line || ' '}
                  </div>
                );
              })}
            </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Evidence({ row }: { row: FieldRow }) {
  const has = row.evidence.si || row.evidence.bl;
  if (!has) return null;
  return (
    <details className="mt-1.5 group/ev">
      <summary className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-brand-500 cursor-pointer select-none list-none">
        <Icon name="chevronRight" size={11} className="transition-transform group-open/ev:rotate-90"/>Source lines
      </summary>
      <div className="mt-1.5 space-y-1">
        {row.evidence.si && (
          <div className="flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-brand-500 mt-0.5 shrink-0 w-6">SI</span>
            <code className="text-[11px] text-slate-500 font-mono break-all">{row.evidence.si}</code>
          </div>
        )}
        {row.evidence.bl && (
          <div className="flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-aqua-600 mt-0.5 shrink-0 w-6">BL</span>
            <code className="text-[11px] text-slate-500 font-mono break-all">{row.evidence.bl}</code>
          </div>
        )}
      </div>
    </details>
  );
}

export default function EmailDetailPage() {
  const params = useParams<{ id: string }>();
  const toast = useToast();
  const [email, setEmail] = useState<ProcessedEmail | null>(null);
  const [kase, setCase] = useState<ReviewCase | null>(null);
  const [history, setHistory] = useState<AuditEvent[]>([]);
  const [org, setOrg] = useState<string | undefined>();
  const { user } = useSession();
  const router = useRouter();
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/emails/${params.id}`);
    if (r.status === 404) { setMissing(true); return; }
    const d = await r.json();
    setEmail(d.email);
    setCase(d.reviewCase);
    setHistory(d.history ?? []);
    setOrg(d.organisation);
  }, [params.id]);

  useEffect(() => { void load(); }, [load]);

  const reprocess = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/emails/${params.id}`, { method: 'POST' });
      const d = await r.json();
      if (d.ok) {
        toast('Check re-run', d.summary ?? `Result: ${d.status}`, d.status === 'OK' ? 'success' : d.status === 'MISMATCH' ? 'danger' : 'warn');
        await load();
      } else {
        toast('Cannot re-run', d.error ?? 'Unknown error', 'warn');
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this item and its documents? This cannot be undone.')) return;
    const d = await fetch(`/api/emails/${params.id}`, { method: 'DELETE' }).then((r) => r.json());
    if (d.ok) {
      toast('Deleted', 'The item and its files were removed.', 'success');
      router.push('/emails');
    } else toast('Not deleted', d.error ?? 'Unknown error', 'danger');
  };

  if (missing) {
    return (
      <div className="card p-10 text-center">
        <Icon name="alertCircle" size={28} className="mx-auto text-slate-300"/>
        <h2 className="font-display text-lg font-bold text-navy-900 mt-3">Email not found</h2>
        <Link href="/emails" className="btn-ghost btn-sm mt-4 inline-flex"><Icon name="arrowLeft" size={14}/>Back to inbox</Link>
      </div>
    );
  }
  if (!email) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-1/2"/>
        <Skeleton className="h-40"/>
        <Skeleton className="h-72"/>
      </div>
    );
  }

  const isDoc = email.category === 'BL_COMPARISON';
  const scores = email.categoryScores ?? {};
  const maxScore = Math.max(1, ...CATEGORY_ORDER.map((c) => scores[c] ?? 0));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/emails" className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-slate-400 hover:text-brand-500 transition-colors">
          <Icon name="arrowLeft" size={14}/>Inbox
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4 mt-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-mono text-[11.5px] text-slate-400">
              {email.id}
              <span>·</span>
              <span className="truncate max-w-[420px]">{email.from}</span>
              {email.receivedAt && <><span>·</span><span>{new Date(email.receivedAt).toLocaleString()}</span></>}
              {email.source && email.source !== 'sample' && (
                <span className="ml-1 rounded-md bg-brand-50 text-brand-600 px-1.5 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wider">
                  {email.source === 'upload' ? 'Uploaded' : 'Imported email'}{email.createdBy ? ` by ${email.createdBy}` : ''}
                </span>
              )}
              {email.aiRead && <span className="rounded-md bg-violet-50 text-violet-600 px-1.5 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wider">AI-read scan</span>}
            </div>
            <h1 className="font-display text-[21px] font-bold text-navy-900 tracking-tight mt-1 max-w-3xl">{email.subject}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <CategoryBadge cat={email.category}/>
              <StatusBadge status={email.status}/>
              {email.reviewReason && <ReasonBadge reason={email.reviewReason}/>}
              <ConfBar v={email.confidence}/>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {can(user, 'operator') && email.attachments.length > 0 && (
              <button onClick={reprocess} disabled={busy} className="btn-ghost btn-sm" title="Read the documents again and re-run every check">
                <Icon name="refresh" size={14} className={busy ? 'animate-spin' : ''}/>{busy ? 'Running…' : 'Re-run check'}
              </button>
            )}
            {can(user, 'operator') && email.source && email.source !== 'sample' && (
              <button onClick={remove} className="btn-danger-o btn-sm"><Icon name="trash" size={14}/>Delete</button>
            )}
            {kase && kase.status === 'open' && (
              <Link href="/reviews" className="btn-primary btn-sm"><Icon name="clipboardCheck" size={14}/>Open in review queue</Link>
            )}
          </div>
        </div>
      </div>

      {/* summary */}
      <M from={{ opacity: 0, y: 10 }} to={{ opacity: 1, y: 0 }} className={cx(
        'rounded-2xl border p-4 flex items-start gap-3',
        email.status === 'OK' && 'bg-emerald-50/70 border-emerald-100',
        email.status === 'MISMATCH' && 'bg-red-50/70 border-red-100',
        email.status === 'NEEDS_REVIEW' && 'bg-amber-50/70 border-amber-100',
      )}>
        <span
          className="shrink-0 mt-0.5"
          style={{ color: email.status === 'OK' ? '#059669' : email.status === 'MISMATCH' ? '#DC2626' : '#D97706' }}
        >
          <Icon name={email.status === 'OK' ? 'checkCircle' : email.status === 'MISMATCH' ? 'xCircle' : 'helpCircle'} size={20}/>
        </span>
        <div>
          <div className="text-[13.5px] font-bold text-ink-800">{email.summary}</div>
          {email.notes?.map((n) => (
            <div key={n} className="text-[11.5px] text-slate-500 mt-1 flex items-center gap-1.5"><Icon name="info" size={12}/>{n}</div>
          ))}
          {email.reviewed && (
            <div className="text-[11.5px] text-slate-500 mt-1">
              Reviewer action: <b className="capitalize">{email.reviewed.action}</b>{email.reviewed.by ? ` by ${email.reviewed.by}` : ''}{email.reviewed.at ? ` · ${new Date(email.reviewed.at).toLocaleString()}` : ''}{email.reviewed.note ? ` — “${email.reviewed.note}”` : ''}
            </div>
          )}
        </div>
      </M>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* left: body + attachments */}
        <div className="xl:col-span-1 space-y-5">
          <div className="card p-5">
            <h3 className="font-bold text-[14px] text-navy-900 mb-3 flex items-center gap-2"><Icon name="mail" size={15} className="text-slate-400"/>Message</h3>
            <pre className="text-[12.5px] leading-relaxed text-slate-500 whitespace-pre-wrap font-sans max-h-72 overflow-y-auto">{email.body}</pre>
          </div>
          <div className="card p-5">
            <h3 className="font-bold text-[14px] text-navy-900 mb-3 flex items-center gap-2">
              <Icon name="paperclip" size={15} className="text-slate-400"/>Attachments
              <span className="text-slate-300 font-semibold">({email.attachments.length})</span>
            </h3>
            {email.attachments.length === 0 ? (
              <p className="text-[12.5px] text-slate-400">No attachments on this email.</p>
            ) : (
              <div className="space-y-2">
                {email.attachments.map((a) => (
                  <AttachmentRow key={a.path} att={a} emailId={email.id} rows={email.comparison?.rows ?? []} />
                ))}
              </div>
            )}
          </div>

          {/* classification scores */}
          <div className="card p-5">
            <h3 className="font-bold text-[14px] text-navy-900 mb-3 flex items-center gap-2"><Icon name="sparkles" size={15} className="text-ai-500"/>Classifier scores</h3>
            <div className="space-y-2.5">
              {CATEGORY_ORDER.map((c) => {
                const v = scores[c] ?? 0;
                return (
                  <div key={c} className="flex items-center gap-2.5">
                    <span className="w-28 text-[11.5px] font-semibold text-slate-500 truncate">{CATEGORIES[c].label}</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(v / maxScore) * 100}%`, background: CATEGORIES[c].color, opacity: v === 0 ? 0.15 : 1 }}/>
                    </div>
                    <span className="w-8 text-right text-[11px] font-bold tabular-nums text-slate-400">{v || '–'}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {history.length > 0 && (
            <div className="card p-5">
              <h3 className="font-bold text-[14px] text-navy-900 mb-3 flex items-center gap-2"><Icon name="history" size={15} className="text-slate-400"/>History</h3>
              <ol className="space-y-2.5">
                {history.map((h) => (
                  <li key={h.id} className="text-[12px] leading-snug">
                    <div className="text-slate-600"><b className="text-ink-800">{h.userName}</b> · {h.action.replace(/^[a-z]+\./, '').replace(/_/g, ' ')}</div>
                    {h.detail && <div className="text-slate-400 truncate" title={h.detail}>{h.detail}</div>}
                    <div className="text-[10.5px] text-slate-300 tabular-nums">{new Date(h.at).toLocaleString()}</div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* right: comparison */}
        <div className="xl:col-span-2 space-y-5">
          <DecisionTrace email={email}/>
          {isDoc && email.comparison && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-[14px] text-navy-900 flex items-center gap-2">
                    <Icon name="gitCompare" size={15} className="text-brand-500"/>SI ↔ BL comparison
                    {email.status === 'NEEDS_REVIEW' && (
                      <span className="text-[10px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 bg-amber-100 text-amber-700">
                        {email.reviewReason === 'unreadable' ? (email.aiRead ? 'AI pre-check · confirm against the scan' : 'OCR pre-check · not final') : 'partial · not final'}
                      </span>
                    )}
                  </h3>
                  <p className="text-[11.5px] text-slate-400 mt-0.5">Seven canonical fields, SI as the reference document</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 bg-brand-50 text-brand-500">SI</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 bg-aqua-50 text-aqua-600">BL</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead className="bg-slate-50/80 border-b border-slate-100">
                    <tr>
                      <th className="th">Field</th>
                      <th className="th">SI value</th>
                      <th className="th">BL value</th>
                      <th className="th">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {email.comparison.rows.map((row) => {
                      const defect = row.match === false;
                      return (
                        <tr key={row.field} className={cx('align-top', defect && 'bg-red-50/40')}>
                          <td className="px-4 py-3">
                            <div className="text-[12.5px] font-bold text-ink-800 whitespace-nowrap">{row.label}</div>
                            <Evidence row={row}/>
                          </td>
                          {(['si', 'bl'] as const).map((side) => {
                            const doc = email.extracted?.[side];
                            const derived = doc?.derived?.[row.field];
                            const ph = doc?.placeholders?.[row.field];
                            return (
                              <td key={side} className={cx('px-4 py-3 text-[12.5px] font-mono', defect ? 'text-red-700 font-semibold' : 'text-slate-600')}>
                                {row[side] ?? (ph ? <span className="text-amber-600">placeholder “{ph}”</span> : <span className="text-slate-300">—</span>)}
                                {derived && <div className="text-[10.5px] font-sans font-medium text-slate-400 mt-0.5">{derived}</div>}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3"><MatchChip m={row.match}/></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-100 text-[11.5px] text-slate-400">
                {email.comparison.defectFields.length === 0
                  ? 'No mismatch detected — all 7 fields match.'
                  : `${email.comparison.defectFields.length} field${email.comparison.defectFields.length > 1 ? 's' : ''} differ: ${email.comparison.defectFields.join(', ').replace(/_/g, ' ')}.`}
              </div>
            </div>
          )}

          {isDoc && !email.comparison && email.extracted && (
            <div className="card p-5">
              <h3 className="font-bold text-[14px] text-navy-900 mb-3 flex items-center gap-2"><Icon name="scan" size={15} className="text-amber-500"/>Partial extraction</h3>
              <div className="grid grid-cols-2 gap-4">
                {(['si', 'bl'] as const).map((side) => (
                  <div key={side} className="rounded-xl border border-slate-100 p-3">
                    <div className="text-[10.5px] font-bold uppercase tracking-wider mb-2" style={{ color: side === 'si' ? '#2563EB' : '#0891B2' }}>
                      {side.toUpperCase()} · {Math.round((email.extracted![side].completeness) * 100)}% fields
                    </div>
                    <div className="space-y-1.5">
                      {email.extracted![side].lines && Object.entries(email.extracted![side].lines).length > 0 ? (
                        Object.values(email.extracted![side].lines).map((l, i) => (
                          <code key={i} className="block text-[11px] text-slate-500 font-mono bg-slate-50 rounded px-2 py-1">{l}</code>
                        ))
                      ) : (
                        <span className="text-[11.5px] text-slate-400">Nothing could be extracted from this document.</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <ReplyDraft email={email} organisation={org}/>

          {/* review case */}
          {kase && (
            <div className="card p-5 border-amber-200 bg-amber-50/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-[14px] text-navy-900 flex items-center gap-2"><Icon name="userCheck" size={15} className="text-amber-500"/>Review case {kase.id}</h3>
                  <p className="text-[12px] text-slate-500 mt-1.5">{kase.summary}</p>
                  <p className="text-[12px] text-slate-400 mt-1 italic">{kase.suggestion}</p>
                </div>
                <span className={cx('shrink-0 text-[10px] font-bold uppercase tracking-wider rounded-md px-2 py-1', kase.status === 'open' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500')}>
                  {kase.status}
                </span>
              </div>
              {kase.resolution && (
                <div className="mt-3 text-[11.5px] text-slate-500">
                  Resolution: <b className="capitalize">{kase.resolution.action}</b>
                  {kase.resolution.updatedStatus ? ` → ${kase.resolution.updatedStatus}` : ''}{kase.resolution.note ? ` — “${kase.resolution.note}”` : ''}
                </div>
              )}
              {kase.status === 'open' && <Link href="/reviews" className="btn-primary btn-sm mt-4 inline-flex"><Icon name="arrowRight" size={14}/>Resolve in review queue</Link>}
            </div>
          )}

          {!isDoc && (
            <div className="card p-8 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-50 text-slate-300 flex items-center justify-center">
                <Icon name="gitCompare" size={26}/>
              </div>
              <h3 className="font-display text-[15px] font-bold text-navy-900 mt-3">No document comparison required</h3>
              <p className="text-[12.5px] text-slate-400 mt-1.5 max-w-sm mx-auto">
                Only document-check requests continue to the SI ↔ BL comparison. This email was classified as{' '}
                <b className="text-slate-500">{CATEGORIES[email.category].label}</b> and routed accordingly.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
