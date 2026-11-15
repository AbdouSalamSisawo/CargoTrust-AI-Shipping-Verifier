'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { cx } from '@/lib/utils';
import { Icon, Logo } from '@/components/icons';
import { TextField } from '@/components/ui';
import { PortScene } from '@/components/landing/PortScene';

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next') || '/dashboard';

  const [form, setForm] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [state, setState] = useState<'idle' | 'error' | 'loading' | 'success'>('idle');
  const [err, setErr] = useState('');
  const busy = state === 'loading' || state === 'success';
  const [demo, setDemo] = useState<'none' | 'available' | 'loading'>('none');

  useEffect(() => {
    fetch('/api/auth/demo')
      .then((r) => r.json())
      .then((d) => d.available && setDemo('available'))
      .catch(() => undefined);
  }, []);

  const enterDemo = async () => {
    if (busy || demo === 'loading') return;
    setDemo('loading');
    try {
      const r = await fetch('/api/auth/demo', { method: 'POST' });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error);
      setState('success');
      router.push('/dashboard');
      router.refresh();
    } catch (e) {
      setDemo('available');
      setState('error');
      setErr(e instanceof Error && e.message ? e.message : 'The demo could not be opened. Try again.');
    }
  };

  // only same-site paths: never redirect to another origin after sign-in
  const go = () => {
    router.push(next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard');
    router.refresh();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!form.email.trim() || !form.password) {
      setState('error');
      setErr('Enter your email address and password.');
      return;
    }
    setState('loading');
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim(), password: form.password }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setState('error');
        setErr(d.error || 'Sign-in failed.');
        return;
      }
      setState('success');
      go();
    } catch {
      setState('error');
      setErr('The server could not be reached. Check your connection and try again.');
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-white">
      {/* brand panel */}
      <div className="hidden lg:flex relative bg-navy-950 text-white overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-x-0 bottom-0 h-[55%] pointer-events-none opacity-80"><PortScene className="w-full h-full"/></div>
        <Link href="/" className="relative self-start" aria-label="CargoTrust AI home"><Logo light/></Link>
        <div className="relative max-w-md mb-[22vh]">
          <div className="eyebrow text-aqua-300">Shipping document verification</div>
          <h1 className="mt-4 text-white font-display text-[36px] leading-[1.08] font-semibold tracking-tight">Check the Bill of Lading before it is issued.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-300">
            Compare each Shipping Instruction with its draft BL, see where every value came from, and keep a record of who decided what.
          </p>
        </div>
        <div className="relative text-[12px] text-slate-400">© 2026 CargoTrust AI</div>
      </div>

      {/* sign-in */}
      <main className="flex items-center justify-center px-6 py-12 bg-canvas lg:bg-white">
        <div className="w-full max-w-[380px]">
          <Link href="/" className="lg:hidden inline-block mb-10" aria-label="CargoTrust AI home"><Logo/></Link>
          <h2 className="text-[24px] font-semibold text-ink-900 tracking-tight">Sign in</h2>
          <p className="text-[14px] text-ink-500 mt-1">Use the account your administrator created for you.</p>

          <form onSubmit={submit} className={cx('mt-8 space-y-5', state === 'error' && 'animate-shakeX')} noValidate>
            <div>
              <label className="block text-[13px] font-medium text-ink-700 mb-1.5" htmlFor="li-user">Email address</label>
              <TextField
                id="li-user"
                type="email"
                icon={<Icon name="mail" size={16}/>}
                placeholder="you@company.com"
                autoComplete="username"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                aria-invalid={state === 'error'}
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-ink-700 mb-1.5" htmlFor="li-pass">Password</label>
              <TextField
                id="li-pass"
                type={show ? 'text' : 'password'}
                icon={<Icon name="lock" size={16}/>}
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                aria-invalid={state === 'error'}
                trailing={
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    aria-label={show ? 'Hide password' : 'Show password'}
                    aria-pressed={show}
                    className="w-8 h-8 rounded hover:bg-slate-100 flex items-center justify-center text-ink-400 hover:text-ink-700"
                  >
                    <Icon name="eye" size={16}/>
                  </button>
                }
              />
            </div>
            {state === 'error' && (
              <div className="flex items-start gap-2 text-[13px] text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2.5" role="alert">
                <Icon name="alertCircle" size={15} className="shrink-0 mt-px"/>{err}
              </div>
            )}
            <button type="submit" disabled={busy} className="btn-primary w-full py-2.5 text-[14.5px]">
              {state === 'loading' ? <><Icon name="loader" size={16} className="animate-spin"/>Signing in</> : state === 'success' ? <><Icon name="check" size={16}/>Signed in</> : 'Sign in'}
            </button>
          </form>

          {demo !== 'none' && (
            <div className="mt-6">
              <div className="flex items-center gap-3 text-[12px] text-ink-400" aria-hidden="true">
                <span className="h-px flex-1 bg-line"/>or<span className="h-px flex-1 bg-line"/>
              </div>
              <button type="button" onClick={enterDemo} disabled={busy || demo === 'loading'} className="btn-ghost w-full py-2.5 text-[14px] mt-4">
                {demo === 'loading' ? <><Icon name="loader" size={16} className="animate-spin"/>Opening the demo</> : <><Icon name="eye" size={16}/>Explore the read-only demo</>}
              </button>
              <p className="mt-2 text-[12px] text-ink-400 text-center">Every result and its evidence, with sample shipping emails. Nothing can be changed.</p>
            </div>
          )}

          <p className="mt-6 text-[13px] text-ink-400">Forgotten your password? An administrator can reset it under Settings, Team.</p>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner/>
    </Suspense>
  );
}
