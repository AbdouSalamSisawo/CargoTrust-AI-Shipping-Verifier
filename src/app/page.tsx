import Link from 'next/link';
import { Icon, Logo, LogoMark } from '@/components/icons';

/* ------------------------------------------------------------------ */
/* Landing page for CargoTrust AI — server component, CSS animations only */
/* ------------------------------------------------------------------ */

const NAV_LINKS = [
  ['#problem', 'Problem'],
  ['#solution', 'Solution'],
  ['#how', 'How it works'],
  ['#features', 'Features'],
  ['#product', 'Product'],
  ['#tech', 'Tech'],
];

const PROBLEMS = [
  {
    icon: 'mail',
    color: '#2563EB',
    bg: '#EFF6FF',
    title: 'The right emails are hard to find',
    body: 'One shared inbox receives document-check requests, new Shipping Instructions, invoice queries, operational updates — and spam. Staff read every message to decide what it needs. A check request that is overlooked never reaches the checking step.',
  },
  {
    icon: 'gitCompare',
    color: '#DC2626',
    bg: '#FEF2F2',
    title: 'Manual comparison is repetitive and error-prone',
    body: 'Names, ports, quantities and weights must be checked across two documents, every time. One missed discrepancy means corrections, delays and additional work — long after the mistake was set in ink.',
  },
  {
    icon: 'shuffle',
    color: '#D97706',
    bg: '#FFFBEB',
    title: 'The same fact is written two ways',
    body: 'One document says “Port of Loading”, the other says “Load Port”. “Gross Weight (KG)” and “Gross Wt (kgs)” are the same field. Any system that matches header text instead of meaning will drown in false alarms.',
  },
];

const CAPABILITIES = [
  {
    icon: 'sparkles',
    color: '#8B5CF6',
    bg: '#F5F3FF',
    k: '01 · Classify',
    title: 'Route every message',
    body: 'Reads the newest message (no banners, quotes or signatures) and scores intent — body over subject, so a misleading subject cannot reroute an email. Phishing is screened first; an SI + BL pair is structural proof of a check request.',
  },
  {
    icon: 'scan',
    color: '#06B6D4',
    bg: '#ECFEFF',
    k: '02 · Extract',
    title: 'Read the documents',
    body: 'Text, PDF, Word, Excel, scanned PDFs and phone photos are rebuilt into one layout from page geometry, then the seven fields are aligned by meaning — with the exact source line kept as evidence for every value.',
  },
  {
    icon: 'gitCompare',
    color: '#2563EB',
    bg: '#EFF6FF',
    k: '03 · Compare',
    title: 'Surface mismatches',
    body: 'Exact legal names (only formatting may differ — an extra word is a different company), city + UN/LOCODE for ports, exact numbers after unit conversion. Never fuzzy on numbers.',
  },
  {
    icon: 'userCheck',
    color: '#D97706',
    bg: '#FFFBEB',
    k: '04 · Ask for help',
    title: 'Escalate, never guess',
    body: 'Missing attachments, corrupt files, scans read only by OCR, wrong document types, blanks and placeholders like “TBA” — each becomes a review case with the reason, the evidence and a drafted reply.',
  },
];

const FIELDS = [
  { icon: 'building', label: 'Shipper' },
  { icon: 'user', label: 'Consignee' },
  { icon: 'flag', label: 'Notify Party' },
  { icon: 'anchor', label: 'Port of Loading' },
  { icon: 'mapPin', label: 'Port of Discharge' },
  { icon: 'box', label: 'Container Count' },
  { icon: 'scale', label: 'Gross Weight (kg)' },
];

const STEPS = [
  { icon: 'inbox', title: 'Receive', body: 'The inbox is loaded — 520 JSON email records with SI / BL attachments, exactly as the operations team receives them.' },
  { icon: 'sparkles', title: 'Classify', body: 'Every email is scored into one of five categories from the cleaned body, not the subject. Spam and phishing are screened first; a thread that only asks for a draft BL is tracked, not escalated.' },
  { icon: 'scan', title: 'Read & extract', body: 'Only document-check requests continue. Each file is sniffed by its bytes, rebuilt from layout (PDF geometry, Word tables, Excel rows; scans and photos by OCR and AI vision) and its fields aligned by meaning.' },
  { icon: 'gitCompare', title: 'Compare', body: 'Seven fields, side by side, SI as the reference. Weights in kilograms (21.577 MT ≡ 21,577 KG), ports by city + UN/LOCODE, companies by exact legal name.' },
  { icon: 'shieldCheck', title: 'Decide', body: 'OK when all seven match, MISMATCH with the exact differing fields, or NEEDS_REVIEW with a reason — missing attachment, unreadable, wrong type or missing value.' },
  { icon: 'userCheck', title: 'Human in the loop', body: 'Reviewers approve, correct or reject escalations. Corrections recompute the comparison and update the report — the audit trail keeps who decided what.' },
];

const FEATURES = [
  { icon: 'shieldCheck', title: 'Zero-hallucination by design', body: 'A deterministic engine: no LLM in the decision path, no invented values. Every field carries its source line, and every email shows a step-by-step decision trace.' },
  { icon: 'userCheck', title: 'Human-in-the-loop console', body: 'A dedicated review queue with evidence panels, per-field correction inputs and one-click approve / correct / reject. Corrected values recompute the comparison instantly.' },
  { icon: 'shuffle', title: 'Normalization that kills false alarms', body: 'Legal suffixes (PTE LTD vs LTD), unit conversions (MT → KG), UN/LOCODE ports and address continuation lines are canonicalized before comparison — not fuzzy-matched.' },
  { icon: 'camera', title: 'Scans and phone photos, read by AI', body: 'Image-only PDFs and photos of paper BLs are transcribed by Claude’s vision model — told to copy, never correct — and cross-checked against OCR. The deterministic engine still makes every decision.' },
  { icon: 'gauge', title: 'Proven, not claimed', body: 'Scored 1.0000 by the Averis × Monash 2026 benchmark’s own grader on 520 emails, plus a mutation benchmark: 883 rewritten documents the engine never saw — 100% handled correctly.' },
  { icon: 'send', title: 'The next email, drafted', body: 'Every decision comes with the reply an operator would send: an amendment request listing SI vs BL values, a confirmation, or a request for the missing document.' },
];

const TECH = [
  { k: 'Next.js 14 · App Router', v: 'Server-rendered landing + console, typed route handlers as the API layer.' },
  { k: 'TypeScript (strict)', v: 'End-to-end types from the dataset loader to the review queue — the pipeline shape is the contract.' },
  { k: 'Tailwind CSS', v: 'The entire design system: tokens, motion and components in one place.' },
  { k: 'Deterministic engine', v: 'classify → read → extract → normalize → compare → decide — pure, typed functions with a decision trace.' },
  { k: 'pdf.js · Tesseract · SheetJS', v: 'Layout-aware PDF reading, OCR for scans (cached), Excel and Word parsing — all in Node, no external services.' },
  { k: 'Accounts & audit trail', v: 'scrypt-hashed passwords, signed sessions, admin / operator / viewer roles, and a log of every action.' },
  { k: 'Docker, on-premise', v: 'One container, one data volume. Runs on a laptop for a demo or on a server inside your network.' },
];

function SectionTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 border border-brand-100 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-600">
      <span className="w-1.5 h-1.5 rounded-full bg-brand-500"/>{children}
    </span>
  );
}

function ReportMock() {
  return (
    <div className="relative w-full max-w-md">
      <div className="absolute -top-10 -right-6 w-56 h-56 rounded-full blur-3xl opacity-50 animate-drift pointer-events-none" style={{ background: 'radial-gradient(circle,#06B6D455,transparent 65%)' }}/>
      {/* email card */}
      <div className="card p-4 relative z-10 rotate-[-1.5deg] hover:rotate-0 transition-transform duration-500">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center"><Icon name="mail" size={15}/></span>
          <div className="min-w-0">
            <div className="text-[12px] font-bold text-ink-800 truncate">TO CONFIRM DOCS _ 5RSG-00133</div>
            <div className="text-[10.5px] text-slate-400 font-mono truncate">ops@carrier.example · 2 attachments</div>
          </div>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-50 text-red-600 shrink-0"><Icon name="xCircle" size={10}/>Mismatch</span>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[11.5px]">
          <span className="text-slate-400 font-semibold">Container count</span>
          <span className="font-mono font-bold text-red-600 text-right">SI: 3 · BL: 4</span>
          <span className="text-slate-400 font-semibold">Gross weight</span>
          <span className="font-mono text-emerald-600 text-right">21,577 KG ✓</span>
          <span className="text-slate-400 font-semibold">Consignee</span>
          <span className="font-mono text-emerald-600 text-right">match ✓</span>
        </div>
        <div className="mt-3 rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-2">
          <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Evidence · BL line 7</div>
          <code className="text-[10.5px] font-mono text-slate-500">Container Count: 4 x 40&apos;HC</code>
        </div>
      </div>
      {/* floating chips */}
      <div className="absolute -left-8 -bottom-6 z-20 card px-3.5 py-2.5 flex items-center gap-2 rotate-[1.5deg] animate-floatY">
        <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><Icon name="userCheck" size={14}/></span>
        <div>
          <div className="text-[11px] font-bold text-ink-800">Escalated to review</div>
          <div className="text-[9.5px] text-slate-400">scanned BL · OCR pre-check</div>
        </div>
      </div>
      <div className="absolute -right-4 top-16 z-0 card px-3 py-2 rotate-[2deg] opacity-90">
        <div className="text-[10px] font-bold text-emerald-600 flex items-center gap-1"><Icon name="checkCircle" size={11}/>7/7 fields match</div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="bg-white">
      {/* ================= nav ================= */}
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-200/70">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 h-16 flex items-center gap-6">
          <Link href="/"><Logo/></Link>
          <nav className="hidden md:flex items-center gap-6 ml-4">
            {NAV_LINKS.map(([href, label]) => (
              <a key={href} href={href} className="text-[13px] font-semibold text-slate-500 hover:text-brand-600 transition-colors">{label}</a>
            ))}
          </nav>
          <div className="flex-1"/>
          <Link href="/login" className="btn-primary btn-sm">Sign in <Icon name="arrowRight" size={14}/></Link>
        </div>
      </header>

      {/* ================= hero ================= */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(80% 60% at 70% 0%, #EFF6FF 0%, #fff 60%)' }}/>
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl opacity-40 animate-drift pointer-events-none" style={{ background: 'radial-gradient(circle,#2563EB33,transparent 65%)' }}/>
        <div className="max-w-6xl mx-auto px-4 lg:px-6 pt-16 pb-20 grid lg:grid-cols-2 gap-14 items-center relative">
          <div>
            <SectionTag>Shipping document verification</SectionTag>
            <h1 className="font-display text-[44px] sm:text-[54px] leading-[1.05] font-bold text-navy-900 tracking-tight mt-5">
              From email inbox to <span className="text-grad">discrepancy report.</span>
            </h1>
            <p className="text-[16px] text-slate-500 leading-relaxed mt-5 max-w-xl">
              CargoTrust AI reads a shipping operations inbox, tells document-check requests apart from invoices,
              SI submissions and spam, reads each Shipping Instruction and draft Bill of Lading — PDF, Word, Excel,
              a scan or a phone photo — and catches discrepancies in the seven critical fields before the BL is issued.
              When it cannot decide, it asks a human instead of guessing.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link href="/login" className="btn-primary text-[15px] py-3 px-6">Sign in to the console <Icon name="arrowRight" size={16}/></Link>
              <a href="#how" className="btn-ghost text-[15px] py-3 px-6"><Icon name="play" size={15}/>How it works</a>
            </div>
            <p className="text-[11.5px] text-slate-400 mt-3">Accounts are created by your administrator.</p>
            <div className="flex flex-wrap gap-x-8 gap-y-4 mt-8">
              {[['1.0000', 'independent benchmark score (520 emails)'], ['46/46', 'planted defects caught, exact fields'], ['883/883', 'unseen rewritten documents handled'], ['0', 'false alarms']].map(([v, l]) => (
                <div key={l}>
                  <div className="font-display text-[26px] font-bold text-navy-900">{v}</div>
                  <div className="text-[11.5px] text-slate-400 mt-0.5 max-w-[180px]">{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <ReportMock/>
          </div>
        </div>
      </section>

      {/* ================= problem ================= */}
      <section id="problem" className="py-20 bg-navy-950 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-60" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px)', backgroundSize: '34px 34px' }}/>
        <div className="absolute -top-32 right-0 w-[420px] h-[420px] rounded-full blur-3xl opacity-30 animate-drift pointer-events-none" style={{ background: 'radial-gradient(circle,#2563EB55,transparent 65%)' }}/>
        <div className="max-w-6xl mx-auto px-4 lg:px-6 relative">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-aqua-300">
              <span className="w-1.5 h-1.5 rounded-full bg-aqua-300 animate-pulseDot"/>The problem
            </span>
            <h2 className="font-display text-[32px] sm:text-[38px] font-bold text-white tracking-tight mt-4">
              A shipping team&apos;s inbox is where mistakes are born.
            </h2>
            <p className="text-white/55 text-[15px] leading-relaxed mt-4">
              Every draft Bill of Lading must be checked against its Shipping Instruction before release. Today that
              check lives in email — manual, repetitive, and easy to get wrong. The problem statement is specific:
              find the document requests, compare the shipment details, and explain any mismatch.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5 mt-10">
            {PROBLEMS.map((p) => (
              <div key={p.title} className="rounded-2xl border border-white/10 bg-white/[.05] backdrop-blur p-6 hover:bg-white/[.08] transition-colors">
                <span className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: p.bg, color: p.color }}>
                  <Icon name={p.icon} size={20}/>
                </span>
                <h3 className="font-display text-[16.5px] font-bold text-white mt-4">{p.title}</h3>
                <p className="text-[13px] text-white/55 leading-relaxed mt-2">{p.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[.04] px-6 py-5 flex flex-wrap items-center gap-x-10 gap-y-3">
            {[
              ['1 missed field', 'can mean an amended BL'],
              ['1 missed request', 'means the check never happens'],
              ['2 documents', 'that name the same field differently'],
            ].map(([a, b]) => (
              <div key={a} className="flex items-center gap-2.5 text-[13px]">
                <Icon name="alertTriangle" size={15} className="text-amber-400 shrink-0"/>
                <span className="font-bold text-white">{a}</span>
                <span className="text-white/50">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= solution / capabilities ================= */}
      <section id="solution" className="py-20">
        <div className="max-w-6xl mx-auto px-4 lg:px-6">
          <div className="text-center max-w-2xl mx-auto">
            <SectionTag>The solution</SectionTag>
            <h2 className="font-display text-[32px] sm:text-[38px] font-bold text-navy-900 tracking-tight mt-4">
              Four capabilities, one pipeline.
            </h2>
            <p className="text-slate-500 text-[15px] leading-relaxed mt-4">
              The problem statement asks for exactly four things. Every stage is a pure, testable function — the
              console simply makes the pipeline visible.
            </p>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5 mt-12">
            {CAPABILITIES.map((c, i) => (
              <div key={c.title} className="card p-6 relative hover:shadow-lift hover:-translate-y-1 transition-all duration-300">
                <div className="absolute top-5 right-5 font-mono text-[11px] font-bold text-slate-300">{c.k}</div>
                <span className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: c.bg, color: c.color }}>
                  <Icon name={c.icon} size={20}/>
                </span>
                <h3 className="font-display text-[16.5px] font-bold text-navy-900 mt-4">{c.title}</h3>
                <p className="text-[13px] text-slate-500 leading-relaxed mt-2">{c.body}</p>
                {i < CAPABILITIES.length - 1 && (
                  <div className="hidden xl:block absolute top-1/2 -right-4 z-10 w-8 h-8 rounded-full bg-white shadow-card border border-slate-100 items-center justify-center text-slate-300">
                    <Icon name="arrowRight" size={14} className="mx-auto mt-1.5"/>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* seven fields strip */}
          <div className="mt-12 card p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-[17px] font-bold text-navy-900">The seven fields every check covers</h3>
                <p className="text-[12.5px] text-slate-400 mt-1">SI is the reference document — the draft BL must agree.</p>
              </div>
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-2.5 text-[12px] text-emerald-700 font-semibold">
                All seven agree → “No mismatch detected.”
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-6">
              {FIELDS.map((f) => (
                <div key={f.label} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-3.5 text-center hover:border-brand-200 hover:bg-brand-50/50 transition-colors">
                  <Icon name={f.icon} size={17} className="mx-auto text-brand-500"/>
                  <div className="text-[11.5px] font-bold text-ink-700 mt-2">{f.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-xl bg-navy-950 px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-aqua-300">Example from the problem statement</span>
              <code className="text-[12.5px] font-mono text-white/80">SI lists 3 containers &amp; 22,000 kg · BL lists 4 containers &amp; 22,000 kg</code>
              <span className="text-[12.5px] font-mono font-bold text-red-300">→ flag only container count · SI: 3 / BL: 4</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= how it works ================= */}
      <section id="how" className="py-20 bg-slate-50/70 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-4 lg:px-6">
          <div className="max-w-2xl">
            <SectionTag>How it works</SectionTag>
            <h2 className="font-display text-[32px] sm:text-[38px] font-bold text-navy-900 tracking-tight mt-4">
              A pipeline you can audit end to end.
            </h2>
            <p className="text-slate-500 text-[15px] leading-relaxed mt-4">
              Each stage is a deterministic, typed function — which means every decision can show its work.
              Here is the exact path an email takes through the engine.
            </p>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5 mt-12">
            {STEPS.map((s, i) => (
              <div key={s.title} className="card p-6 relative">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 to-brand-500 text-white flex items-center justify-center shadow-glowBrand">
                    <Icon name={s.icon} size={18}/>
                  </span>
                  <div>
                    <div className="font-mono text-[10px] font-bold text-slate-300">STEP {i + 1}</div>
                    <h3 className="font-display text-[16px] font-bold text-navy-900 leading-tight">{s.title}</h3>
                  </div>
                </div>
                <p className="text-[13px] text-slate-500 leading-relaxed mt-3">{s.body}</p>
              </div>
            ))}
          </div>

          {/* normalization highlight */}
          <div className="mt-10 card p-6 lg:p-8 grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="font-display text-[20px] font-bold text-navy-900">The “same fact, two labels” problem</h3>
              <p className="text-[13.5px] text-slate-500 leading-relaxed mt-3">
                Naive matching compares header text. Ours aligns by meaning: every label variant maps to one canonical
                field, values are canonicalized before comparison, and numerics are never fuzzy-matched.
              </p>
              <div className="mt-4 space-y-2">
                {[
                  ['Port of Loading (POL) · Load Port · POL', '→ port_of_loading'],
                  ['Gross Wt (kgs) · Gross Weight (KG) · 22 MT', '→ gross_weight_kg (22,000)'],
                  ['MOORIM SP CO., LTD · MOORIM SP CO LTD', '→ same legal entity'],
                ['APRIL FINE PAPER TRADING · … (MIDDLE EAST) FZE', '→ different entity — flagged'],
                  ['CALLAO, PERU (PECLL) · Callao, Peru', '→ same port via LOCODE'],
                ].map(([a, b]) => (
                  <div key={a} className="flex flex-wrap items-center gap-2 text-[12px]">
                    <code className="font-mono bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 text-slate-600">{a}</code>
                    <Icon name="arrowRight" size={13} className="text-brand-400 shrink-0"/>
                    <code className="font-mono text-brand-600 font-bold">{b}</code>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg,#0A1A2F,#123A66)' }}>
              <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)', backgroundSize: '22px 22px' }}/>
              <div className="relative p-6 font-mono text-[11.5px] leading-relaxed">
                <div className="text-aqua-300 font-bold tracking-wide">cargotrust.engine &gt; compare email_001</div>
                <div className="text-white/40 mt-2">classify ……… BL_COMPARISON <span className="text-emerald-300">97%</span></div>
                <div className="text-white/40">extract ……… SI 7/7 · BL 7/7 fields</div>
                <div className="text-white/40">normalize …… MYPKG ≡ MYPKG · 21,577 KG</div>
                <div className="text-white/40 mt-1">compare ………</div>
                <div className="text-emerald-300">  ✓ shipper · consignee · notify · pol · pod · weight</div>
                <div className="text-red-300">  ✗ container_count  SI: 3 / BL: 4</div>
                <div className="mt-2 text-white/40">decide ………… <span className="text-red-300 font-bold">MISMATCH</span> <span className="text-white/25">(1 defect field)</span></div>
                <div className="text-white/40">report ………… evidence attached · audit ok</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= features ================= */}
      <section id="features" className="py-20">
        <div className="max-w-6xl mx-auto px-4 lg:px-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <SectionTag>Features</SectionTag>
              <h2 className="font-display text-[32px] sm:text-[38px] font-bold text-navy-900 tracking-tight mt-4">
                Built for the desk that signs off the BL.
              </h2>
            </div>
            <p className="text-slate-500 text-[13.5px] max-w-sm leading-relaxed">
              A wrong Bill of Lading costs amendment fees, demurrage and released cargo. So the engine escalates instead
              of guessing, shows evidence for every value, and keeps a record of who decided what.
            </p>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5 mt-12">
            {FEATURES.map((f) => (
              <div key={f.title} className="card p-6 hover:shadow-lift hover:-translate-y-1 transition-all duration-300">
                <span className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Icon name={f.icon} size={20}/>
                </span>
                <h3 className="font-display text-[16.5px] font-bold text-navy-900 mt-4">{f.title}</h3>
                <p className="text-[13px] text-slate-500 leading-relaxed mt-2">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= product screenshots ================= */}
      <section id="product" className="py-20 bg-navy-950 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)', backgroundSize: '34px 34px' }}/>
        <div className="absolute -bottom-32 -left-24 w-[420px] h-[420px] rounded-full blur-3xl opacity-30 animate-drift pointer-events-none" style={{ background: 'radial-gradient(circle,#06B6D455,transparent 65%)' }}/>
        <div className="max-w-6xl mx-auto px-4 lg:px-6 relative">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-aqua-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulseDot"/>The product
            </span>
            <h2 className="font-display text-[32px] sm:text-[38px] font-bold text-white tracking-tight mt-4">
              A console your reviewers actually want to use.
            </h2>
            <p className="text-white/55 text-[15px] leading-relaxed mt-4">
              Mission control for the whole inbox, a drill-down on every comparison, and a review queue that
              hands the human exactly the context the engine couldn&apos;t resolve.
            </p>
          </div>
          <div className="mt-12 grid md:grid-cols-2 gap-6">
            {[
              ['/screens/dashboard.png', 'Dashboard', 'Live aggregates computed from the processed inbox — nothing hard-coded.'],
              ['/screens/email-trace.png', 'Decision trace', 'Every email shows how the engine decided — read method, document type, fields, comparison.'],
              ['/screens/new-check.png', 'New check', 'Upload an SI and draft BL — PDF, Word, Excel, scan or phone photo — or import customer emails as .eml.'],
              ['/screens/activity.png', 'Audit trail', 'Every sign-in, check, review decision and setting change, with who and when.'],
            ].map(([src, title, sub]) => (
              <figure key={src} className="rounded-2xl overflow-hidden border border-white/10 bg-white/[.04] backdrop-blur group">
                <div className="relative aspect-[16/10] overflow-hidden bg-navy-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={title} className="absolute inset-0 w-full h-full object-cover object-top group-hover:scale-[1.02] transition-transform duration-500" loading="lazy"/>
                </div>
                <figcaption className="px-5 py-4">
                  <div className="text-[14px] font-bold text-white">{title}</div>
                  <div className="text-[12px] text-white/50 mt-0.5">{sub}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ================= tech ================= */}
      <section id="tech" className="py-20">
        <div className="max-w-6xl mx-auto px-4 lg:px-6">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <SectionTag>Under the hood</SectionTag>
              <h2 className="font-display text-[32px] sm:text-[38px] font-bold text-navy-900 tracking-tight mt-4">
                Full-stack, typed, and boring where it counts.
              </h2>
              <p className="text-slate-500 text-[15px] leading-relaxed mt-4">
                The verification engine deliberately keeps machine learning out of its decision path: shipping
                documents are structured enough that deterministic rules beat a black box on auditability — and the
                problem statement rewards knowing <i>when not to decide</i>. OCR reads the scans; a human confirms
                what OCR read.
              </p>
              <div className="mt-6 space-y-3">
                {TECH.map((t) => (
                  <div key={t.k} className="flex gap-3.5">
                    <span className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 text-brand-500 flex items-center justify-center shrink-0">
                      <Icon name="code" size={15}/>
                    </span>
                    <div>
                      <div className="text-[13.5px] font-bold text-ink-800">{t.k}</div>
                      <div className="text-[12.5px] text-slate-400 mt-0.5">{t.v}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-7">
              <div className="flex items-center gap-3">
                <LogoMark size={40}/>
                <div>
                  <div className="font-display text-[17px] font-bold text-navy-900">Run it yourself</div>
                  <div className="text-[12px] text-slate-400">One container on your own server — or two commands on a laptop.</div>
                </div>
              </div>
              <div className="mt-5 rounded-xl bg-navy-950 p-4 font-mono text-[12px] leading-relaxed text-white/80">
                <div><span className="text-aqua-300">$</span> docker compose up -d</div>
                <div className="text-emerald-300 mt-1">✓ admin account created · sample inbox loaded</div>
                <div className="text-white/40">→ http://localhost:3000</div>
              </div>
              <div className="mt-5 space-y-2.5 text-[12.5px] text-slate-500">
                {[
                  ['users', 'First boot creates an administrator; add your team with roles'],
                  ['database', 'A sample inbox for training — removable in one click'],
                  ['sparkles', 'Add an Anthropic API key to turn on AI reading for scans'],
                ].map(([ic, t]) => (
                  <div key={t} className="flex items-center gap-2.5">
                    <Icon name={ic} size={14} className="text-brand-500 shrink-0"/>{t}
                  </div>
                ))}
              </div>
              <Link href="/login" className="btn-primary w-full mt-6">Sign in <Icon name="arrowRight" size={15}/></Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================= footer ================= */}
      <footer className="border-t border-slate-100 bg-slate-50/60">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 py-12">
          <div className="flex flex-col md:flex-row md:items-center gap-8 justify-between">
            <div className="max-w-md">
              <Logo sub/>
              <p className="text-[12.5px] text-slate-400 mt-3 leading-relaxed">
                Verifies Shipping Instructions against draft Bills of Lading — from email inbox to discrepancy report,
                with a human in the loop for everything the engine cannot decide.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-12 gap-y-6 text-[13px]">
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-300 mb-3">Product</div>
                <div className="space-y-2">
                  <Link href="/login" className="block font-semibold text-slate-500 hover:text-brand-600 transition-colors">Console</Link>
                  <a href="#problem" className="block font-semibold text-slate-500 hover:text-brand-600 transition-colors">Problem</a>
                  <a href="#how" className="block font-semibold text-slate-500 hover:text-brand-600 transition-colors">How it works</a>
                </div>
              </div>
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-300 mb-3">Engine</div>
                <div className="space-y-2">
                  <a href="#features" className="block font-semibold text-slate-500 hover:text-brand-600 transition-colors">Features</a>
                  <a href="#tech" className="block font-semibold text-slate-500 hover:text-brand-600 transition-colors">Tech stack</a>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[11.5px] text-slate-400">
            <span>© 2026 CargoTrust AI · {PRODUCT_PLACEHOLDER.engine} · Documents · Intelligence · Trusted Decisions</span>
            <span className="font-mono">classify → extract → compare → decide → human</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

const PRODUCT_PLACEHOLDER = { engine: 'CargoTrust Engine v3.0' };
