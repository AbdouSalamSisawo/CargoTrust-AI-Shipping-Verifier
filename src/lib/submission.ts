/**
 * Builds a submission object in the exact shape of the SDOC
 * sample_submission.json — one entry per email, ready for POST /submit.
 */
import type { DBShape } from './types';

export interface SubmissionEntry {
  category: string;
  status: string;
  review_reason: string | null;
  defect_fields: string[];
  has_defect: boolean;
}

export function buildSubmission(db: DBShape): Record<string, SubmissionEntry> {
  const out: Record<string, SubmissionEntry> = {};
  for (const id of Object.keys(db.emails).sort()) {
    const e = db.emails[id];
    out[id] = {
      category: e.category,
      status: e.status,
      review_reason: e.reviewReason ?? null,
      defect_fields: e.defectFields,
      has_defect: e.hasDefect,
    };
  }
  return out;
}
