'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { cx } from '@/lib/utils';
import { PRODUCT } from '@/data/taxonomy';
import { Icon, Logo, GoogleG } from '@/components/icons';
import { TextField, M } from '@/components/ui';

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next') || '/dashboard';

  const [form, setForm] = useState({ user: '', pass: '' });
  const [show, setShow] = useState(false);
  const [state, setState] = useState<'idle' | 'error' | 'loading' | 'gloading' | 'success'>('idle');
  const [err, setErr] = useState('');

  const busy = state === 'loading' || state === 'gloading' || state === 'success';

  const go = () => router.push(next);

  const signIn = async (payload: { user: string; pass: string }, g = false) => {
    setState(g ? 'gloading' : 'loading');
    try {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setState('error');
        setErr(d.error || 'Sign-in failed.');
        return;
      }
      setState('success');
      try {
        // Primary session marker for preview proxies/frames that block cookies.
        window.localStorage.setItem('cargotrust_auth', '1');
      } catch { /* storage unavailable — cookie may still work */ }
      setTimeout(go, 650);
    } catch {
      setState('error');
      setErr('Network error — is the server running?');
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!form.user.trim() || !form.pass) {
      setState('error');
      setErr('Please enter both username and password.');
      return;
    }
    void signIn({ user: form.user.trim(), pass: form.pass });
  };

  const particles = useMemo(
    () =>
      Array.from({ length: 22 }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        s: 2 + Math.random() * 3,
        d: 5 + Math.random() * 9,
        delay: Math.random() * 6,
        o: 0.18 + Math.random() * 0.4,
      })),
    [],
  );

  return (
    <div className="min-h-screen flex bg-white">
      {/* ===== Left: brand panel ===== */}
      <div
        className="hidden lg:flex flex-1 relative overflow-hidden"
        style={{ background: 'linear-gradient(130deg,#081426 0%,#0E2039 38%,#123A66 68%,#0C4A6E 100%)' }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px)', backgroundSize: '34px 34px' }}
        />
        <div className="absolute -top-32 -left-32 w-[460px] h-[460px] rounded-full blur-3xl opacity-40 animate-drift pointer-events-none" style={{ background: 'radial-gradient(circle,#2563EB55,transparent 65%)' }}/>
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full blur-3xl opacity-40 animate-drift pointer-events-none" style={{ background: 'radial-gradient(circle,#06B6D455,transparent 65%)', animationDelay: '-6s' }}/>
        <div className="absolute top-[14%] right-[6%] w-[320px] h-[320px] rounded-full border border-dashed border-white/10 animate-spinSlow pointer-events-none"/>
        <svg className="absolute inset-0 w-full h-full opacity-70 pointer-events-none" viewBox="0 0 900 600" preserveAspectRatio="xMidYMid slice" fill="none">
          <defs>
            <linearGradient id="rg1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#22D3EE" stopOpacity="0"/><stop offset=".5" stopColor="#22D3EE"/><stop offset="1" stopColor="#22D3EE" stopOpacity="0"/></linearGradient>
            <linearGradient id="rg2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#60A5FA" stopOpacity="0"/><stop offset=".5" stopColor="#60A5FA"/><stop offset="1" stopColor="#60A5FA" stopOpacity="0"/></linearGradient>
          </defs>
          <path d="M-40 470 C 200 380, 300 180, 620 210 S 950 320, 1000 260" stroke="url(#rg1)" strokeWidth="1.6" className="dash-anim" opacity=".5"/>
          <path d="M-40 300 C 180 260, 420 380, 700 300 S 900 180, 1000 210" stroke="url(#rg2)" strokeWidth="1.4" className="dash-anim" style={{ animationDuration: '1.9s' }} opacity=".4"/>
          <path d="M60 620 C 220 480, 480 520, 640 380 S 860 240, 980 140" stroke="url(#rg1)" strokeWidth="1.2" className="dash-anim" style={{ animationDuration: '2.3s' }} opacity=".35"/>
          {[[620, 210], [700, 300], [640, 380], [980, 140], [300, 286]].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="10" fill="#22D3EE" opacity=".16" className="node-ping" style={{ animationDelay: `${i * 0.5}s` }}/>
              <circle cx={x} cy={y} r="4" fill="#67E8F9"/>
            </g>
          ))}
        </svg>
        {particles.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{ left: p.left + '%', top: p.top + '%', width: p.s, height: p.s, background: '#7DD3FC', opacity: p.o, animation: `floatY ${p.d}s linear infinite`, animationDelay: `${p.delay}s` }}
          />
        ))}

        <div className="relative z-10 h-full flex flex-col justify-between p-12 max-w-2xl">
          <M from={{ opacity: 0, y: -14 }} to={{ opacity: 1, y: 0 }} delay={0.1}><Logo size="lg" light/></M>

          <div>
            <M from={{ opacity: 0, y: 22 }} to={{ opacity: 1, y: 0 }} delay={0.25}>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 backdrop-blur px-3.5 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-aqua-300 animate-pulseDot"/>
                <span className="text-[11px] font-bold tracking-wide text-aqua-300 uppercase">SDOC Hackathon · Shipping Document Verification</span>
              </div>
            </M>
            <M from={{ opacity: 0, y: 22 }} to={{ opacity: 1, y: 0 }} delay={0.4}>
              <h1 className="font-display text-[42px] leading-[1.1] font-bold text-white mt-5">
                Intelligent document verification
                <br/>
                for <span className="text-grad-l">global shipping.</span>
              </h1>
            </M>
            <M from={{ opacity: 0, y: 22 }} to={{ opacity: 1, y: 0 }} delay={0.55}>
              <p className="text-white/60 text-[15px] leading-relaxed mt-4 max-w-lg">
                The engine reads your inbox, classifies every email, extracts SI &amp; BL shipment fields, and catches
                discrepancies before a draft Bill of Lading is finalized.
              </p>
            </M>
            <M from={{ opacity: 0, y: 22 }} to={{ opacity: 1, y: 0 }} delay={0.7}>
              <div className="flex flex-col gap-3 mt-7 max-w-md">
                {[
                  ['shieldCheck', 'Human-in-the-loop by design'],
                  ['gitCompare', 'Seven-field SI ↔ BL comparison'],
                  ['zap', 'Decisions in seconds, not hours'],
                ].map(([ic, t]) => (
                  <div key={t} className="flex items-center gap-3 text-[13px] font-semibold text-white/80">
                    <span className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-aqua-300 shrink-0"><Icon name={ic} size={14}/></span>
                    {t}
                  </div>
                ))}
              </div>
            </M>
          </div>

          <M from={{ opacity: 0 }} to={{ opacity: 1 }} delay={0.9}>
            <div className="border-t border-white/10 pt-6">
              <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
                {[['520', 'emails in dataset'], ['7', 'fields checked per BL'], ['3', 'decisions: OK · Mismatch · Review']].map(([v, l]) => (
                  <div key={l}>
                    <div className="font-display text-2xl font-bold text-white">{v}</div>
                    <div className="text-[11px] text-white/50 mt-0.5">{l}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-[10.5px] text-white/30 tracking-wide uppercase">{PRODUCT.pillars.join('  ·  ')}</div>
            </div>
          </M>
        </div>
      </div>

      {/* ===== Right: sign-in ===== */}
      <div className="w-full lg:w-[480px] flex items-center justify-center p-8 relative" style={{ background: 'radial-gradient(70% 50% at 50% 0%, #EFF6FF 0%, #fff 70%)' }}>
        <M from={{ opacity: 0, y: 24 }} to={{ opacity: 1, y: 0 }} delay={0.3} className="w-full max-w-sm">
          <div className="lg:hidden mb-8"><Logo sub/></div>
          <div className="hidden lg:flex items-center gap-2.5 mb-10"><Logo/></div>

          <h2 className="font-display text-[26px] font-bold text-navy-900">Welcome back</h2>
          <p className="text-sm text-slate-400 mt-1.5">Sign in to the verification console.</p>

          <form onSubmit={submit} className={cx('mt-8 space-y-4', state === 'error' && 'animate-shakeX')} noValidate>
            <div>
              <label className="text-[12px] font-bold text-ink-700 uppercase tracking-wide" htmlFor="li-user">Username</label>
              <div className="mt-1.5">
                <TextField
                  id="li-user"
                  icon={<Icon name="user" size={16}/>}
                  placeholder="ops.manager@cargotrust.ai"
                  autoComplete="username"
                  value={form.user}
                  onChange={(e) => setForm({ ...form, user: e.target.value })}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-bold text-ink-700 uppercase tracking-wide" htmlFor="li-pass">Password</label>
                <button type="button" className="text-[11.5px] font-semibold text-brand-500 hover:text-brand-600">Forgot?</button>
              </div>
              <div className="mt-1.5">
                <TextField
                  id="li-pass"
                  type={show ? 'text' : 'password'}
                  icon={<Icon name="lock" size={16}/>}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={form.pass}
                  onChange={(e) => setForm({ ...form, pass: e.target.value })}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShow(!show)}
                      tabIndex={-1}
                      aria-label="Toggle password visibility"
                      className="w-8 h-8 -mr-1 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-300 hover:text-slate-500 transition-colors"
                    >
                      <Icon name="eye" size={16}/>
                    </button>
                  }
                />
              </div>
            </div>
            {state === 'error' && (
              <div className="flex items-center gap-2 text-[12.5px] font-semibold text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                <Icon name="alertCircle" size={15} className="shrink-0"/>{err}
              </div>
            )}
            <button type="submit" disabled={busy} className={cx('w-full py-3 text-[15px]', state === 'success' ? 'btn-emerald' : 'btn-primary')}>
              {state === 'loading' && <><Icon name="loader" size={16} className="animate-spin"/>Signing in…</>}
              {state === 'success' && <><Icon name="checkCircle" size={16}/>Access granted</>}
              {(state === 'idle' || state === 'error') && <>Sign In <Icon name="arrowRight" size={16}/></>}
            </button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"/></div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400">or continue with</span>
            </div>
          </div>
          <button type="button" onClick={() => void signIn({ user: 'google-demo', pass: 'google-demo' }, true)} disabled={busy} className="btn-ghost w-full py-3 text-[15px]">
            {state === 'gloading' && <><Icon name="loader" size={16} className="animate-spin"/>Connecting to Google…</>}
            {state === 'success' && <><Icon name="checkCircle" size={16}/>Access granted</>}
            {(state === 'idle' || state === 'error' || state === 'loading') && <><GoogleG size={18}/>Continue with Google</>}
          </button>

          <div className="mt-7 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300">
            <span className="h-px flex-1 bg-slate-200"/>Secure enterprise access<span className="h-px flex-1 bg-slate-200"/>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11.5px] font-semibold text-slate-400">
            <span className="inline-flex items-center gap-1.5"><Icon name="lock" size={13} className="text-emerald-500"/>SSO Ready</span>
            <span className="inline-flex items-center gap-1.5"><Icon name="shieldCheck" size={13} className="text-brand-500"/>Audit Trail</span>
            <span className="inline-flex items-center gap-1.5"><Icon name="wifi" size={13} className="text-ai-500"/>24/7 Monitoring</span>
          </div>
          <div className="mt-6 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-50 border border-navy-100 px-3 py-1.5 text-[11px] font-semibold text-navy-600">
              <Icon name="info" size={12} className="shrink-0"/>Demo build — any credentials or Google sign-in works
            </span>
          </div>
        </M>
      </div>
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
