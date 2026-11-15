/**
 * Aggregations for the dashboard + the self-test evaluation runner.
 * Every number shown in the console is computed from processed data, never
 * hard-coded.
 */
import { CATEGORY_ORDER, FIELDS, type Category, type FieldKey, type Status } from '@/data/taxonomy';
import type { DBShape, EvalRun, ProcessedEmail } from './types';
import { processEmail } from './engine/pipeline';
import { SELF_TEST_CASES } from './engine/selftest';

export interface DashboardMetrics {
  total: number;
  byCategory: { cat: Category; label: string; color: string; count: number; pct: number }[];
  byStatus: Record<Status, number>;
  docChecks: number;
  matches: number;
  mismatches: number;
  needsReview: number;
  reviewOpen: number;
  reviewResolved: number;
  defectHist: { field: FieldKey; label: string; count: number }[];
  autoResolvedPct: number;
  extractionCoveragePct: number;
  avgConfidence: number;
  pipeline: { icon: string; label: string; stat: string; sub: string }[];
  feed: { id: string; subject: string; from: string; status: Status; category: Category; defectCount: number }[];
  attention: { id: string; subject: string; from: string; status: Status; reason?: string | null }[];
  kpis: { icon: string; label: string; value: number; note: string; tone: 'good' | 'bad' | 'neutral' }[];
}

const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 1000) / 10);

export function computeMetrics(db: DBShape): DashboardMetrics {
  const emails = Object.values(db.emails);
  const total = emails.length;
  const catCounts = new Map<Category, number>();
  for (const c of CATEGORY_ORDER) catCounts.set(c, 0);
  const statusCounts: Record<Status, number> = { OK: 0, MISMATCH: 0, NEEDS_REVIEW: 0 };
  for (const e of emails) {
    catCounts.set(e.category, (catCounts.get(e.category) ?? 0) + 1);
    statusCounts[e.status] = (statusCounts[e.status] ?? 0) + 1;
  }
  const docChecks = emails.filter((e) => e.category === 'BL_COMPARISON');
  const matches = docChecks.filter((e) => e.status === 'OK').length;
  const mismatches = docChecks.filter((e) => e.status === 'MISMATCH').length;
  const needsReview = docChecks.filter((e) => e.status === 'NEEDS_REVIEW').length;

  const cases = Object.values(db.reviews);
  const reviewOpen = cases.filter((r) => r.status === 'open').length;
  const reviewResolved = cases.filter((r) => r.status === 'resolved').length;

  const defectMap = new Map<FieldKey, number>();
  for (const e of docChecks) for (const f of e.defectFields) defectMap.set(f, (defectMap.get(f) ?? 0) + 1);
  const defectHist = FIELDS.map((f) => ({ field: f.key, label: f.label, count: defectMap.get(f.key) ?? 0 }))
    .sort((a, b) => b.count - a.count);

  const decided = matches + mismatches;
  const fullyExtracted = docChecks.filter((e) => e.extracted && e.extracted.si.completeness === 1 && e.extracted.bl.completeness === 1).length;
  const avgConfidence = total ? emails.reduce((s, e) => s + e.confidence, 0) / total : 0;
  const avgConfidencePct = Math.round(avgConfidence * 1000) / 10;

  const attention = emails
    .filter((e) => e.status === 'MISMATCH' || e.status === 'NEEDS_REVIEW')
    .sort((a, b) => b.seq - a.seq)
    .slice(0, 6)
    .map((e) => ({ id: e.id, subject: e.subject, from: e.from, status: e.status, reason: e.reviewReason ?? null }));

  return {
    total,
    byCategory: CATEGORY_ORDER.map((c) => ({
      cat: c,
      label: c.replace(/_/g, ' '),
      color: { BL_COMPARISON: '#2563EB', SI_REQUEST: '#06B6D4', INVOICE_QUERY: '#8B5CF6', GENERAL: '#10B981', SPAM: '#F59E0B' }[c],
      count: catCounts.get(c) ?? 0,
      pct: pct(catCounts.get(c) ?? 0, total),
    })),
    byStatus: statusCounts,
    docChecks: docChecks.length,
    matches,
    mismatches,
    needsReview,
    reviewOpen,
    reviewResolved,
    defectHist,
    autoResolvedPct: pct(decided, docChecks.length),
    extractionCoveragePct: pct(fullyExtracted, docChecks.length),
    avgConfidence: avgConfidencePct,
    pipeline: [
      { icon: 'inbox', label: 'Receive', stat: String(total), sub: 'emails ingested' },
      { icon: 'sparkles', label: 'Classify', stat: `${avgConfidencePct.toFixed(1)}%`, sub: 'avg confidence' },
      { icon: 'scan', label: 'Extract', stat: String(docChecks.length), sub: 'SI/BL pairs parsed' },
      { icon: 'gitCompare', label: 'Compare', stat: String(decided), sub: '7-field checks run' },
      { icon: 'shieldCheck', label: 'Decide', stat: `${pct(decided, docChecks.length)}%`, sub: 'auto-resolved' },
    ],
    attention,
    feed: emails
      .slice()
      .sort((a, b) => b.seq - a.seq)
      .slice(0, 10)
      .map((e) => ({ id: e.id, subject: e.subject, from: e.from, status: e.status, category: e.category, defectCount: e.defectFields.length })),
    kpis: [
      { icon: 'inbox', label: 'Total Emails', value: total, note: 'in processed inbox', tone: 'neutral' },
      { icon: 'gitCompare', label: 'BL Comparisons', value: docChecks.length, note: 'document-check requests', tone: 'neutral' },
      { icon: 'checkCircle', label: 'Clean Matches', value: matches, note: `${pct(matches, docChecks.length)}% of checks`, tone: 'good' },
      { icon: 'alertTriangle', label: 'Defects Caught', value: docChecks.reduce((s, e) => s + e.defectFields.length, 0), note: `${mismatches} emails flagged`, tone: 'bad' },
      { icon: 'userCheck', label: 'Human Reviews', value: reviewOpen, note: `${reviewResolved} resolved`, tone: 'neutral' },
    ],
  };
}

/* ================= self-test evaluation ================= */

const f1Of = (tp: number, fp: number, fn: number) => {
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1 };
};

export function runSelfTest(version: string): EvalRun {
  let classCorrect = 0;
  const perCat = new Map<string, { total: number; correct: number }>();
  let dtp = 0, dfp = 0, dfn = 0, dtn = 0;
  let ptp = 0, pfp = 0, pfn = 0;
  let escCorrect = 0, escTotal = 0, escMissed = 0, escFalse = 0;
  let e2e = 0;

  for (const c of SELF_TEST_CASES) {
    const got = processEmail(c.record, c.texts);
    const exp = c.expected;

    const pc = perCat.get(exp.category) ?? { total: 0, correct: 0 };
    pc.total++;
    if (got.category === exp.category) {
      pc.correct++;
      classCorrect++;
    }
    perCat.set(exp.category, pc);

    const expDefect = exp.status === 'MISMATCH';
    const gotDefect = got.status === 'MISMATCH';
    if (expDefect && gotDefect) dtp++;
    else if (gotDefect && !expDefect) dfp++;
    else if (expDefect && !gotDefect) dfn++;
    else dtn++;

    const expFields = (exp.defect_fields ?? []).slice().sort();
    const gotFields = got.defectFields.slice().sort();
    if (expDefect && gotDefect) {
      const expSet = new Set(expFields);
      for (const f of gotFields) if (expSet.has(f)) ptp++; else pfp++;
      for (const f of expFields) if (!gotFields.includes(f)) pfn++;
    } else if (gotDefect && !expDefect) {
      pfp += gotFields.length;
    } else if (expDefect && !gotDefect) {
      pfn += expFields.length;
    }

    if (exp.status === 'NEEDS_REVIEW') {
      escTotal++;
      if (got.status === 'NEEDS_REVIEW') escCorrect++;
      else escMissed++;
    } else if (got.status === 'NEEDS_REVIEW') {
      escFalse++;
    }

    const fieldsOk = JSON.stringify(gotFields) === JSON.stringify(expFields);
    if (got.category === exp.category && got.status === exp.status && (!expDefect || fieldsOk)) e2e++;
  }

  const total = SELF_TEST_CASES.length;
  const dec = f1Of(dtp, dfp, dfn);
  const def = f1Of(ptp, pfp, pfn);
  const decisionAccuracy = (dtp + dtn) / total;

  return {
    id: 'run-' + Date.now().toString(36),
    at: new Date().toISOString(),
    version,
    total,
    classification: {
      correct: classCorrect,
      accuracy: classCorrect / total,
      perCategory: [...perCat.entries()].map(([cat, v]) => ({ cat, ...v })),
    },
    decision: {
      tp: dtp, fp: dfp, fn: dfn, tn: dtn,
      precision: dec.precision, recall: dec.recall, f1: dec.f1, accuracy: decisionAccuracy,
    },
    defect: { tp: ptp, fp: pfp, fn: pfn, precision: def.precision, recall: def.recall, f1: def.f1 },
    escalation: { correct: escCorrect, total: escTotal, missed: escMissed, falseAlarms: escFalse },
    endToEnd: { correct: e2e, total },
  };
}
