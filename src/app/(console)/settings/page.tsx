'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Settings } from '@/lib/types';
import { Icon } from '@/components/icons';
import { SettingRow, TextField, Skeleton, useToast, M } from '@/components/ui';

export default function SettingsPage() {
  const toast = useToast();
  const router = useRouter();
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then(setS).catch(() => toast('Could not load settings', '', 'danger'));
  }, [toast]);

  const save = async () => {
    if (!s) return;
    setSaving(true);
    try {
      const r = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
      const d = await r.json();
      if (d.ok) toast('Settings saved', 'Preferences persisted to the server.', 'success');
      else toast('Save failed', d.error, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const resetData = async () => {
    if (!window.confirm('Reset all results and review decisions, then re-run the engine over the shipped 520-email dataset?')) return;
    setResetting(true);
    try {
      await fetch('/api/seed', { method: 'POST' });
      toast('Dataset reprocessed', 'All engine results and reviews were rebuilt from the shipped dataset.', 'ai');
      router.refresh();
      window.location.href = '/dashboard';
    } finally {
      setResetting(false);
    }
  };

  if (!s) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-16 w-1/3"/>
        <Skeleton className="h-96"/>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] font-bold text-navy-900 tracking-tight">Settings</h1>
          <p className="text-sm text-slate-400 mt-1">Console preferences, engine thresholds and integrations.</p>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary"><Icon name="check" size={15}/>{saving ? 'Saving…' : 'Save changes'}</button>
      </div>

      <M from={{ opacity: 0, y: 12 }} to={{ opacity: 1, y: 0 }} className="card p-5">
        <h3 className="font-bold text-[14px] text-navy-900 mb-1">Engine behaviour</h3>
        <p className="text-[12px] text-slate-400 mb-2">How aggressively the engine decides on its own.</p>
        <div className="py-3.5 border-b border-slate-100">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[13.5px] font-semibold text-ink-800">Classifier confidence display</div>
              <div className="text-[12px] text-slate-400 mt-0.5">Flag results below this confidence for a second look in dashboards</div>
            </div>
            <span className="text-[13px] font-bold text-brand-500 tabular-nums shrink-0">{s.autoApproveThreshold}%</span>
          </div>
          <input
            type="range"
            min={50}
            max={100}
            value={s.autoApproveThreshold}
            onChange={(e) => setS({ ...s, autoApproveThreshold: Number(e.target.value) })}
            className="w-full mt-2.5"
          />
        </div>
        <SettingRow title="Spam filter" desc="Quarantine unsolicited / suspicious messages before they reach any workflow." on={s.spamFilter} onChange={(v) => setS({ ...s, spamFilter: v })}/>
        <SettingRow title="Require evidence lines" desc="Keep the exact source line for every extracted field (recommended for auditability)." on={s.requireEvidence} onChange={(v) => setS({ ...s, requireEvidence: v })}/>
      </M>

      <M from={{ opacity: 0, y: 12 }} to={{ opacity: 1, y: 0 }} delay={0.05} className="card p-5">
        <h3 className="font-bold text-[14px] text-navy-900 mb-1">Notifications</h3>
        <p className="text-[12px] text-slate-400 mb-2">What the team gets pinged about.</p>
        <SettingRow title="Mismatch alerts" desc="Notify the documentation desk as soon as a SI ↔ BL comparison flags a defect." on={s.notifyOnMismatch} onChange={(v) => setS({ ...s, notifyOnMismatch: v })}/>
        <SettingRow title="Review queue alerts" desc="Notify when a case is escalated to human review." on={s.notifyOnReview} onChange={(v) => setS({ ...s, notifyOnReview: v })}/>
        <SettingRow title="Daily digest" desc="One summary email per day instead of per-event notifications." on={s.digest} onChange={(v) => setS({ ...s, digest: v })}/>
      </M>

      <M from={{ opacity: 0, y: 12 }} to={{ opacity: 1, y: 0 }} delay={0.1} className="card p-5">
        <h3 className="font-bold text-[14px] text-navy-900 mb-1">SDOC evaluation server</h3>
        <p className="text-[12px] text-slate-400 mb-3">
          The organizers&apos; local server (docker compose) exposes POST /submit for self-scoring. Start it, point this
          URL at it, then run <b>Score vs SDOC server</b> from the Evaluation page.
        </p>
        <TextField
          value={s.sdocServerUrl}
          onChange={(e) => setS({ ...s, sdocServerUrl: e.target.value })}
          placeholder="http://localhost:8080"
          icon={<Icon name="database" size={15}/>}
        />
      </M>

      <M from={{ opacity: 0, y: 12 }} to={{ opacity: 1, y: 0 }} delay={0.15} className="card p-5 border-red-100">
        <h3 className="font-bold text-[14px] text-red-600 mb-1">Danger zone</h3>
        <p className="text-[12px] text-slate-400 mb-3">
          Wipe all results, review decisions and evaluation runs, then re-run the engine over the shipped dataset.
        </p>
        <button onClick={resetData} disabled={resetting} className="btn-danger-o btn-sm">
          <Icon name="rotateCcw" size={13} className={resetting ? 'animate-spin' : ''}/>{resetting ? 'Reprocessing dataset…' : 'Reset & reprocess dataset'}
        </button>
      </M>
    </div>
  );
}
