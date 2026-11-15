/**
 * Self-test suite — a labeled, synthetic evaluation set covering every
 * category, every decision path and every escalation reason. The dataset's
 * reference answers are private, so this suite is how the console measures
 * classification accuracy, defect precision/recall and escalation reliability
 * without them. Run it from Evaluation → Run self-test.
 */
import type { EvalCase } from '@/lib/types';

const si = (over: Record<string, string>) =>
  [
    'SHIPPING INSTRUCTION',
    '========================================',
    `Shipper/Exporter: ${over.shipper ?? 'APRIL FAR EAST (M) SDN BHD'}`,
    '  TOWER 2, AVENUE 5, LEVEL 6; BANGSAR SOUTH CITY, KUALA LUMPUR, MALAYSIA',
    `CONSIGNEE: ${over.consignee ?? 'MOORIM SP CO., LTD'}`,
    '  656, GANGNAM-DAERO, GANGNAM-GU; SEOUL, SOUTH KOREA',
    `NOTIFY PARTY: ${over.notify_party ?? 'UAB NOVAKOPA'}`,
    `Port of Loading: ${over.port_of_loading ?? 'PORT KLANG (WESTPORT), MALAYSIA (MYPKG)'}`,
    `Discharge Port: ${over.port_of_discharge ?? 'CALLAO, PERU (PECLL)'}`,
    `No. of Containers or Packages: ${over.container_count ?? "1 x 40'HC"}`,
    `Gross Weight (KG): ${over.gross_weight_kg ?? '21,577 KG'}`,
    'Vessel Name: MMSS 2507 V.257087E',
  ].join('\n');

const bl = (over: Record<string, string>, header = 'BILL OF LADING (DRAFT)') =>
  [
    header,
    '========================================',
    `SHIPPER: ${over.shipper ?? 'APRIL FAR EAST (M) SDN BHD'}`,
    '  TOWER 2, AVENUE 5, LEVEL 6; BANGSAR SOUTH CITY, KUALA LUMPUR, MALAYSIA',
    `CONSIGNEE: ${over.consignee ?? 'MOORIM SP CO., LTD'}`,
    '  656, GANGNAM-DAERO, GANGNAM-GU; SEOUL, SOUTH KOREA',
    `Notify: ${over.notify_party ?? 'UAB NOVAKOPA'}`,
    `Load Port: ${over.port_of_loading ?? 'PORT KLANG (WESTPORT), MALAYSIA (MYPKG)'}`,
    `POD: ${over.port_of_discharge ?? 'CALLAO, PERU (PECLL)'}`,
    `Container Count: ${over.container_count ?? "1 x 40'HC"}`,
    `Gross Wt (kgs): ${over.gross_weight_kg ?? '21,577 KG'}`,
    'Vessel Name: MMSS 2507 V.257087E',
  ].join('\n');

const docEmail = (id: string, subject: string, body: string, atts: string[]): EvalCase['record'] => ({
  email_id: id,
  from: 'ops@example.com',
  subject,
  body,
  attachments: atts,
});

export const SELF_TEST_CASES: EvalCase[] = [
  // ---- classification ----
  { id: 'st_001', expected: { category: 'BL_COMPARISON', status: 'OK' }, record: docEmail('st_001', 'TO CONFIRM DOCS _ 5RSG-00133', 'Attached are the SI and draft BL. Please check the details and confirm.', ['attachments/st_001_SI.txt', 'attachments/st_001_BL.txt']), texts: { 'attachments/st_001_SI.txt': si({}), 'attachments/st_001_BL.txt': bl({}) } },
  { id: 'st_002', expected: { category: 'INVOICE_QUERY', status: 'OK' }, record: docEmail('st_002', 'Invoice INV-88412 — detention charges', 'We received invoice INV-88412 with two days of detention charges. Could you clarify why free time was exceeded?', []), texts: {} },
  { id: 'st_003', expected: { category: 'SPAM', status: 'OK' }, record: docEmail('st_003', 'URGENT: Your shipment is being held', 'Dear customer, your container has been seized! Pay the release fee immediately via gift card to avoid forfeiture.', []), texts: {} },
  { id: 'st_004', expected: { category: 'GENERAL', status: 'OK' }, record: docEmail('st_004', 'Port congestion update — Week 38', 'Advisory: berth congestion continues. Vessels may experience delays. No action is required.', []), texts: {} },
  { id: 'st_005', expected: { category: 'SI_REQUEST', status: 'OK' }, record: docEmail('st_005', 'New SI for booking EGHJ3310455', 'Please find the completed Shipping Instruction for booking EGHJ3310455 attached. Kindly confirm receipt.', ['attachments/st_005_SI.txt']), texts: { 'attachments/st_005_SI.txt': si({}) } },
  { id: 'st_006', expected: { category: 'SPAM', status: 'OK' }, record: docEmail('st_006', 'Shipment delay — action required', 'Dear customer, click here to verify your account and avoid delivery suspension. Act now!', []), texts: {} },
  // ---- defect detection ----
  { id: 'st_010', expected: { category: 'BL_COMPARISON', status: 'MISMATCH', defect_fields: ['container_count'] }, record: docEmail('st_010', 'BL check request — booking 5RSG-00201', 'Please compare the SI and draft BL before release.', ['attachments/st_010_SI.txt', 'attachments/st_010_BL.txt']), texts: { 'attachments/st_010_SI.txt': si({ container_count: "3 x 40'HC" }), 'attachments/st_010_BL.txt': bl({ container_count: "4 x 40'HC" }) } },
  { id: 'st_011', expected: { category: 'BL_COMPARISON', status: 'MISMATCH', defect_fields: ['gross_weight_kg'] }, record: docEmail('st_011', 'Verify draft BL weights', 'The gross weight on the draft BL looks higher than the SI. Please run the comparison.', ['attachments/st_011_SI.txt', 'attachments/st_011_BL.txt']), texts: { 'attachments/st_011_SI.txt': si({}), 'attachments/st_011_BL.txt': bl({ gross_weight_kg: '24,850 KG' }) } },
  { id: 'st_012', expected: { category: 'BL_COMPARISON', status: 'MISMATCH', defect_fields: ['consignee'] }, record: docEmail('st_012', 'Draft BL consignee looks wrong', 'The consignee on the draft BL does not look like the entity on our SI. Please check.', ['attachments/st_012_SI.txt', 'attachments/st_012_BL.txt']), texts: { 'attachments/st_012_SI.txt': si({}), 'attachments/st_012_BL.txt': bl({ consignee: 'BRIGHTWAVE RETAIL GMBH' }) } },
  { id: 'st_013', expected: { category: 'BL_COMPARISON', status: 'MISMATCH', defect_fields: ['port_of_discharge'] }, record: docEmail('st_013', 'Discharge port discrepancy?', 'Our SI nominates Felixstowe but the draft BL shows Southampton. Please confirm.', ['attachments/st_013_SI.txt', 'attachments/st_013_BL.txt']), texts: { 'attachments/st_013_SI.txt': si({ port_of_discharge: 'FELIXSTOWE, GB (GBFXT)' }), 'attachments/st_013_BL.txt': bl({ port_of_discharge: 'SOUTHAMPTON, GB (GBSOU)' }) } },
  { id: 'st_014', expected: { category: 'BL_COMPARISON', status: 'MISMATCH', defect_fields: ['shipper', 'notify_party'] }, record: docEmail('st_014', 'SI vs draft BL — please verify', 'Second version of the documents attached. Please verify everything.', ['attachments/st_014_SI.txt', 'attachments/st_014_BL.txt']), texts: { 'attachments/st_014_SI.txt': si({ shipper: 'MERIDIAN TRADERS LTD', notify_party: 'PACIFIC RIM IMPORTS INC' }), 'attachments/st_014_BL.txt': bl({ shipper: 'MERIDIAN TRADING LTD', notify_party: 'PACIFIC RIM HOLDINGS GROUP' }) } },
  // ---- normalization (should match, not false-alarm) ----
  { id: 'st_020', expected: { category: 'BL_COMPARISON', status: 'OK' }, record: docEmail('st_020', 'BL check — label variants', 'Please compare. Note our system uses different field labels.', ['attachments/st_020_SI.txt', 'attachments/st_020_BL.txt']), texts: { 'attachments/st_020_SI.txt': si({ gross_weight_kg: '22 MT' }), 'attachments/st_020_BL.txt': bl({ gross_weight_kg: '22,000 KG' }) } },
  { id: 'st_021', expected: { category: 'BL_COMPARISON', status: 'OK' }, record: docEmail('st_021', 'Confirm docs — LOCODE vs name', 'Check the attached documents and confirm.', ['attachments/st_021_SI.txt', 'attachments/st_021_BL.txt']), texts: { 'attachments/st_021_SI.txt': si({ port_of_discharge: 'CALLAO, PERU (PECLL)' }), 'attachments/st_021_BL.txt': bl({ port_of_discharge: 'Callao, Peru' }) } },
  { id: 'st_022', expected: { category: 'BL_COMPARISON', status: 'OK' }, record: docEmail('st_022', 'Verify docs — legal suffix variants', 'Please verify the attached SI and draft BL.', ['attachments/st_022_SI.txt', 'attachments/st_022_BL.txt']), texts: { 'attachments/st_022_SI.txt': si({ consignee: 'MOORIM SP CO., LTD' }), 'attachments/st_022_BL.txt': bl({ consignee: 'MOORIM SP CO LTD' }) } },
  // ---- reliability / escalation ----
  { id: 'st_030', expected: { category: 'BL_COMPARISON', status: 'NEEDS_REVIEW', reason: 'missing_attachment' }, record: docEmail('st_030', 'BL check request (SI attached)', 'Please compare our SI with the draft BL once it is issued — only the SI made it into this email.', ['attachments/st_030_SI.txt']), texts: { 'attachments/st_030_SI.txt': si({}) } },
  { id: 'st_031', expected: { category: 'BL_COMPARISON', status: 'NEEDS_REVIEW', reason: 'unreadable' }, record: docEmail('st_031', 'Docs attached — please check', 'Attached are the SI and draft BL scans. Please verify.', ['attachments/st_031_SI.pdf', 'attachments/st_031_BL.pdf']), texts: { 'attachments/st_031_SI.pdf': null as never, 'attachments/st_031_BL.pdf': null as never } },
  { id: 'st_032', expected: { category: 'BL_COMPARISON', status: 'NEEDS_REVIEW', reason: 'missing_value' }, record: docEmail('st_032', 'SI vs BL — weight missing on our SI', 'Apologies — gross weight was not filled in on the SI. The draft BL states a figure.', ['attachments/st_032_SI.txt', 'attachments/st_032_BL.txt']), texts: { 'attachments/st_032_SI.txt': si({ gross_weight_kg: '—' }), 'attachments/st_032_BL.txt': bl({}) } },
  { id: 'st_033', expected: { category: 'BL_COMPARISON', status: 'NEEDS_REVIEW', reason: 'wrong_doc_type' }, record: docEmail('st_033', 'Please check the attached documents', 'Please check the attached documents for booking 4412.', ['attachments/st_033_SI.txt', 'attachments/st_033_BL.txt']), texts: { 'attachments/st_033_SI.txt': 'QUOTATION\n========\nOffer: 12 USD per cbm\nValid until: 2026-10-01\nThanks.', 'attachments/st_033_BL.txt': 'INTERNAL MEMO\nTransport planning meeting moved to Thursday.\nBring the rotation list.' } },
  // ---- misleading subject ----
  { id: 'st_040', expected: { category: 'BL_COMPARISON', status: 'OK' }, record: docEmail('st_040', 'URGENT: invoice question on booking', 'Apologies for the urgent flag. Attached the SI and draft BL — please confirm the details and invoice us as agreed.', ['attachments/st_040_SI.txt', 'attachments/st_040_BL.txt']), texts: { 'attachments/st_040_SI.txt': si({}), 'attachments/st_040_BL.txt': bl({}) } },
];
