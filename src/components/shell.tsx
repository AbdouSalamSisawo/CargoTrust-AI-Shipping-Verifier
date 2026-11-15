'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cx } from '@/lib/utils';
import { Icon, Logo, LogoMark } from './icons';
import { ToastProvider } from './ui';
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
    { href: '/reviews', label: 'Review queue', icon: 'clipboardCheck', badge: true },
  ]},
  { section: 'Administration', items: [
    { href: '/activity', label: 'Activity log', icon: 'history', role: 'operator' },
    { href: '/evaluation', label: 'Quality', icon: 'gauge' },
    { href: '/settings', label: 'Settings', icon: 'settings' },
  ]},
];

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/new': 'New check',
  '/emails': 'Inbox',
  '/reviews': 'Review queue',
  '/activity': 'Activity log',
  '/evaluation': 'Quality',
  '/settings': 'Settings',
};

const ROLE_LABEL: Record<Role, string> = { admin: 'Administrator', operator: 'Operator', viewer: 'Viewer' };
const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';

const COLLAPSE_KEY = 'ct.sidebar.collapsed';

/* ------------------------------------------------------------------ sidebar */

function NavItem({ item, active, badge, collapsed, onNavigate }: { item: NavEntry; active: boolean; badge?: number; collapsed: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'group relative flex items-center gap-2.5 rounded-md h-9 text-[13.5px] font-medium transition-colors duration-150',
        collapsed ? 'justify-center px-0' : 'px-2.5',
        active ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-slate-100 hover:text-ink-900',
      )}
    >
      {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-brand-600" aria-hidden="true"/>}
      <Icon name={item.icon} size={17} className={cx('shrink-0', active ? 'text-brand-600' : 'text-ink-400 group-hover:text-ink-600')}/>
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {badge != null && badge > 0 && (
        collapsed
          ? <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-amber-500" aria-label={`${badge} open`}/>
          : <span className="min-w-[22px] h-5 px-1.5 rounded text-[11px] font-semibold flex items-center justify-center bg-amber-100 text-amber-800 tabular-nums">{badge}</span>
      )}
    </Link>
  );
}

function SidebarNav({ route, openCount, user, collapsed, onNavigate }: { route: string; openCount: number | null; user: PublicUser; collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6" aria-label="Main">
      {NAV.map((sec) => {
        const items = sec.items.filter((i) => !i.role || can(user, i.role));
        if (!items.length) return null;
        return (
          <div key={sec.section}>
            {collapsed
              ? <div className="mx-auto mb-2 h-px w-6 bg-line" aria-hidden="true"/>
              : <div className="px-2.5 mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-300">{sec.section}</div>}
            <div className="space-y-0.5">
              {items.map((item) => (
                <NavItem
                  key={item.href}
                  item={item}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                  active={route === item.href || route.startsWith(item.href + '/')}
                  badge={item.badge ? (openCount ?? 0) : undefined}
                />
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

/* ------------------------------------------------------------- profile menu */

function ProfileMenu({ user, onSignOut }: { user: PublicUser; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md pl-1 pr-1.5 py-1 hover:bg-slate-100 transition-colors max-w-[220px]"
      >
        <span className="w-7 h-7 rounded-full bg-navy-800 text-white text-[11px] font-semibold flex items-center justify-center shrink-0" aria-hidden="true">
          {initials(user.name)}
        </span>
        <span className="hidden md:block text-[13px] font-medium text-ink-800 truncate">{user.name}</span>
        <Icon name="chevronDown" size={14} className={cx('text-ink-400 shrink-0 transition-transform duration-150', open && 'rotate-180')}/>
        <span className="sr-only">Account menu</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+6px)] z-50 w-64 bg-white rounded-md border border-line shadow-lift py-1.5 animate-popIn origin-top-right">
          <div className="px-3.5 py-2.5 border-b border-line">
            <div className="text-[13px] font-semibold text-ink-900 truncate">{user.name}</div>
            <div className="text-[12px] text-ink-400 truncate">{user.email}</div>
            <div className="mt-1.5 tag bg-slate-100 text-ink-600">{ROLE_LABEL[user.role]}</div>
          </div>
          <Link href="/settings" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-ink-700 hover:bg-slate-50">
            <Icon name="user" size={15} className="text-ink-400"/>Account settings
          </Link>
          <button role="menuitem" onClick={onSignOut} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-ink-700 hover:bg-slate-50">
            <Icon name="logOut" size={15} className="text-ink-400"/>Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- shell */

export function AppShell({ children, user, organisation, aiActive }: { children: React.ReactNode; user: PublicUser; organisation: string; aiActive: boolean }) {
  const route = usePathname() || '';
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openCount, setOpenCount] = useState<number | null>(null);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      /* storage unavailable */
    }
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        /* storage unavailable */
      }
      return !c;
    });
  };

  useEffect(() => {
    fetch('/api/reviews')
      .then((r) => r.json())
      .then((d) => setOpenCount(d.open?.length ?? 0))
      .catch(() => setOpenCount(null));
  }, [route]);

  useEffect(() => setDrawer(false), [route]);

  const title = PAGE_TITLES[route] ?? (route.startsWith('/emails/') ? 'Item detail' : '');

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <SessionCtx.Provider value={{ user, organisation, aiActive }}>
      <ToastProvider>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[90] btn-primary btn-sm">Skip to content</a>
        <div className="min-h-screen">
          {/* desktop sidebar */}
          <aside
            className={cx(
              'hidden lg:flex fixed inset-y-0 z-40 flex-col bg-white border-r border-line transition-[width] duration-200',
              collapsed ? 'w-[64px]' : 'w-[232px]',
            )}
          >
            <div className={cx('h-14 flex items-center border-b border-line shrink-0', collapsed ? 'justify-center' : 'px-4')}>
              <Link href="/dashboard" aria-label="CargoTrust AI dashboard">{collapsed ? <LogoMark size={28}/> : <Logo/>}</Link>
            </div>
            <SidebarNav route={route} openCount={openCount} user={user} collapsed={collapsed}/>
            <div className={cx('border-t border-line p-3 flex items-center gap-2', collapsed && 'justify-center')}>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-ink-300">Workspace</div>
                  <div className="text-[12.5px] font-medium text-ink-700 truncate">{organisation}</div>
                </div>
              )}
              <button onClick={toggleCollapsed} className="btn-quiet btn-sm !px-2" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={15}/>
              </button>
            </div>
          </aside>

          {/* mobile drawer */}
          <div className={cx('lg:hidden fixed inset-0 z-50 transition-opacity duration-200', drawer ? 'opacity-100' : 'opacity-0 pointer-events-none')} aria-hidden={!drawer}>
            <div className="absolute inset-0 bg-navy-950/40" onClick={() => setDrawer(false)}/>
            <div className={cx('absolute inset-y-0 left-0 w-[264px] bg-white shadow-lift flex flex-col transition-transform duration-200', drawer ? 'translate-x-0' : '-translate-x-full')}>
              <div className="h-14 px-4 flex items-center justify-between border-b border-line">
                <Logo/>
                <button onClick={() => setDrawer(false)} className="btn-quiet btn-sm !px-2" aria-label="Close menu"><Icon name="x" size={16}/></button>
              </div>
              <SidebarNav route={route} openCount={openCount} user={user} collapsed={false} onNavigate={() => setDrawer(false)}/>
            </div>
          </div>

          <div className={cx('min-w-0 flex flex-col min-h-screen transition-[padding] duration-200', collapsed ? 'lg:pl-[64px]' : 'lg:pl-[232px]')}>
            <header className="sticky top-0 z-30 h-14 shrink-0 bg-white/95 backdrop-blur-sm border-b border-line flex items-center gap-3 px-4 lg:px-6">
              <button onClick={() => setDrawer(true)} className="lg:hidden btn-quiet btn-sm !px-2 -ml-1" aria-label="Open menu">
                <Icon name="menu" size={18}/>
              </button>
              <div className="flex items-center gap-1.5 text-[13px] min-w-0">
                <span className="hidden sm:inline text-ink-400 truncate max-w-[200px]">{organisation}</span>
                {title && <Icon name="chevronRight" size={13} className="hidden sm:block text-ink-300 shrink-0"/>}
                <span className="font-medium text-ink-800 truncate">{title}</span>
              </div>
              <div className="flex-1"/>
              {can(user, 'operator') && route !== '/new' && (
                <Link href="/new" className="btn-primary btn-sm">
                  <Icon name="upload" size={14}/><span className="hidden sm:inline">New check</span>
                </Link>
              )}
              <div className="w-px h-6 bg-line shrink-0" aria-hidden="true"/>
              <ProfileMenu user={user} onSignOut={signOut}/>
            </header>

            {user.demo && (
              <div className="bg-brand-50 border-b border-brand-100 px-4 lg:px-6 py-2 text-[13px] text-brand-800 flex items-center gap-2" role="status">
                <Icon name="eye" size={14} className="shrink-0"/>
                <span className="flex-1">Read-only demo. Open any check to see its decision trace and evidence; uploading and changes are switched off.</span>
                <button onClick={signOut} className="font-semibold underline underline-offset-2 whitespace-nowrap">Leave demo</button>
              </div>
            )}
            {user.mustChangePassword && route !== '/settings' && (
              <div className="bg-amber-50 border-b border-amber-200 px-4 lg:px-6 py-2 text-[13px] text-amber-900 flex items-center gap-2" role="alert">
                <Icon name="alertTriangle" size={14} className="shrink-0"/>
                <span className="flex-1">You are signed in with a temporary password. Please choose your own.</span>
                <Link href="/settings" className="font-semibold underline underline-offset-2 whitespace-nowrap">Change password</Link>
              </div>
            )}
            <main id="main" className="flex-1 px-4 py-6 lg:px-8 animate-pageIn w-full max-w-[1320px] mx-auto">{children}</main>
          </div>
        </div>
      </ToastProvider>
    </SessionCtx.Provider>
  );
}
