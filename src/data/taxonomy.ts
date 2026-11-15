export const PRODUCT = {
  name: 'CargoTrust',
  suffix: 'AI',
  tagline: 'AI Document Verification for Smarter Shipping',
  sub: 'Intelligent Shipping Document Verification',
  subShort: 'AI Document Verification',
  pillars: ['Documents', 'Intelligence', 'Trusted Decisions'],
  engine: 'CargoTrust Engine v3.0',
};

export const CATEGORIES = {
  BL_COMPARISON: { label: 'BL Comparison', color: '#2563EB', icon: 'gitCompare' },
  SI_REQUEST: { label: 'SI Request', color: '#06B6D4', icon: 'fileText' },
  INVOICE_QUERY: { label: 'Invoice Query', color: '#8B5CF6', icon: 'receipt' },
  GENERAL: { label: 'General', color: '#10B981', icon: 'mail' },
  SPAM: { label: 'Spam', color: '#F59E0B', icon: 'alertTriangle' },
} as const;
export type Category = keyof typeof CATEGORIES;
export const CATEGORY_ORDER = Object.keys(CATEGORIES) as Category[];

export const STATUS = {
  OK: { label: 'OK', color: '#059669', bg: '#ECFDF5', icon: 'checkCircle' },
  MISMATCH: { label: 'Mismatch', color: '#DC2626', bg: '#FEF2F2', icon: 'xCircle' },
  NEEDS_REVIEW: { label: 'Needs review', color: '#D97706', bg: '#FFFBEB', icon: 'helpCircle' },
} as const;
export type Status = keyof typeof STATUS;

export const REVIEW_REASONS = {
  wrong_doc_type: { label: 'Wrong document type', icon: 'files', color: '#7C3AED', bg: '#F5F3FF' },
  missing_attachment: { label: 'Missing attachment', icon: 'paperclip', color: '#D97706', bg: '#FFFBEB' },
  unreadable: { label: 'Unreadable document', icon: 'scan', color: '#DC2626', bg: '#FEF2F2' },
  missing_value: { label: 'Missing required value', icon: 'helpCircle', color: '#2563EB', bg: '#EFF6FF' },
} as const;
export type ReviewReason = keyof typeof REVIEW_REASONS;

export const FIELDS = [
  { key: 'shipper', label: 'Shipper', icon: 'building' },
  { key: 'consignee', label: 'Consignee', icon: 'user' },
  { key: 'notify_party', label: 'Notify Party', icon: 'flag' },
  { key: 'port_of_loading', label: 'Port of Loading', icon: 'anchor' },
  { key: 'port_of_discharge', label: 'Port of Discharge', icon: 'mapPin' },
  { key: 'container_count', label: 'Container Count', icon: 'box' },
  { key: 'gross_weight_kg', label: 'Gross Weight', icon: 'scale' },
] as const;
export type FieldKey = (typeof FIELDS)[number]['key'];
export const FIELD_KEYS: FieldKey[] = FIELDS.map((f) => f.key);
export const fieldLabel = (key: string) => FIELDS.find((f) => f.key === key)?.label ?? key;
