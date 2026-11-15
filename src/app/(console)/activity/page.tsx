'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { AuditEvent } from '@/lib/types';
import { Icon } from '@/components/icons';
import { Skeleton, EmptyState, TextField } from '@/components/ui';
import { cx } from '@/lib/utils';

const ACTION: Record<string, { label: string; icon: string; tone: string }> = {
  'auth.login': { label: 'Signed in', icon: 'logOut', tone: 'text-ink-400' },
  'auth.logout': { label: 'Signed out', icon: 'logOut', tone: 'text-ink-400' },
  'auth.failed': { label: 'Failed sign-in', icon: 'alertTriangle', tone: 'text-red-500' },
  'user.created': { label: 'User created', icon: 'users', tone: 'text-brand-500' },
  'user.updated': { label: 'User updated', icon: 'users', tone: 'text-brand-500' },
  'user.password_changed': { label: 'Password changed', icon: 'key', tone: 'text-brand-500' },
  'check.uploaded': { label: 'Documents checked', icon: 'upload', tone: 'text-aqua-600' },
  'email.imported': { label: 'Email imported', icon: 'mailImport', tone: 'text-aqua-600' },
  'check.rerun': { label: 'Check re-run', icon: 'refresh', tone: 'text-aqua-600' },
  'check.deleted': { label: 'Item deleted', icon: 'trash', tone: 'text-red-500' },
  'review.approved': { label: 'Review approved', icon: 'checkCircle', tone: 'text-emerald-500' },
  'review.rejected': { label: 'Review rejected', icon: 'xCircle', tone: 'text-red-500' },
  'review.corrected': { label: 'Values corrected', icon: 'pencil', tone: 'text-amber-500' },
  'settings.updated': { label: 'Settings changed', icon: 'settings', tone: 'text-ink-500' },
  'workspace.sample_removed': { label: 'Sample data removed', icon: 'database', tone: 'text-ink-500' },
  'workspace.sample_loaded': { label: 'Sample data loaded', icon: 'database', tone: 'text-ink-500' },
  'workspace.scans_rerun': { label: 'Scans re-read', icon: 'scan', tone: 'text-ai-500' },
  'export.csv': { label: 'CSV exported', icon: 'download', tone: 'text-ink-500' },
};

const isCaseId = (t?: string) => !!t && (/^CT-\d{6}-[0-9A-F]{4}$/.test(t) || /^email_\d+$/.test(t));

export default function ActivityPage() {
  const [q, setQ] = useState('');
  const [data, setData] = useState<{ total: number; events: AuditEvent[] } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/audit?q=${encodeURIComponent(q)}`).then((r) => r.json()).then((d) => d.ok && setData(d)).catch(() => undefined);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Activity log</h1>
          <p className="page-sub">Every sign-in, check, review decision and setting change, with who made it and when.</p>
        </div>
        <TextField compact className="w-72" placeholder="Filter by user, action or item" value={q} onChange={(e) => setQ(e.target.value)} icon={<Icon name="search" size={15}/>}/>
      </div>

      {!data ? <Skeleton className="h-96"/> : data.events.length === 0 ? (
        <div className="card"><EmptyState icon="history" title="No activity yet" sub={q ? 'Nothing matches this filter.' : 'Actions will appear here as the team works.'}/></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead className="bg-slate-50/80 border-b border-line">
                <tr><th className="th">When</th><th className="th">Who</th><th className="th">What</th><th className="th">Item</th><th className="th">Details</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.events.map((e) => {
                  const a = ACTION[e.action] ?? { label: e.action, icon: 'activity', tone: 'text-ink-400' };
                  return (
                    <tr key={e.id} className="align-top">
                      <td className="px-4 py-2.5 text-[12px] text-ink-500 whitespace-nowrap tabular-nums">{new Date(e.at).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-[12.5px] font-semibold text-ink-800 whitespace-nowrap">{e.userName}</td>
                      <td className="px-4 py-2.5 text-[12.5px] whitespace-nowrap"><span className="inline-flex items-center gap-1.5"><Icon name={a.icon} size={13} className={cx('shrink-0', a.tone)}/>{a.label}</span></td>
                      <td className="px-4 py-2.5 text-[12px] font-mono whitespace-nowrap">
                        {isCaseId(e.target) ? <Link href={`/emails/${encodeURIComponent(e.target!)}`} className="text-brand-600 hover:underline">{e.target}</Link> : <span className="text-ink-500">{e.target ?? ''}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-ink-500 max-w-[340px]">{e.detail}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data.total > data.events.length && <div className="px-4 py-2.5 text-[11.5px] text-ink-400 border-t border-line">Showing the latest {data.events.length} of {data.total} events.</div>}
        </div>
      )}
    </div>
  );
}
