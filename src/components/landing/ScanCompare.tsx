'use client';

import { useId, useState } from 'react';

const LINES: [string, string][] = [
  ['Shipper', 'NORDHAVN PAPER TRADING FZE'],
  ['Consignee', 'BLUEWATER STATIONERY LLC'],
  ['Notify Party', 'SAME AS CONSIGNEE'],
  ['Port of Loading', 'NANTONG, CHINA'],
  ['Port of Discharge', 'JEBEL ALI, UAE'],
  ['No. of Containers', "2 x 40'HC"],
  ['Gross Weight', '40,326 KGS'],
];

/** The scan as received: drawn as SVG with grain, skew and faded print (illustration). */
function Scan() {
  const fid = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 480 360" className="w-full h-full" aria-hidden="true">
      <defs>
        <filter id={`grain-${fid}`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="n"/>
          <feColorMatrix in="n" type="saturate" values="0"/>
          <feComponentTransfer><feFuncA type="table" tableValues="0 .22"/></feComponentTransfer>
          <feComposite in2="SourceGraphic" operator="in"/>
        </filter>
        <filter id={`ink-${fid}`}><feGaussianBlur stdDeviation=".45"/></filter>
      </defs>
      <rect width="480" height="360" fill="#CFCAC0"/>
      <g transform="rotate(-1.6 240 180)">
        <rect x="26" y="18" width="428" height="330" fill="#EFEBE2"/>
        <g filter={`url(#ink-${fid})`} fill="#2B2B2B" fontFamily="'Courier New', monospace">
          <text x="48" y="52" fontSize="15" fontWeight="700" opacity=".85">SHIPPING INSTRUCTION</text>
          {LINES.map(([l, v], i) => (
            <g key={l} opacity={i === 6 ? 0.55 : 0.8}>
              <text x="48" y={88 + i * 34} fontSize="11.5">{l}:</text>
              <text x="190" y={88 + i * 34} fontSize="11.5">{i === 6 ? '40,3 6 KGS' : v}</text>
            </g>
          ))}
        </g>
        <path d="M300 300 q30 -20 70 6" stroke="#2D4A8A" strokeWidth="2" fill="none" opacity=".5"/>
        <circle cx="400" cy="70" r="26" stroke="#7A2E2E" strokeWidth="2" fill="none" opacity=".35"/>
      </g>
      <rect width="480" height="360" filter={`url(#grain-${fid})`} fill="#000"/>
    </svg>
  );
}

export function ScanCompare() {
  const [pos, setPos] = useState(55);
  return (
    <figure className="m-0">
      <div className="relative aspect-[4/3] rounded-lg overflow-hidden border border-line bg-white select-none">
        <div className="absolute inset-0"><Scan/></div>
        <div className="absolute inset-0 bg-navy-950 px-6 py-6 sm:px-8 font-mono text-[11.5px] sm:text-[13px] leading-[2.15] text-slate-300" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
          <div className="text-aqua-300 mb-1">What was read</div>
          {LINES.map(([l, v]) => (
            <div key={l} className="truncate">
              <span className="text-slate-500">{l}:</span>{' '}
              {l === 'Gross Weight' ? <><span className="text-amber-300">40,3[?]6 KGS</span> <span className="text-slate-500">unclear, needs review</span></> : v}
            </div>
          ))}
        </div>
        <div className="absolute inset-y-0 w-0.5 bg-white shadow pointer-events-none" style={{ left: `${pos}%` }} aria-hidden="true">
          <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 w-7 h-7 rounded-full bg-white border border-line shadow flex items-center justify-center text-ink-500 text-[11px]">⇆</span>
        </div>
        <span className="absolute top-3 left-3 tag bg-white/90 text-ink-600">As received</span>
        <span className="absolute top-3 right-3 tag bg-navy-800 text-aqua-100">Structured text</span>
      </div>
      <label className="mt-3 flex items-center gap-3 text-[12.5px] text-ink-500">
        <span className="whitespace-nowrap">Compare</span>
        <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} className="flex-1" aria-label="Move the divider between the scan and the extracted text"/>
      </label>
      <figcaption className="mt-1 text-[11.5px] text-ink-400">Illustration. On a real scan, unclear characters are marked rather than guessed, and the case goes to a person.</figcaption>
    </figure>
  );
}
