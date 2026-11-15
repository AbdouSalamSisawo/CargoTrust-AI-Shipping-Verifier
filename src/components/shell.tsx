'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cx } from '@/lib/utils';
import { Icon, Logo } from './icons';
import { ToastProvider, M } from './ui';
import type { PublicUser, Role } from '@/lib/types';

interface SessionInfo { user: PublicUser; organisation: string; aiActive: boolean }
const SessionCtx = createContext<SessionInfo | null>(null);

/** The signed-in user (console pages only). */
export function useSession(): SessionInfo {
  const s = useContext(SessionCtx);
  if (!s) throw new Error('useSession outside the console');
  return s;
}

const RANK: Record<Role, number> = { viewer: 0, operator: 1, admin: 2 };
export const can = (user: PublicUser, role: Role) => RANK[user.role] >= RANK[role];

type NavEntry = { href: string; label: string; icon: string; badge?: boolean; role?: Role };
const NAV: { section: string; items: NavEntry[] }[] = [
  { section: 'Operations', items: [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { href: '/new', label: 'New check', icon: 'upload', role: 'operator' },
    { href: '/emails', label: 'Inbox', icon: 'inbox' },
    { href: '/reviews', label: 'Reviews', icon: 'clipboardCheck', badge: true },
  ]},
  { section: 'Administration', items: [
    { href: '/activity', label: 'Activity log', icon: 'history', role: 'operator' },
    { href: '/evaluation', label: 'Quality', icon: 'gauge' },
    { href: '/settings', label: 'Settings', icon: 'settings' },
  ]},
];

const ROLE_LABEL: Record<Role, string> = { admin: 'Administrator', operator: 'Operator', viewer: 'Viewer' };
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';

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

function Sidebar({ route, openCount, user }: { route: string; openCount: number | null; user: PublicUser }) {
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
              {sec.items.filter((item) => !item.role || can(user, item.role)).map((item) => (
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
    </div>
  );
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/emails': 'Inbox',
  '/new': 'New check',
  '/reviews': 'Human Review',
  '/activity': 'Activity log',
  '/evaluation': 'Quality',
  '/settings': 'Settings',
};

export function AppShell({ children, user, organisation, aiActive }: { children: React.ReactNode; user: PublicUser; organisation: string; aiActive: boolean }) {
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
    router.push('/login');
    router.refresh();
  };

  return (
    <SessionCtx.Provider value={{ user, organisation, aiActive }}>
    <ToastProvider>
      <div className="min-h-screen">
        {/* desktop sidebar */}
        <aside className="hidden lg:flex w-[248px] shrink-0 border-r border-slate-200/70 bg-white flex-col fixed inset-y-0 z-40">
          <Sidebar route={route} openCount={openCount} user={user}/>
        </aside>
        {/* mobile drawer */}
        {drawer && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm" onClick={() => setDrawer(false)}/>
            <M from={{ opacity: 0, x: -40 }} to={{ opacity: 1, x: 0 }} dur={0.3} className="absolute inset-y-0 left-0 w-[264px] bg-white shadow-lift">
              <Sidebar route={route} openCount={openCount} user={user}/>
            </M>
          </div>
        )}

        <div className="lg:pl-[248px] min-w-0 flex flex-col min-h-screen">
          <header className="sticky top-0 z-30 h-16 shrink-0 bg-white/85 backdrop-blur-md border-b border-slate-200/70 flex items-center gap-3 lg:gap-4 px-4 lg:px-6">
            <button onClick={() => setDrawer(true)} className="lg:hidden w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0" aria-label="Open menu">
              <Icon name="menu" size={19}/>
            </button>
            <div className="hidden md:flex items-center gap-2 text-[13px] min-w-0">
              <span className="text-slate-300 font-medium whitespace-nowrap truncate max-w-[180px]">{organisation}</span>
              <Icon name="chevronRight" size={13} className="text-slate-300 shrink-0"/>
              <span className="font-bold text-ink-800 whitespace-nowrap">{title}</span>
            </div>
            <div className="flex-1"/>
            {can(user, 'operator') && route !== '/new' && (
              <Link href="/new" className="hidden sm:inline-flex btn-primary btn-sm">
                <Icon name="upload" size={14}/>New check
              </Link>
            )}
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-100 px-3 py-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulseDot"/>
              <span className="text-[11.5px] font-bold text-emerald-700 whitespace-nowrap">Engine · Online</span>
            </div>
            <div className="w-px h-7 bg-slate-200 shrink-0"/>
            <div className="relative shrink-0">
              <button onClick={() => setProf(!prof)} className="flex items-center gap-2.5 rounded-xl pl-1.5 pr-2 py-1.5 hover:bg-slate-100 transition-colors">
                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-aqua-500 text-white text-[12px] font-bold flex items-center justify-center shadow-glowBrand shrink-0">{initials(user.name)}</span>
                <span className="hidden xl:block text-left leading-tight min-w-0">
                  <span className="block text-[12.5px] font-bold text-ink-800 whitespace-nowrap">{user.name}</span>
                  <span className="block text-[10.5px] text-slate-400 whitespace-nowrap">{ROLE_LABEL[user.role]}</span>
                </span>
                <Icon name="chevronDown" size={14} className="text-slate-400 shrink-0"/>
              </button>
              {prof && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setProf(false)}/>
                  <M from={{ opacity: 0, y: -8 }} to={{ opacity: 1, y: 0 }} dur={0.25} className="absolute right-0 top-12 z-20 w-56 card p-2 shadow-lift">
                    <div className="px-3 py-2.5 border-b border-slate-100">
                      <div className="text-[13px] font-bold text-ink-900 truncate">{user.name}</div>
                      <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
                    </div>
                    <Link href="/settings" onClick={() => setProf(false)} className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-ink-700 hover:bg-slate-50">
                      <Icon name="user" size={15} className="text-slate-400 shrink-0"/>Account settings
                    </Link>
                    <button onClick={logout} className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-red-500 hover:bg-red-50">
                      <Icon name="logOut" size={15} className="shrink-0"/>Sign out
                    </button>
                  </M>
                </>
              )}
            </div>
          </header>
          {user.mustChangePassword && route !== '/settings' && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 lg:px-6 py-2.5 text-[12.5px] text-amber-800 flex items-center gap-2">
              <Icon name="alertTriangle" size={14} className="shrink-0"/>
              <span className="flex-1">You are signed in with a temporary password. Choose your own before you continue.</span>
              <Link href="/settings" className="font-bold underline underline-offset-2 whitespace-nowrap">Change password</Link>
            </div>
          )}
          <main className="flex-1 p-4 lg:p-6 animate-pageIn w-full max-w-[1400px] mx-auto">{children}</main>
        </div>
      </div>
    </ToastProvider>
    </SessionCtx.Provider>
  );
}
