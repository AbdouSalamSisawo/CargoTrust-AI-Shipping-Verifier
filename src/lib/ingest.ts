/**
 * Getting new work into the system:
 *   - a direct upload of an SI and a draft BL (the "New check" screen)
 *   - imported emails (.eml files saved from Outlook, Gmail, Thunderbird …)
 *
 * Files are stored under data/uploads/<case id>/, run through the same
 * pipeline as everything else and saved as an inbox item.
 */
import { simpleParser } from 'mailparser';
import { getDB, mutate, runPipeline, upsertEmail, audit, newCaseId } from './store';
import { saveUpload, deleteUploads } from './dataset';
import type { EmailRecord, ProcessedEmail, User } from './types';

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const DOC_EXTS = ['pdf', 'docx', 'xlsx', 'txt', 'png', 'jpg', 'jpeg', 'webp'];

export const extOf = (name: string) => (name.split('.').pop() || '').toLowerCase();

export interface UploadInput {
  si: { name: string; buf: Buffer } | null;
  bl: { name: string; buf: Buffer } | null;
  reference?: string;
  from?: string;
  note?: string;
}

export async function ingestUpload(input: UploadInput, user: User): Promise<ProcessedEmail> {
  const db = await getDB();
  const id = newCaseId(db);
  const attachments: string[] = [];
  const kinds: Record<string, 'SI' | 'BL'> = {};
  try {
    for (const side of ['si', 'bl'] as const) {
      const f = input[side];
      if (!f) continue;
      const p = await saveUpload(id, f.name, f.buf);
      attachments.push(p);
      kinds[p] = side === 'si' ? 'SI' : 'BL';
    }
    const ref = input.reference?.trim();
    const rec: EmailRecord = {
      email_id: id,
      from: input.from?.trim() || user.email,
      subject: ref ? `Document check: ${ref}` : 'Document check: SI and draft BL',
      body: 'Please check the attached Shipping Instruction against the draft Bill of Lading and revert with any discrepancy.',
      attachments,
      attachmentKinds: kinds,
      receivedAt: new Date().toISOString(),
    };
    const email = await runPipeline(rec, db.settings);
    // A direct upload is always a document check, whatever the classifier makes of the boilerplate.
    email.source = 'upload';
    email.createdBy = user.name;
    if (input.note?.trim()) email.notes = [`Uploader's note: ${input.note.trim()}`, ...(email.notes ?? [])];
    await mutate((d) => {
      upsertEmail(d, email);
      audit(d, user, 'check.uploaded', id, `${attachments.length} document(s) → ${email.status}`);
    });
    return email;
  } catch (e) {
    await deleteUploads(id);
    throw e;
  }
}

export interface EmlResult {
  file: string;
  id?: string;
  status?: string;
  duplicate?: boolean;
  error?: string;
}

/** Import one .eml file. Duplicate Message-IDs are skipped. */
export async function ingestEml(file: string, buf: Buffer, user: User): Promise<EmlResult> {
  let parsed;
  try {
    parsed = await simpleParser(buf);
  } catch {
    return { file, error: 'not a valid email file' };
  }
  const messageId = parsed.messageId?.trim();
  const db = await getDB();
  if (messageId) {
    const dup = Object.values(db.emails).find((e) => e.messageId === messageId);
    if (dup) return { file, id: dup.id, status: dup.status, duplicate: true };
  }
  const id = newCaseId(db);
  const attachments: string[] = [];
  try {
    for (const a of parsed.attachments ?? []) {
      const name = a.filename || `attachment.${(a.contentType || '').split('/').pop() || 'bin'}`;
      if (!DOC_EXTS.includes(extOf(name))) continue;
      // skip signature logos and other small inline images
      if (a.contentDisposition === 'inline' && a.contentType?.startsWith('image/') && a.size < 60_000) continue;
      if (a.size > MAX_FILE_BYTES) continue;
      attachments.push(await saveUpload(id, name, a.content));
    }
    const fromAddr = parsed.from?.value?.[0];
    const rec: EmailRecord = {
      email_id: id,
      from: fromAddr?.address || parsed.from?.text || 'unknown sender',
      subject: parsed.subject || '(no subject)',
      body: (parsed.text || '').trim(),
      attachments,
      receivedAt: (parsed.date ?? new Date()).toISOString(),
    };
    const email = await runPipeline(rec, db.settings);
    email.source = 'email';
    email.createdBy = user.name;
    email.messageId = messageId;
    await mutate((d) => {
      upsertEmail(d, email);
      audit(d, user, 'email.imported', id, `${rec.subject} → ${email.category}${email.category === 'BL_COMPARISON' ? ` / ${email.status}` : ''}`);
    });
    return { file, id, status: email.status };
  } catch (e) {
    await deleteUploads(id);
    return { file, error: e instanceof Error ? e.message : 'import failed' };
  }
}
