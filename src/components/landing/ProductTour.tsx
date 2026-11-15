'use client';

import { useState } from 'react';
import { cx } from '@/lib/utils';

const SHOTS = [
  { key: 'dashboard', label: 'Dashboard', src: '/screens/dashboard.png', caption: 'Results across the inbox, what needs attention, and which fields most often differ.' },
  { key: 'detail', label: 'Check detail', src: '/screens/email-trace.png', caption: 'Each decision step by step, the source line behind every value, and the original file.' },
  { key: 'new', label: 'New check', src: '/screens/new-check.png', caption: 'Upload an SI and draft BL, take a photo, or import customer emails.' },
  { key: 'activity', label: 'Activity log', src: '/screens/activity.png', caption: 'Who signed in, checked, reviewed or changed a setting, and when.' },
];

export function ProductTour() {
  const [k, setK] = useState(SHOTS[0].key);
  const s = SHOTS.find((x) => x.key === k)!;
  return (
    <div>
      <div role="tablist" aria-label="Product screens" className="flex flex-wrap gap-1 border-b border-white/10">
        {SHOTS.map((x) => (
          <button
            key={x.key}
            role="tab"
            aria-selected={x.key === k}
            onClick={() => setK(x.key)}
            className={cx('px-3.5 py-2.5 text-[13.5px] font-medium -mb-px border-b-2 transition-colors', x.key === k ? 'border-aqua-400 text-white' : 'border-transparent text-slate-400 hover:text-slate-200')}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-6">
        <div className="rounded-lg overflow-hidden border border-white/10 bg-navy-900 shadow-lift">
          <div className="h-7 bg-navy-800 flex items-center gap-1.5 px-3" aria-hidden="true">
            <span className="w-2.5 h-2.5 rounded-full bg-white/15"/><span className="w-2.5 h-2.5 rounded-full bg-white/15"/><span className="w-2.5 h-2.5 rounded-full bg-white/15"/>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={s.key} src={s.src} alt={`${s.label} screen of the CargoTrust console`} width={1440} height={900} loading="lazy" className="w-full h-auto block animate-fadeUp"/>
        </div>
        <p className="mt-3 text-[13.5px] text-slate-300">{s.caption} <span className="text-slate-500">Screens show the bundled sample data.</span></p>
      </div>
    </div>
  );
}
