'use client';

import type { ProcessedEmail } from '@/lib/types';
import { Icon } from '@/components/icons';
import { useToast } from '@/components/ui';
import { cx } from '@/lib/utils';
import { buildTrace, type StepState, type TraceStep } from '@/lib/engine/trace';
import { draftReply, type DraftReply } from '@/lib/engine/reply';

const STEP_STYLE: Record<StepState, { icon: string; color: string; bg: string }> = {
  pass: { icon: 'check', color: '#059669', bg: 'bg-emerald-50' },
  flag: { icon: 'alertTriangle', color: '#DC2626', bg: 'bg-red-50' },
  stop: { icon: 'helpCircle', color: '#D97706', bg: 'bg-amber-50' },
  skip: { icon: 'arrowRight', color: '#64748B', bg: 'bg-slate-100' },
  info: { icon: 'info', color: '#2563EB', bg: 'bg-brand-50' },
};

/** Step-by-step reasoning: why the engine decided what it decided. */
export function DecisionTrace({ email, steps: given }: { email?: ProcessedEmail; steps?: TraceStep[] }) {
  const steps = given ?? (email ? buildTrace(email) : []);
  return (
    <div className="card p-5">
      <h3 className="text-[14px] font-semibold text-ink-900 mb-1 flex items-center gap-2"><Icon name="activity" size={15} className="text-brand-500"/>Decision trace</h3>
      <p className="text-[11.5px] text-ink-400 mb-4">How the engine reached this result. Every step is rule-based and can be checked.</p>
      <ol className="relative space-y-4">
        {steps.map((s, i) => {
          const st = STEP_STYLE[s.state];
          return (
            <li key={s.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={cx('w-7 h-7 rounded-full flex items-center justify-center shrink-0', st.bg)} style={{ color: st.color }}>
                  <Icon name={st.icon} size={14} strokeWidth={2.5}/>
                </span>
                {i < steps.length - 1 && <span className="w-px flex-1 bg-slate-200 mt-1"/>}
              </div>
              <div className="min-w-0 pb-1">
                <div className="text-[12.5px] font-semibold text-ink-800">{s.title}</div>
                <div className="text-[11.5px] text-ink-500 mt-0.5">{s.detail}</div>
                {s.items && s.items.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {s.items.map((it) => (
                      <li key={it} className="text-[11px] font-mono text-ink-500 bg-slate-50 border border-line rounded-md px-2 py-1 break-words">{it}</li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** The email an operator would send next — values come only from the comparison. */
export function ReplyDraft({ email, draft, organisation }: { email?: ProcessedEmail; draft?: DraftReply | null; organisation?: string }) {
  const toast = useToast();
  const d = draft !== undefined ? draft : email ? draftReply(email, organisation) : null;
  if (!d) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${d.subject}\n\n${d.body}`);
      toast('Copied', 'Draft reply copied to the clipboard.', 'success');
    } catch {
      toast('Copy failed', 'Select the text and copy it manually.', 'warn');
    }
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-[14px] font-semibold text-ink-900 flex items-center gap-2"><Icon name="send" size={15} className="text-brand-500"/>Draft reply · {d.purpose}</h3>
          <p className="text-[11.5px] text-ink-400 mt-0.5">To {d.to}. Written from the comparison results only. Review it before sending.</p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button onClick={copy} className="btn-ghost btn-sm"><Icon name="files" size={13}/>Copy</button>
          <a href={`mailto:${/@/.test(d.to) ? encodeURIComponent(d.to) : ''}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`} className="btn-primary btn-sm"><Icon name="send" size={13}/>Open in mail app</a>
        </div>
      </div>
      <div className="rounded-md border border-line bg-slate-50/60 p-3">
        <div className="text-[11.5px] font-semibold text-ink-600 mb-2">Subject: {d.subject}</div>
        <pre className="text-[11.5px] leading-relaxed text-ink-600 whitespace-pre-wrap font-mono">{d.body}</pre>
      </div>
    </div>
  );
}
