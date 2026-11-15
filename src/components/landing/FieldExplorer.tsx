'use client';

import { useState } from 'react';
import { Icon } from '@/components/icons';
import { cx } from '@/lib/utils';

/** The seven compared fields, the rule applied to each, and a worked example (fictional values). */
const FIELDS = [
  {
    key: 'shipper', label: 'Shipper', icon: 'building',
    rule: 'The legal name must be the same company. Case, punctuation and standard legal forms (LTD and LIMITED, CO. and COMPANY) are ignored.',
    si: 'HARBOUR LINE PAPER CO., LTD', bl: 'Harbour Line Paper Company Limited', ok: true,
    why: 'Formatting differs, the company is the same.',
  },
  {
    key: 'consignee', label: 'Consignee', icon: 'user',
    rule: 'An extra word in a company name means a different legal entity, so it is flagged. Addresses are not compared, because documents often omit them.',
    si: 'BLUEWATER STATIONERY TRADING', bl: 'BLUEWATER STATIONERY TRADING (MIDDLE EAST) FZE', ok: false,
    why: 'A different company: the BL adds a branch and legal form.',
  },
  {
    key: 'notify', label: 'Notify party', icon: 'flag',
    rule: 'Compared like the consignee, on the name line only.',
    si: 'BLUEWATER STATIONERY LLC', bl: 'BLUEWATER STATIONERY L.L.C.', ok: true,
    why: 'Punctuation only.',
  },
  {
    key: 'pol', label: 'Port of loading', icon: 'anchor',
    rule: 'The city must agree, and the UN/LOCODE too when both documents carry one.',
    si: 'NANTONG, CHINA (CNNTG)', bl: 'NANTONG (CNNTG)', ok: true,
    why: 'Same city, same code. The country is optional.',
  },
  {
    key: 'pod', label: 'Port of discharge', icon: 'mapPin',
    rule: 'A matching code is not enough. If the code stays but the city changes, the field is flagged.',
    si: 'FREMANTLE, AUSTRALIA (AUFRE)', bl: 'BUSAN, SOUTH KOREA (AUFRE)', ok: false,
    why: 'The code matches but the city does not, which is a typical copy-paste error.',
  },
  {
    key: 'count', label: 'Container count', icon: 'box',
    rule: 'The number of containers must be identical. When no total is stated, rows in the container table are counted.',
    si: "6 x 20'FCL", bl: "5 x 20'FCL", ok: false,
    why: 'One container short on the BL.',
  },
  {
    key: 'weight', label: 'Gross weight', icon: 'scale',
    rule: 'Converted to kilograms, then compared exactly. European number formats are understood. Never "close enough".',
    si: '21.577 MT', bl: '21,577 KGS', ok: true,
    why: '21.577 tonnes is 21,577 kg.',
  },
];

export function FieldExplorer() {
  const [k, setK] = useState(FIELDS[4].key);
  const f = FIELDS.find((x) => x.key === k)!;
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2" role="radiogroup" aria-label="Choose a field">
        {FIELDS.map((x) => (
          <button
            key={x.key}
            role="radio"
            aria-checked={x.key === k}
            onClick={() => setK(x.key)}
            className={cx(
              'flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-left transition-colors',
              x.key === k ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-line bg-white text-ink-700 hover:border-slate-300',
            )}
          >
            <Icon name={x.icon} size={16} className={x.key === k ? 'text-brand-600' : 'text-ink-400'}/>
            <span className="text-[13.5px] font-medium">{x.label}</span>
          </button>
        ))}
        <p className="col-span-full text-[12.5px] text-ink-400 mt-1">Choose a field to see how it is compared.</p>
      </div>

      <div key={f.key} className="animate-fadeUp bg-white rounded-lg border border-line overflow-hidden" aria-live="polite">
        <div className="px-5 py-4 border-b border-line">
          <div className="text-[15px] font-semibold text-ink-900">{f.label}</div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-600">{f.rule}</p>
        </div>
        <dl className="px-5 py-4 grid grid-cols-[90px_1fr] gap-y-2.5 text-[13px]">
          <dt className="text-ink-400">SI</dt><dd className="font-mono text-ink-800 break-words">{f.si}</dd>
          <dt className="text-ink-400">Draft BL</dt><dd className={cx('font-mono break-words', f.ok ? 'text-ink-800' : 'text-red-700 font-medium')}>{f.bl}</dd>
        </dl>
        <div className={cx('px-5 py-3 border-t flex items-start gap-2.5 text-[13px]', f.ok ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : 'bg-red-50 border-red-100 text-red-900')}>
          <Icon name={f.ok ? 'checkCircle' : 'alertCircle'} size={16} className="shrink-0 mt-px"/>
          <span><b>{f.ok ? 'Match.' : 'Discrepancy.'}</b> {f.why}</span>
        </div>
      </div>
    </div>
  );
}
