'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cx } from '@/lib/utils';
import { PRODUCT } from '@/data/taxonomy';
import { Icon, Logo } from './icons';
import { ToastProvider, M } from './ui';

const NAV = [
  { section: 'Operations', items: [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { href: '/emails', label: 'Emails', icon: 'inbox' },
    { href: '/reviews', label: 'Reviews', icon: 'clipboardCheck', badge: true },
  ]},
  { section: 'Intelligence', items: [
    { href: '/evaluation', label: 'Evaluation', icon: 'gauge' },
    { href: '/try', label: 'Playground', icon: 'play' },
    { href: '/settings', label: 'Settings', icon: 'settings' },
  ]},
];

function NavItem({ href, label, icon, active, badge }: { href: string; label: string; icon: string; active: boolean; badge?: number }) {
  return (
    <Link
      href={href}
      className={cx(
        'group relative w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition-all duration-200',
        active ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-glowBrand' : 'text-slate-500 hover:bg-slate-100/80 hover:text-ink-800',
      )}
    >
      <Icon name={icon} size={17} className={active ? 'text-white shrink-0' : 'text-slate-400 group-hover:text-brand-500 transition-colors shrink-0'}/>
      <span className="flex-1 text-left truncate">{label}</span>
      {badge != null && badge > 0 && (
        <span className={cx('min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0', active ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-700')}>
          {badge}
        </span>
      )}
    </Link>
  );
}

function Sidebar({ route, openCount }: { route: string; openCount: number | null }) {
  return (
    <div className="h-full flex flex-col">
      <div className="px-5 pt-5 pb-4">
        <Link href="/dashboard" className="text-left w-full inline-block"><Logo sub/></Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 space-y-5">
        {NAV.map((sec) => (
          <div key={sec.section}>
            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300">{sec.section}</div>
            <div className="space-y-1">
              {sec.items.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={route === item.href || route.startsWith(item.href + '/')}
                  badge={item.badge ? (openCount ?? 0) : undefined}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-3">
        <div className="rounded-2xl p-4 relative overflow-hidden text-white" style={{ background: 'linear-gradient(135deg,#0A1A2F,#1E3A8A 60%,#2563EB)' }}>
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-aqua-400/20 blur-2xl pointer-events-none"/>
          <div className="relative">
            <div className="flex items-center gap-2 min-w-0">
              <Icon name="sparkles" size={15} className="text-aqua-300 shrink-0"/>
              <span className="text-[12.5px] font-bold truncate">{PRODUCT.engine}</span>
            </div>
            <div className="text-[10.5px] text-white/55 mt-0.5">Rules-anchored · Zero-hallucination</div>
            <Link href="/evaluation" className="mt-3 text-[11px] font-bold text-aqua-300 hover:text-aqua-100 inline-flex items-center gap-1">
              Evaluation suite <Icon name="chevronRight" size={12}/>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/emails': 'Email Intelligence',
  '/reviews': 'Human Review',
  '/evaluation': 'Evaluation',
  '/settings': 'Settings',
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const route = usePathname() || '';
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const [openCount, setOpenCount] = useState<number | null>(null);
  const [prof, setProf] = useState(false);

  useEffect(() => {
    fetch('/api/reviews')
      .then((r) => r.json())
      .then((d) => setOpenCount(d.open?.length ?? 0))
      .catch(() => setOpenCount(0));
  }, [route]);

  const title = PAGE_TITLES[route] ?? (route.startsWith('/emails/') ? 'Email Detail' : 'Console');

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    try {
      window.localStorage.removeItem('cargotrust_auth');
    } catch { /* ignore */ }
    router.push('/login');
  };

  return (
    <ToastProvider>
      <div className="min-h-screen">
        {/* desktop sidebar */}
        <aside className="hidden lg:flex w-[248px] shrink-0 border-r border-slate-200/70 bg-white flex-col fixed inset-y-0 z-40">
          <Sidebar route={route} openCount={openCount}/>
        </aside>
        {/* mobile drawer */}
        {drawer && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm" onClick={() => setDrawer(false)}/>
            <M from={{ opacity: 0, x: -40 }} to={{ opacity: 1, x: 0 }} dur={0.3} className="absolute inset-y-0 left-0 w-[264px] bg-white shadow-lift">
              <Sidebar route={route} openCount={openCount}/>
            </M>
          </div>
        )}

        <div className="lg:pl-[248px] min-w-0 flex flex-col min-h-screen">
          <header className="sticky top-0 z-30 h-16 shrink-0 bg-white/85 backdrop-blur-md border-b border-slate-200/70 flex items-center gap-3 lg:gap-4 px-4 lg:px-6">
            <button onClick={() => setDrawer(true)} className="lg:hidden w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0" aria-label="Open menu">
              <Icon name="menu" size={19}/>
            </button>
            <div className="hidden md:flex items-center gap-2 text-[13px] min-w-0">
              <span className="text-slate-300 font-medium whitespace-nowrap">Console</span>
              <Icon name="chevronRight" size={13} className="text-slate-300 shrink-0"/>
              <span className="font-bold text-ink-800 whitespace-nowrap">{title}</span>
            </div>
            <div className="flex-1"/>
            <Link href="/api/submission" prefetch={false} className="hidden sm:inline-flex btn-ghost btn-sm" title="Download the official-format submission.json">
              <Icon name="download" size={14}/>submission.json
            </Link>
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-100 px-3 py-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulseDot"/>
              <span className="text-[11.5px] font-bold text-emerald-700 whitespace-nowrap">Engine · Online</span>
            </div>
            <div className="w-px h-7 bg-slate-200 shrink-0"/>
            <div className="relative shrink-0">
              <button onClick={() => setProf(!prof)} className="flex items-center gap-2.5 rounded-xl pl-1.5 pr-2 py-1.5 hover:bg-slate-100 transition-colors">
                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-aqua-500 text-white text-[12px] font-bold flex items-center justify-center shadow-glowBrand shrink-0">AR</span>
                <span className="hidden xl:block text-left leading-tight min-w-0">
                  <span className="block text-[12.5px] font-bold text-ink-800 whitespace-nowrap">Amelia Rahman</span>
                  <span className="block text-[10.5px] text-slate-400 whitespace-nowrap">Verification Lead</span>
                </span>
                <Icon name="chevronDown" size={14} className="text-slate-400 shrink-0"/>
              </button>
              {prof && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setProf(false)}/>
                  <M from={{ opacity: 0, y: -8 }} to={{ opacity: 1, y: 0 }} dur={0.25} className="absolute right-0 top-12 z-20 w-56 card p-2 shadow-lift">
                    <div className="px-3 py-2.5 border-b border-slate-100">
                      <div className="text-[13px] font-bold text-ink-900">Amelia Rahman</div>
                      <div className="text-[11px] text-slate-400">amelia@cargotrust.ai</div>
                    </div>
                    <Link href="/settings" onClick={() => setProf(false)} className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-ink-700 hover:bg-slate-50">
                      <Icon name="user" size={15} className="text-slate-400 shrink-0"/>Profile settings
                    </Link>
                    <button onClick={logout} className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-red-500 hover:bg-red-50">
                      <Icon name="logOut" size={15} className="shrink-0"/>Sign out
                    </button>
                  </M>
                </>
              )}
            </div>
          </header>
          <main className="flex-1 p-4 lg:p-6 animate-pageIn w-full max-w-[1400px] mx-auto">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
