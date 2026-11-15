'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon, Logo } from '@/components/icons';
import { cx } from '@/lib/utils';

const LINKS = [
  ['#workflow', 'How it works'],
  ['#fields', 'What is checked'],
  ['#scans', 'Scans'],
  ['#trust', 'Transparency'],
  ['#deploy', 'Deployment'],
];

export function LandingHeader() {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <header className={cx('fixed top-0 inset-x-0 z-50 transition-colors duration-200', solid || open ? 'bg-navy-950/95 backdrop-blur border-b border-white/10' : 'bg-transparent')}>
      <div className="max-w-6xl mx-auto px-4 lg:px-6 h-16 flex items-center gap-8">
        <Link href="/" aria-label="CargoTrust AI home"><Logo light/></Link>
        <nav className="hidden lg:flex items-center gap-6" aria-label="Sections">
          {LINKS.map(([h, l]) => (
            <a key={h} href={h} className="text-[13.5px] text-slate-300 hover:text-white transition-colors">{l}</a>
          ))}
        </nav>
        <div className="flex-1"/>
        <Link href="/login" className="hidden sm:inline-flex btn btn-sm bg-white text-navy-900 hover:bg-slate-100">Sign in</Link>
        <button onClick={() => setOpen(!open)} className="lg:hidden text-white p-1.5 -mr-1.5" aria-expanded={open} aria-controls="landing-menu" aria-label={open ? 'Close menu' : 'Open menu'}>
          <Icon name={open ? 'x' : 'menu'} size={20}/>
        </button>
      </div>
      {open && (
        <nav id="landing-menu" className="lg:hidden border-t border-white/10 px-4 py-3 space-y-1" aria-label="Sections">
          {LINKS.map(([h, l]) => (
            <a key={h} href={h} onClick={() => setOpen(false)} className="block rounded px-2 py-2 text-[14px] text-slate-200 hover:bg-white/5">{l}</a>
          ))}
          <Link href="/login" className="block rounded px-2 py-2 text-[14px] font-semibold text-white">Sign in</Link>
        </nav>
      )}
    </header>
  );
}
