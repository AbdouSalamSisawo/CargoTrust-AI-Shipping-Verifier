import type { Category, Status, ReviewReason, FieldKey } from '@/data/taxonomy';

/* Raw inbox record, exactly as shipped in the SDOC participant bundle. */
export interface EmailRecord {
  email_id: string;
  from: string;
  subject: string;
  body: string;
  attachments: string[];
  /** SI / BL assignment for attachments whose file name does not say (set by upload or content detection). */
  attachmentKinds?: Record<string, 'SI' | 'BL'>;
  /** When the email (or upload) was received, ISO 8601. */
  receivedAt?: string;
}

export type Role = 'admin' | 'operator' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** scrypt$<salt>$<hash> */
  passwordHash: string;
  active: boolean;
  mustChangePassword?: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

/** What the browser is allowed to know about a user. */
export type PublicUser = Omit<User, 'passwordHash'>;

export interface AuditEvent {
  id: string;
  at: string;
  userId: string | null;
  userName: string;
  action: string;
  target?: string;
  detail?: string;
}

/** Result of the AI vision read of a scanned document. */
export interface AiRead {
  model: string;
  /** Fields the AI marked as hard to read on the scan. */
  unclear: string[];
  /** Per-field agreement between the AI read and the OCR read (null = OCR found nothing to compare). */
  agreement?: Partial<Record<FieldKey, boolean | null>>;
  error?: string;
}

/* Result of parsing one document (SI or BL) into the 7 canonical fields. */
export interface ExtractedDoc {
  found: Record<FieldKey, boolean>;
  values: Partial<Record<FieldKey, string>>;
  raw: Partial<Record<FieldKey, string>>;
  lines: Partial<Record<FieldKey, string>>;
  missing: FieldKey[];
  /** Fields whose value is a placeholder ("TBA", "____") rather than data. */
  placeholders?: Partial<Record<FieldKey, string>>;
  /** Fields derived rather than read from a label (e.g. counted from the container table). */
  derived?: Partial<Record<FieldKey, string>>;
  completeness: number;
  docKind?: 'SI' | 'BL';
  /** What the content says it is (SI, BL, INVOICE, PACKING_LIST, CERTIFICATE, UNKNOWN). */
  detectedKind?: string;
  /** How the text was obtained: text, pdf-text, pdf-ocr, docx, xlsx. */
  method?: string;
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
  /** How the attachment was read: text, pdf-text, pdf-ocr, docx, xlsx, none. */
  method?: string;
  ocrConfidence?: number;
  /** Why it could not be read. */
  error?: string;
  /** Present when the scan was read by the AI vision model. */
  ai?: AiRead;
}

export interface ProcessedEmail {
  id: string;
  /** Where the email came from: the bundled sample set, a direct document upload, or an imported .eml. */
  source?: 'sample' | 'upload' | 'email';
  receivedAt?: string;
  /** User who uploaded / imported it. */
  createdBy?: string;
  /** Message-ID of an imported email (duplicate detection). */
  messageId?: string;
  /** True when at least one document was read by the AI vision model. */
  aiRead?: boolean;
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
  /** Extra observations shown to the reviewer (e.g. swapped attachments). */
  notes?: string[];
  confidence: number;
  status: Status;
  defectFields: FieldKey[];
  hasDefect: boolean;
  reviewReason: ReviewReason | null;
  summary: string;
  attachments: AttachmentInfo[];
  extracted?: { si: ExtractedDoc; bl: ExtractedDoc };
  comparison?: { rows: FieldRow[]; matchedFields: FieldKey[]; defectFields: FieldKey[] };
  reviewed?: { action: 'approve' | 'correct' | 'reject'; note?: string; by?: string; at?: string } | null;
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
  resolution?: { action: 'approve' | 'correct' | 'reject'; note?: string; updatedStatus?: Status; by?: string; at?: string };
}

export interface Settings {
  autoApproveThreshold: number;
  spamFilter: boolean;
  requireEvidence: boolean;
  notifyOnMismatch: boolean;
  notifyOnReview: boolean;
  digest: boolean;
  /** Organisation name shown in the console and on drafted replies. */
  organisation: string;
  /** Read scanned documents with the AI vision model (needs an Anthropic API key). */
  aiEnabled: boolean;
  /** Key stored from the Settings page; ANTHROPIC_API_KEY in the environment takes precedence. */
  aiApiKey?: string;
  aiModel: string;
  /** confirm: AI-read scans still go to a human; auto: decide automatically when the AI read is complete and clear. */
  aiScanPolicy: 'confirm' | 'auto';
  /** Session signing key when AUTH_SECRET is not set and storage is Postgres (never sent to the browser). */
  authSecret?: string;
  /** Legacy (hackathon scoring server). */
  sdocServerUrl?: string;
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
  users: Record<string, User>;
  audit: AuditEvent[];
  /** Whether the bundled sample inbox is loaded into the workspace. */
  sampleData: boolean;
}
