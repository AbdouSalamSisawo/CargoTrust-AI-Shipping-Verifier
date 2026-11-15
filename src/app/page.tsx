import Link from 'next/link';
import { Icon, Logo } from '@/components/icons';
import { PortScene } from '@/components/landing/PortScene';
import { HeroCheck } from '@/components/landing/HeroCheck';
import { Workflow } from '@/components/landing/Workflow';
import { FieldExplorer } from '@/components/landing/FieldExplorer';
import { ScanCompare } from '@/components/landing/ScanCompare';
import { ProductTour } from '@/components/landing/ProductTour';
import { LandingHeader } from '@/components/landing/LandingHeader';

function SectionHead({ eyebrow, title, intro, light = false, id }: { eyebrow: string; title: string; intro?: string; light?: boolean; id?: string }) {
  return (
    <div className="max-w-2xl">
      <div className={`eyebrow ${light ? 'text-aqua-300' : 'text-brand-600'}`}>{eyebrow}</div>
      <h2 id={id} className={`mt-3 font-display text-[30px] sm:text-[36px] leading-[1.1] font-semibold tracking-tight ${light ? 'text-white' : 'text-ink-900'}`}>{title}</h2>
      {intro && <p className={`mt-4 text-[15.5px] leading-relaxed ${light ? 'text-slate-300' : 'text-ink-600'}`}>{intro}</p>}
    </div>
  );
}

const COSTS = [
  { n: '01', t: 'Amendments after issue', d: 'Correcting a Bill of Lading once it is issued means amendment fees, new paperwork and delays for everyone downstream.' },
  { n: '02', t: 'Cargo held at destination', d: 'A consignee, port or weight that does not match the instructions can hold up customs clearance and release.' },
  { n: '03', t: 'Checking by eye', d: 'Documentation teams compare the same fields by hand, email after email, in PDFs, spreadsheets and scans.' },
];

const OUTCOMES = [
  { label: 'Match', color: '#3AAEA3', text: 'All seven fields agree between the Shipping Instruction and the draft Bill of Lading. A confirmation reply is drafted.' },
  { label: 'Discrepancy', color: '#F08A7E', text: 'One or more fields differ. The exact fields are listed with both values, and an amendment request is drafted.' },
  { label: 'Needs review', color: '#E5B567', text: 'A document is missing, unreadable, scanned, of the wrong type, or has a blank or placeholder value. A person decides.' },
];

const NOT_DONE = [
  'It does not certify that a document is authentic, legally valid or compliant. It checks that seven fields agree.',
  'The AI vision model only transcribes scans. It never decides whether documents match.',
  'It does not send email. Replies are drafted for a person to review and send.',
  'Anything uncertain is sent to the review queue instead of being guessed.',
];

export default function LandingPage() {
  return (
    <div className="bg-white text-ink-800">
      <LandingHeader/>

      {/* ============================== hero */}
      <section className="relative bg-navy-950 text-white overflow-hidden" aria-labelledby="hero-h">
        <div className="absolute inset-x-0 bottom-0 h-[62%] sm:h-[70%] pointer-events-none opacity-90">
          <PortScene className="w-full h-full"/>
        </div>
        <div className="relative max-w-6xl mx-auto px-4 lg:px-6 pt-28 pb-24 lg:pt-36 lg:pb-32 grid lg:grid-cols-[1.05fr_1fr] gap-12 items-center">
          <div>
            <div className="eyebrow text-aqua-300">Shipping document verification</div>
            <h1 id="hero-h" className="mt-4 font-display text-[40px] sm:text-[52px] leading-[1.04] font-semibold tracking-tight">
              Catch Bill of Lading errors before the BL is issued.
            </h1>
            <p className="mt-5 text-[16.5px] leading-relaxed text-slate-300 max-w-xl">
              CargoTrust AI compares each Shipping Instruction with its draft Bill of Lading, flags discrepancies in seven
              critical fields and drafts the amendment request. Anything it cannot read or decide goes to a person, with the
              evidence.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/login" className="btn bg-aqua-500 text-white hover:bg-aqua-600 px-5 py-2.5 text-[14.5px]">Sign in to the console<Icon name="arrowRight" size={16}/></Link>
              <a href="#workflow" className="btn text-white border border-white/25 hover:bg-white/10 px-5 py-2.5 text-[14.5px]">See how a check works</a>
            </div>
            <ul className="mt-10 grid sm:grid-cols-3 gap-4 max-w-xl text-[13px] text-slate-300">
              {[['fileText', 'PDF, Word, Excel, scans and photos'], ['database', 'Runs on your own server'], ['eye', 'Every value shows its source line']].map(([ic, t]) => (
                <li key={t} className="flex items-start gap-2"><Icon name={ic} size={15} className="text-aqua-300 shrink-0 mt-0.5"/>{t}</li>
              ))}
            </ul>
          </div>
          <div className="lg:pl-6">
            <HeroCheck/>
          </div>
        </div>
      </section>

      {/* ============================== the problem */}
      <section className="bg-[#F6F5F2] border-b border-[#E7E4DD]" aria-labelledby="problem-h">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 py-20 grid lg:grid-cols-[0.9fr_1.1fr] gap-12">
          <SectionHead id="problem-h" eyebrow="Why it matters" title="One wrong field on a Bill of Lading travels with the cargo."/>
          <ol className="divide-y divide-[#E2DED5]">
            {COSTS.map((c) => (
              <li key={c.n} className="py-5 first:pt-0 grid grid-cols-[48px_1fr] gap-4">
                <span className="font-mono text-[13px] text-amber-700 pt-1">{c.n}</span>
                <div>
                  <h3 className="text-[16px] font-semibold text-ink-900">{c.t}</h3>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-600">{c.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============================== workflow */}
      <section id="workflow" className="scroll-mt-16 bg-canvas" aria-labelledby="wf-h">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 py-20">
          <SectionHead id="wf-h" eyebrow="How it works" title="From the customer's email to a decision you can check." intro="Five steps run on every incoming document. Select a step to see what happens at that stage."/>
          <div className="mt-10"><Workflow/></div>
        </div>
      </section>

      {/* ============================== fields */}
      <section id="fields" className="scroll-mt-16 bg-white border-y border-line" aria-labelledby="fields-h">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 py-20">
          <SectionHead id="fields-h" eyebrow="What is checked" title="Seven fields, each with its own rule." intro="A single fuzzy match would miss the errors that matter. Each field is compared the way a documentation clerk would compare it, with the Shipping Instruction as the reference."/>
          <div className="mt-10"><FieldExplorer/></div>
        </div>
      </section>

      {/* ============================== scans */}
      <section id="scans" className="scroll-mt-16 bg-canvas" aria-labelledby="scans-h">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <SectionHead id="scans-h" eyebrow="Scans and photos" title="Paper documents are read, not guessed." intro="Scanned PDFs and phone photos have no text to copy. CargoTrust reads them with OCR and, if you enable it, with Claude's vision model."/>
            <ul className="mt-6 space-y-3.5 text-[14.5px] text-ink-700">
              {[
                'The model is instructed to copy exactly what is printed and to mark anything it cannot read.',
                'Its transcription goes through the same rule-based comparison as any other document.',
                'OCR runs alongside as an independent cross-check, and the console shows where the two agree.',
                'By default every scan still goes to a person, with the pre-check filled in.',
              ].map((t) => (
                <li key={t} className="flex gap-2.5"><Icon name="check" size={16} strokeWidth={2.4} className="text-aqua-600 shrink-0 mt-0.5"/>{t}</li>
              ))}
            </ul>
            <p className="mt-6 text-[13px] text-ink-400">AI reading is optional and needs an Anthropic API key. Without it, scans are read by OCR and always reviewed by a person.</p>
          </div>
          <ScanCompare/>
        </div>
      </section>

      {/* ============================== transparency */}
      <section id="trust" className="scroll-mt-16 bg-navy-950 text-white" aria-labelledby="trust-h">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 py-20">
          <SectionHead id="trust-h" light eyebrow="Transparency" title="Built to be checked, not trusted blindly." intro="Every result says what was compared, where each value came from, and who reviewed it."/>
          <div className="mt-12 grid lg:grid-cols-2 gap-10">
            <div>
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-400">Three possible outcomes</h3>
              <dl className="mt-4 divide-y divide-white/10 border-y border-white/10">
                {OUTCOMES.map((o) => (
                  <div key={o.label} className="py-4 grid grid-cols-[130px_1fr] gap-4">
                    <dt className="flex items-center gap-2 text-[14.5px] font-semibold"><span className="w-2 h-2 rounded-full" style={{ background: o.color }}/>{o.label}</dt>
                    <dd className="text-[14px] leading-relaxed text-slate-300">{o.text}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-400">What CargoTrust does not do</h3>
              <ul className="mt-4 space-y-3">
                {NOT_DONE.map((t) => (
                  <li key={t} className="flex gap-3 text-[14.5px] leading-relaxed text-slate-200">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" aria-hidden="true"/>{t}
                  </li>
                ))}
              </ul>
              <div className="mt-8 rounded-md border border-white/10 bg-white/[.04] p-4 text-[13.5px] text-slate-300 leading-relaxed">
                <span className="font-semibold text-white">Audit trail.</span> Sign-ins, checks, review decisions, exports and
                setting changes are logged with the person and the time, and every item keeps its own history.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== product tour */}
      <section id="product" className="scroll-mt-16 bg-navy-900 text-white" aria-labelledby="tour-h">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 py-20">
          <SectionHead id="tour-h" light eyebrow="The console" title="Designed for the documentation desk." intro="One place for incoming checks, the review queue, and the record of who decided what."/>
          <div className="mt-10"><ProductTour/></div>
        </div>
      </section>

      {/* ============================== results */}
      <section className="bg-white border-b border-line" aria-labelledby="results-h">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 py-20 grid lg:grid-cols-[0.8fr_1.2fr] gap-12">
          <div>
            <SectionHead id="results-h" eyebrow="Measured results" title="Tested on a public benchmark and on documents it had not seen."/>
            <p className="mt-4 text-[14px] leading-relaxed text-ink-500">
              The benchmark is synthetic data from a university hackathon. Results on a real inbox will depend on its
              document formats and label wording, which is why uncertain cases always go to review.
            </p>
          </div>
          <div>
            <dl className="grid sm:grid-cols-3 gap-px bg-line border border-line rounded-lg overflow-hidden">
              {[
                ['1.0000', 'Benchmark score', 'Averis × Monash 2026 dataset, 520 emails, graded by the organisers’ scorer'],
                ['46 of 46', 'Planted discrepancies found', 'Each on exactly the right field'],
                ['883 of 883', 'Rewritten documents handled', 'Harmless rewrites stayed clean; planted errors were caught'],
              ].map(([v, l, d]) => (
                <div key={l} className="bg-white p-5">
                  <dd className="text-[26px] font-semibold tabular-nums text-ink-900">{v}</dd>
                  <dt className="mt-1 text-[13.5px] font-medium text-ink-700">{l}</dt>
                  <dd className="mt-1.5 text-[12.5px] leading-snug text-ink-400">{d}</dd>
                </div>
              ))}
            </dl>
            <details className="mt-4 group">
              <summary className="cursor-pointer list-none text-[13.5px] font-medium text-brand-600 inline-flex items-center gap-1.5">
                <Icon name="chevronRight" size={14} className="transition-transform group-open:rotate-90"/>How these were measured
              </summary>
              <div className="mt-3 text-[13.5px] leading-relaxed text-ink-600 space-y-2 max-w-2xl">
                <p>The benchmark grader was used only as an overall scoreboard; the per-email answers were never read.</p>
                <p>For the robustness test, every SI and BL pair that matched was rewritten in 15 ways: relabelled fields, other units, other legal forms, swapped columns, and planted errors such as a changed weight digit or a port city swapped under the same code. Harmless rewrites must stay a match; planted errors must be flagged on exactly the planted field.</p>
              </div>
            </details>
          </div>
        </div>
      </section>

      {/* ============================== deployment */}
      <section id="deploy" className="scroll-mt-16 bg-[#F6F5F2]" aria-labelledby="deploy-h">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 py-20 grid lg:grid-cols-2 gap-12">
          <div>
            <SectionHead id="deploy-h" eyebrow="Security and deployment" title="Runs on your network. Your documents stay there."/>
            <ul className="mt-6 space-y-4 text-[14.5px] text-ink-700">
              {[
                ['database', 'One container and one data volume. Install it on a server inside your network, or on a laptop for a demonstration.'],
                ['lock', 'Passwords are hashed, sessions are signed, and repeated failed sign-ins are slowed down.'],
                ['users', 'Three roles: administrators manage users and settings, operators submit and review checks, viewers read results.'],
                ['send', 'The only outbound connection is the optional AI reading, which sends page images of scanned documents to Anthropic. Text files are read locally.'],
              ].map(([ic, t]) => (
                <li key={t} className="flex gap-3"><Icon name={ic} size={17} className="text-brand-600 shrink-0 mt-0.5"/>{t}</li>
              ))}
            </ul>
          </div>
          <div className="self-start rounded-lg bg-navy-950 text-slate-300 p-5 font-mono text-[12.5px] leading-relaxed overflow-x-auto">
            <div className="text-slate-500"># on the server</div>
            <div><span className="text-aqua-300">$</span> docker compose up -d --build</div>
            <div className="text-slate-500 mt-3"># first boot</div>
            <div>administrator account created</div>
            <div>sample inbox loaded (removable in Settings)</div>
            <div className="text-slate-500 mt-3"># optional: AI reading for scans</div>
            <div>ANTHROPIC_API_KEY=…</div>
          </div>
        </div>
      </section>

      {/* ============================== closing */}
      <section className="relative bg-navy-950 text-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 py-16 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="font-display text-[28px] font-semibold tracking-tight">See it with your own documents.</h2>
            <p className="mt-2 text-[15px] text-slate-300">Sign in, upload a Shipping Instruction and its draft BL, and review the result.</p>
          </div>
          <Link href="/login" className="btn bg-aqua-500 text-white hover:bg-aqua-600 px-5 py-2.5 text-[14.5px] self-start md:self-auto">Sign in<Icon name="arrowRight" size={16}/></Link>
        </div>
      </section>

      <footer className="bg-navy-950 border-t border-white/10 text-slate-400">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 py-10 flex flex-col md:flex-row md:items-start justify-between gap-8">
          <div className="max-w-sm">
            <Logo light/>
            <p className="mt-3 text-[13px] leading-relaxed">Compares Shipping Instructions with draft Bills of Lading and sends anything uncertain to a person.</p>
          </div>
          <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-[13.5px]" aria-label="Footer">
            <a href="#workflow" className="hover:text-white">How it works</a>
            <a href="#trust" className="hover:text-white">Transparency</a>
            <a href="#fields" className="hover:text-white">What is checked</a>
            <a href="#deploy" className="hover:text-white">Deployment</a>
            <a href="#scans" className="hover:text-white">Scans</a>
            <Link href="/login" className="hover:text-white">Sign in</Link>
          </nav>
        </div>
        <div className="max-w-6xl mx-auto px-4 lg:px-6 py-5 border-t border-white/10 flex flex-wrap justify-between gap-2 text-[12px] text-slate-500">
          <span>© 2026 CargoTrust AI</span>
          <span>Version 1, in active development</span>
        </div>
      </footer>
    </div>
  );
}
