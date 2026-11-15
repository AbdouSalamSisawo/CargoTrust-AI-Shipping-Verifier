'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PublicUser, Role } from '@/lib/types';
import { Icon } from '@/components/icons';
import { SettingRow, TextField, Skeleton, useToast, M } from '@/components/ui';
import { useSession } from '@/components/shell';
import { cx } from '@/lib/utils';

interface AiInfo { enabled: boolean; keySource: 'environment' | 'settings' | null; keyHint: string | null; model: string; modelFromEnv: boolean; active: boolean; policy: 'confirm' | 'auto' }
interface PublicSettings { organisation: string; aiEnabled: boolean; aiModel: string; aiScanPolicy: 'confirm' | 'auto'; ai: AiInfo }
interface WorkspaceInfo { sampleData: boolean; counts: { sample: number; upload: number; email: number; total: number }; scans: number; users: number }

const ROLE_INFO: Record<Role, string> = {
  admin: 'Everything, including users, settings and workspace data',
  operator: 'Submit documents, import email, resolve reviews',
  viewer: 'Read-only access to results and evidence',
};

const post = (url: string, body: unknown, method = 'POST') =>
  fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());

function Section({ id, title, desc, children, delay = 0 }: { id: string; title: string; desc: string; children: React.ReactNode; delay?: number }) {
  return (
    <M from={{ opacity: 0, y: 12 }} to={{ opacity: 1, y: 0 }} delay={delay} className="card p-5 scroll-mt-24">
      <div id={id}/>
      <h3 className="text-[14px] font-semibold text-ink-900 mb-1">{title}</h3>
      <p className="text-[12px] text-ink-400 mb-4">{desc}</p>
      {children}
    </M>
  );
}

/* ----------------------------------------------------------------- account */

function AccountSection() {
  const { user } = useSession();
  const toast = useToast();
  const router = useRouter();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.next !== f.confirm) return toast('Passwords do not match', 'Type the new password twice.', 'warn');
    setBusy(true);
    try {
      const d = await post('/api/auth/password', { current: f.current, next: f.next });
      if (d.ok) {
        toast('Password changed', 'Use the new password next time you sign in.', 'success');
        setF({ current: '', next: '', confirm: '' });
        router.refresh();
      } else toast('Password not changed', d.error, 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section id="account" title="Your account" desc={`${user.name} · ${user.email} · ${user.role}`}>
      {user.mustChangePassword && (
        <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5 text-[12.5px] text-amber-800">
          You are using a temporary password. Choose your own now.
        </div>
      )}
      <form onSubmit={change} className="grid sm:grid-cols-3 gap-3">
        <TextField type="password" autoComplete="current-password" placeholder="Current password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} icon={<Icon name="lock" size={15}/>}/>
        <TextField type="password" autoComplete="new-password" placeholder="New password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} icon={<Icon name="key" size={15}/>}/>
        <TextField type="password" autoComplete="new-password" placeholder="Repeat new password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} icon={<Icon name="key" size={15}/>}/>
        <div className="sm:col-span-3 flex items-center gap-3">
          <button type="submit" disabled={busy || !f.current || !f.next} className="btn-primary btn-sm"><Icon name="check" size={14}/>{busy ? 'Saving…' : 'Change password'}</button>
          <span className="text-[11.5px] text-ink-400">At least 10 characters, with letters and numbers.</span>
        </div>
      </form>
    </Section>
  );
}

/* -------------------------------------------------------------------- team */

function TeamSection() {
  const { user: me } = useSession();
  const toast = useToast();
  const [users, setUsers] = useState<PublicUser[] | null>(null);
  const [nu, setNu] = useState({ name: '', email: '', role: 'operator' as Role });
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);

  const load = useCallback(async () => {
    const d = await fetch('/api/users').then((r) => r.json());
    if (d.ok) setUsers(d.users);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const d = await post('/api/users', nu);
    if (!d.ok) return toast('Could not add user', d.error, 'danger');
    setSecret({ email: d.user.email, password: d.temporaryPassword });
    setNu({ name: '', email: '', role: 'operator' });
    void load();
  };
  const patch = async (u: PublicUser, body: Record<string, unknown>) => {
    const d = await post(`/api/users/${u.id}`, body, 'PATCH');
    if (!d.ok) return toast('Not changed', d.error, 'danger');
    if (d.temporaryPassword) setSecret({ email: u.email, password: d.temporaryPassword });
    else toast('User updated', u.email, 'success');
    void load();
  };

  return (
    <Section id="team" title="Team" desc="Who can sign in, and what they can do. New users get a temporary password and must change it on first sign-in." delay={0.05}>
      {secret && (
        <div className="mb-4 rounded-md bg-emerald-50 border border-emerald-200 p-3.5 text-[12.5px] text-emerald-900">
          <div className="font-semibold mb-1">Temporary password for {secret.email}</div>
          <div className="flex items-center gap-2">
            <code className="font-mono text-[13px] bg-white border border-emerald-200 rounded-lg px-2 py-1 select-all">{secret.password}</code>
            <button onClick={() => { void navigator.clipboard?.writeText(secret.password); toast('Copied', 'Share it with the user privately.', 'info'); }} className="btn-ghost btn-sm">Copy</button>
            <button onClick={() => setSecret(null)} className="text-[11.5px] font-semibold text-emerald-700 hover:underline ml-auto">Done</button>
          </div>
          <div className="text-[11.5px] text-emerald-700 mt-1.5">It is shown only once. The user will be asked to choose their own password.</div>
        </div>
      )}
      {!users ? <Skeleton className="h-28"/> : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[620px] text-[12.5px]">
            <thead><tr className="text-left text-[10.5px] uppercase tracking-wider text-ink-400"><th className="px-1 py-2">User</th><th className="px-1 py-2">Role</th><th className="px-1 py-2">Last sign-in</th><th className="px-1 py-2 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-line">
              {users.map((u) => (
                <tr key={u.id} className={cx(!u.active && 'opacity-50')}>
                  <td className="px-1 py-2.5"><div className="font-semibold text-ink-800">{u.name}{u.id === me.id && <span className="ml-1.5 text-[10px] text-brand-500">you</span>}</div><div className="text-ink-400">{u.email}</div></td>
                  <td className="px-1 py-2.5">
                    <select value={u.role} onChange={(e) => patch(u, { role: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[12px] font-semibold" title={ROLE_INFO[u.role]}>
                      {(['admin', 'operator', 'viewer'] as const).map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-2.5 text-ink-400">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'never'}</td>
                  <td className="px-1 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => window.confirm(`Reset the password for ${u.email}?`) && patch(u, { resetPassword: true })} className="btn-ghost btn-sm mr-1.5"><Icon name="key" size={12}/>Reset password</button>
                    {u.id !== me.id && (
                      <button onClick={() => patch(u, { active: !u.active })} className={cx('btn-sm', u.active ? 'btn-danger-o' : 'btn-ghost')}>{u.active ? 'Deactivate' : 'Reactivate'}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form onSubmit={create} className="mt-4 pt-4 border-t border-line grid sm:grid-cols-[1fr_1.2fr_auto_auto] gap-2.5">
        <TextField compact placeholder="Full name" value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })}/>
        <TextField compact type="email" placeholder="email@company.com" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })}/>
        <select value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value as Role })} className="rounded-md border border-slate-200 bg-white px-3 text-[13px] font-semibold">
          {(['operator', 'viewer', 'admin'] as const).map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button type="submit" disabled={!nu.name || !nu.email} className="btn-primary btn-sm"><Icon name="users" size={14}/>Add user</button>
      </form>
      <div className="mt-3 grid sm:grid-cols-3 gap-2 text-[11px] text-ink-400">
        {(Object.keys(ROLE_INFO) as Role[]).map((r) => <div key={r}><b className="text-ink-500 capitalize">{r}</b>: {ROLE_INFO[r]}</div>)}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------- AI reading */

function AiSection({ s, onSaved }: { s: PublicSettings; onSaved: (s: PublicSettings) => void }) {
  const toast = useToast();
  const router = useRouter();
  const [key, setKey] = useState('');
  const [model, setModel] = useState(s.aiModel);
  const [busy, setBusy] = useState<'' | 'save' | 'test' | 'rerun'>('');
  const ai = s.ai;

  const save = async (body: Record<string, unknown>, msg: string) => {
    setBusy('save');
    try {
      const d = await post('/api/settings', body, 'PUT');
      if (d.ok) {
        onSaved(d.settings);
        toast('Saved', msg, 'success');
        router.refresh();
      } else toast('Not saved', d.error, 'danger');
    } finally {
      setBusy('');
    }
  };
  const test = async () => {
    setBusy('test');
    try {
      const d = await post('/api/settings/ai-test', { apiKey: key || undefined, model });
      if (d.ok) toast('Connection works', `The key can use ${model}.`, 'success');
      else toast('Connection failed', d.error, 'danger');
    } finally {
      setBusy('');
    }
  };
  const rerun = async () => {
    setBusy('rerun');
    try {
      const d = await post('/api/workspace', { action: 'rerun-scans' });
      toast(d.ok ? 'Scans re-read' : 'Failed', d.message ?? d.error, d.ok ? 'ai' : 'danger');
    } finally {
      setBusy('');
    }
  };

  return (
    <Section id="ai" title="AI reading for scans and photos" desc="Scanned PDFs and phone photos have no text layer. OCR reads them poorly; Claude's vision model transcribes them as printed. The transcription then goes through the same rule-based checks; the AI never decides whether documents match." delay={0.1}>
      <div className={cx('rounded-md border px-3.5 py-3 mb-4 flex items-center gap-3 text-[12.5px]', ai.active ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-ink-600')}>
        <span className={cx('w-2 h-2 rounded-full shrink-0', ai.active ? 'bg-emerald-500' : 'bg-slate-300')}/>
        <span className="flex-1">
          {ai.active
            ? <>Active. Model <b>{ai.model}</b>, key {ai.keySource === 'environment' ? 'from the server environment' : 'saved here'} (…{ai.keyHint}).</>
            : !ai.enabled ? 'Turned off.' : 'No API key yet. Scans are read by OCR only and always go to a person for review.'}
        </span>
      </div>

      <SettingRow title="Use AI reading" desc="Send page images of scanned documents to the Anthropic API." on={s.aiEnabled} onChange={(v) => save({ aiEnabled: v }, v ? 'AI reading turned on.' : 'AI reading turned off.')}/>

      <div className="py-3.5 border-b border-line">
        <div className="text-[13.5px] font-semibold text-ink-800">When the AI has read a scan</div>
        <div className="grid sm:grid-cols-2 gap-2.5 mt-2.5">
          {([
            ['confirm', 'A human confirms (recommended)', 'Every scan goes to the review queue with the AI pre-check filled in. Safest for release decisions.'],
            ['auto', 'Decide automatically when clear', 'If the AI read every field clearly, the scan is decided like a text PDF. Anything unclear still goes to a human.'],
          ] as const).map(([k, t, d]) => (
            <button key={k} onClick={() => save({ aiScanPolicy: k }, t)} className={cx('text-left rounded-md border p-3 transition-colors', s.aiScanPolicy === k ? 'border-brand-400 bg-brand-50/50' : 'border-slate-200 hover:border-slate-300')}>
              <div className="text-[12.5px] font-semibold text-ink-800 flex items-center gap-1.5">{s.aiScanPolicy === k && <Icon name="checkCircle" size={13} className="text-brand-500"/>}{t}</div>
              <div className="text-[11.5px] text-ink-400 mt-1">{d}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4 grid sm:grid-cols-[1.4fr_1fr] gap-2.5">
        <TextField
          type="password"
          autoComplete="off"
          placeholder={ai.keySource === 'settings' ? `Saved key ending ${ai.keyHint}. Paste a new key to replace it` : ai.keySource === 'environment' ? 'Using ANTHROPIC_API_KEY from the environment' : 'Anthropic API key (sk-ant-…)'}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          icon={<Icon name="key" size={15}/>}
          disabled={ai.keySource === 'environment'}
        />
        <TextField placeholder="Model" value={model} onChange={(e) => setModel(e.target.value)} icon={<Icon name="cpu" size={15}/>} disabled={ai.modelFromEnv}/>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button onClick={() => save({ ...(key ? { aiApiKey: key } : {}), aiModel: model }, 'AI settings saved.').then(() => setKey(''))} disabled={busy !== '' || (!key && model === s.aiModel)} className="btn-primary btn-sm"><Icon name="check" size={14}/>Save</button>
        <button onClick={test} disabled={busy !== ''} className="btn-ghost btn-sm"><Icon name={busy === 'test' ? 'loader' : 'zap'} size={14} className={busy === 'test' ? 'animate-spin' : ''}/>Test connection</button>
        <button onClick={rerun} disabled={busy !== '' || !ai.active} className="btn-ghost btn-sm"><Icon name={busy === 'rerun' ? 'loader' : 'refresh'} size={14} className={busy === 'rerun' ? 'animate-spin' : ''}/>{busy === 'rerun' ? 'Re-reading…' : 'Re-read existing scans'}</button>
        {ai.keySource === 'settings' && <button onClick={() => window.confirm('Remove the saved API key?') && save({ aiApiKey: '' }, 'API key removed.')} className="btn-danger-o btn-sm ml-auto">Remove key</button>}
      </div>
      <p className="text-[11px] text-ink-400 mt-3">
        Get a key at console.anthropic.com. The key stays on this server and is never sent to browsers. Only page images of scanned
        documents are sent to the API; text PDFs, Word and Excel files are read locally.
      </p>
    </Section>
  );
}

/* ---------------------------------------------------------------- workspace */

function WorkspaceSection({ s, onSaved }: { s: PublicSettings; onSaved: (s: PublicSettings) => void }) {
  const toast = useToast();
  const [w, setW] = useState<WorkspaceInfo | null>(null);
  const [org, setOrg] = useState(s.organisation);
  const [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    const d = await fetch('/api/workspace').then((r) => r.json());
    if (d.ok) setW(d);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = async (action: string, confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    setBusy(action);
    try {
      const d = await post('/api/workspace', { action });
      toast(d.ok ? 'Done' : 'Failed', d.message ?? d.error, d.ok ? 'success' : 'danger');
      await load();
    } finally {
      setBusy('');
    }
  };
  const saveOrg = async () => {
    const d = await post('/api/settings', { organisation: org }, 'PUT');
    if (d.ok) {
      onSaved(d.settings);
      toast('Saved', 'Organisation name updated. It appears in the console and on drafted replies.', 'success');
    }
  };

  return (
    <Section id="workspace" title="Workspace" desc="Organisation details and the data in this installation." delay={0.15}>
      <div className="flex gap-2.5">
        <TextField className="flex-1" placeholder="Organisation name" value={org} onChange={(e) => setOrg(e.target.value)} icon={<Icon name="building" size={15}/>}/>
        <button onClick={saveOrg} disabled={!org.trim() || org === s.organisation} className="btn-primary btn-sm">Save</button>
      </div>
      {!w ? <Skeleton className="h-20 mt-4"/> : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
            {[['Uploaded checks', w.counts.upload], ['Imported emails', w.counts.email], ['Sample items', w.counts.sample], ['Users', w.users]].map(([l, v]) => (
              <div key={l as string} className="rounded-md bg-slate-50 border border-line px-3 py-2.5">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-400">{l}</div>
                <div className="text-[20px] font-semibold text-ink-900 tabular-nums">{v}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-md border border-slate-200 p-3.5 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px]">
              <div className="text-[13px] font-semibold text-ink-800">Sample inbox</div>
              <div className="text-[11.5px] text-ink-400 mt-0.5">520 realistic shipping emails for demonstrations and training. Removing them leaves your own uploads and imported email untouched.</div>
            </div>
            {w.sampleData
              ? <button onClick={() => act('remove-sample', 'Remove the 520 sample items? Your uploads and imported emails stay.')} disabled={!!busy} className="btn-danger-o btn-sm"><Icon name="trash" size={13}/>{busy === 'remove-sample' ? 'Removing…' : 'Remove sample data'}</button>
              : <button onClick={() => act('load-sample', 'Load the 520-item sample inbox? This takes up to a minute.')} disabled={!!busy} className="btn-ghost btn-sm"><Icon name={busy === 'load-sample' ? 'loader' : 'database'} size={13} className={busy === 'load-sample' ? 'animate-spin' : ''}/>{busy === 'load-sample' ? 'Loading…' : 'Load sample data'}</button>}
          </div>
        </>
      )}
    </Section>
  );
}

/* --------------------------------------------------------------------- page */

export default function SettingsPage() {
  const { user } = useSession();
  const [s, setS] = useState<PublicSettings | null>(null);
  useEffect(() => {
    if (user.role === 'admin') fetch('/api/settings').then((r) => r.json()).then(setS).catch(() => undefined);
  }, [user.role]);

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">{user.role === 'admin' ? 'Your account, the team, AI reading and workspace data.' : 'Your account.'}</p>
      </div>
      <AccountSection/>
      {user.role === 'admin' && (
        <>
          <TeamSection/>
          {!s ? <Skeleton className="h-64"/> : (
            <>
              <AiSection s={s} onSaved={setS}/>
              <WorkspaceSection s={s} onSaved={setS}/>
            </>
          )}
        </>
      )}
    </div>
  );
}
