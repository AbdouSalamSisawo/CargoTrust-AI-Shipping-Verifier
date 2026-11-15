import type { Category, Status, ReviewReason, FieldKey } from '@/data/taxonomy';

/* Raw inbox record, exactly as shipped in the SDOC participant bundle. */
export interface EmailRecord {
  email_id: string;
  from: string;
  subject: string;
  body: string;
  attachments: string[];
}

/* Result of parsing one document (SI or BL) into the 7 canonical fields. */
export interface ExtractedDoc {
  found: Record<FieldKey, boolean>;
  values: Partial<Record<FieldKey, string>>;
  raw: Partial<Record<FieldKey, string>>;
  lines: Partial<Record<FieldKey, string>>;
  missing: FieldKey[];
  completeness: number;
  docKind?: 'SI' | 'BL';
}

export interface FieldRow {
  field: FieldKey;
  label: string;
  si: string | null;
  bl: string | null;
  match: boolean | null;
  evidence: { si?: string; bl?: string };
}

export interface AttachmentInfo {
  path: string;
  name: string;
  ext: string;
  kind: 'SI' | 'BL' | 'other';
  readable: boolean;
  size: number;
}

export interface ProcessedEmail {
  id: string;
  from: string;
  subject: string;
  body: string;
  category: Category;
  categoryScores?: Record<string, number>;
  signals?: string[];
  /** For document emails: did the sender ask us to compare, or ask for a draft BL? */
  docIntent?: 'compare' | 'request_document' | 'none';
  /** Which component made the category decision. */
  decidedBy?: 'rule' | 'llm' | 'human';
  /** Document thread with no SI/BL yet — tracked, not escalated. */
  awaitingDocuments?: boolean;
  confidence: number;
  status: Status;
  defectFields: FieldKey[];
  hasDefect: boolean;
  reviewReason: ReviewReason | null;
  summary: string;
  attachments: AttachmentInfo[];
  extracted?: { si: ExtractedDoc; bl: ExtractedDoc };
  comparison?: { rows: FieldRow[]; matchedFields: FieldKey[]; defectFields: FieldKey[] };
  reviewed?: { action: 'approve' | 'correct' | 'reject'; note?: string } | null;
  seq: number;
}

export interface ReviewCase {
  id: string;
  emailId: string;
  reason: ReviewReason;
  summary: string;
  suggestion: string;
  evidence: { doc: 'SI' | 'BL'; tone: 'ok' | 'warn' | 'bad'; lines: string[] }[];
  editFields: { field: FieldKey; label: string; si: string | null; bl: string | null }[];
  status: 'open' | 'resolved';
  resolution?: { action: 'approve' | 'correct' | 'reject'; note?: string; updatedStatus?: Status };
}

export interface Settings {
  autoApproveThreshold: number;
  spamFilter: boolean;
  requireEvidence: boolean;
  notifyOnMismatch: boolean;
  notifyOnReview: boolean;
  digest: boolean;
  sdocServerUrl: string;
}

export interface EvalCase {
  id: string;
  expected: { category: Category; status: Status; defect_fields?: FieldKey[]; reason?: ReviewReason | null };
  record: EmailRecord;
  texts: Record<string, string>;
}

export interface EvalRun {
  id: string;
  at: string;
  version: string;
  total: number;
  classification: { correct: number; accuracy: number; perCategory: { cat: string; total: number; correct: number }[] };
  decision: { tp: number; fp: number; fn: number; tn: number; precision: number; recall: number; f1: number; accuracy: number };
  defect: { tp: number; fp: number; fn: number; precision: number; recall: number; f1: number };
  escalation: { correct: number; total: number; missed: number; falseAlarms: number };
  endToEnd: { correct: number; total: number };
}

export interface DBShape {
  version: number;
  settings: Settings;
  emails: Record<string, ProcessedEmail>;
  reviews: Record<string, ReviewCase>;
  evalRuns: EvalRun[];
}
