export const PRODUCT = {
  name: 'CargoTrust',
  suffix: 'AI',
  tagline: 'AI Document Verification for Smarter Shipping',
  sub: 'Intelligent Shipping Document Verification',
  subShort: 'AI Document Verification',
  pillars: ['Documents', 'Intelligence', 'Trusted Decisions'],
};

export const CATEGORIES = {
  BL_COMPARISON: { label: 'Document check', color: '#2366AA', icon: 'gitCompare' },
  SI_REQUEST: { label: 'SI request', color: '#0E7871', icon: 'fileText' },
  INVOICE_QUERY: { label: 'Invoice query', color: '#7A5C1E', icon: 'receipt' },
  GENERAL: { label: 'General', color: '#4D6177', icon: 'mail' },
  SPAM: { label: 'Spam', color: '#9A3412', icon: 'alertTriangle' },
} as const;
export type Category = keyof typeof CATEGORIES;
export const CATEGORY_ORDER = Object.keys(CATEGORIES) as Category[];

/** Outcome of a document check. "Match" means the seven fields agree; it is not a statement about authenticity. */
export const STATUS = {
  OK: { label: 'Match', color: '#15803D', bg: '#EDF7F0', icon: 'checkCircle' },
  MISMATCH: { label: 'Discrepancy', color: '#B42318', bg: '#FDF0EE', icon: 'alertCircle' },
  NEEDS_REVIEW: { label: 'Needs review', color: '#B45309', bg: '#FDF5E7', icon: 'userCheck' },
} as const;
export type Status = keyof typeof STATUS;

export const REVIEW_REASONS = {
  wrong_doc_type: { label: 'Wrong document type', icon: 'files', color: '#B45309', bg: '#FDF5E7' },
  missing_attachment: { label: 'Missing attachment', icon: 'paperclip', color: '#B45309', bg: '#FDF5E7' },
  unreadable: { label: 'Unreadable or scanned', icon: 'scan', color: '#B45309', bg: '#FDF5E7' },
  missing_value: { label: 'Missing value', icon: 'helpCircle', color: '#B45309', bg: '#FDF5E7' },
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
