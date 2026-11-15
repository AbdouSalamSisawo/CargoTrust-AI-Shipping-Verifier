/**
 * AI reading for scans and photos.
 *
 * Tesseract OCR struggles with degraded scans (skew, speckle, low resolution)
 * and phone photos of paper Bills of Lading. When an Anthropic API key is
 * configured, the page images are also sent to Claude's vision model, which
 * transcribes the document into the same canonical layout every other reader
 * produces ("Label: value", indented continuation lines, " | " table rows).
 *
 * The model is a *reader*, not a decision maker: it is told to transcribe
 * exactly what is printed — never to correct, normalise or complete a value —
 * and to mark anything it cannot read. The transcription then goes through the
 * same deterministic extractor and comparator as a text PDF, and the OCR read
 * is kept as an independent cross-check.
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { scanPageImages } from './readers';

export interface AiConfig {
  apiKey: string;
  model: string;
}

export const DEFAULT_AI_MODEL = 'claude-opus-5-5';

const Transcription = z.object({
  document_type: z.enum(['shipping_instruction', 'bill_of_lading', 'invoice', 'packing_list', 'certificate', 'other']),
  transcription: z.string(),
  unclear_fields: z.array(z.string()),
});

const SYSTEM = `You transcribe scanned shipping documents (Shipping Instructions, draft Bills of Lading) for an automated verification system. Your transcription is compared field by field against another document, so fidelity matters more than tidiness.

Write the transcription in this layout:
- One "Label: value" line per labelled field, using the label exactly as printed (for example "Shipper:", "Port of Loading:", "Gross Weight:").
- When a value spans several lines (company name then address lines), put the first line after the label and each further line on its own line indented by two spaces.
- A label with no value is written with nothing after the colon.
- Tables (containers, packages, marks and numbers) are written row by row, cells separated by " | ", header row first.
- Headings and free text are written as plain lines.

Transcribe exactly what is printed. Do not correct spelling, expand abbreviations, convert units, reformat numbers or fill in anything that is not on the page: a discrepancy in the original is exactly what the system needs to see. Where characters cannot be read with confidence, write [?] in their place, and list the label of every field containing [?] in unclear_fields.`;

export async function transcribeScan(buf: Buffer, ext: string, cfg: AiConfig): Promise<{ text: string | null; unclear: string[]; documentType?: string; error?: string }> {
  const pages = await scanPageImages(buf, ext);
  if (!pages.length) return { text: null, unclear: [], error: 'no page images could be produced' };

  const client = new Anthropic({ apiKey: cfg.apiKey, maxRetries: 2, timeout: 120_000 });
  try {
    const res = await client.beta.messages.parse({
      model: cfg.model,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(Transcription) },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            ...pages.map((p) => ({
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: p.mediaType, data: p.data.toString('base64') },
            })),
            { type: 'text' as const, text: `Transcribe this document (${pages.length} page${pages.length > 1 ? 's' : ''}).` },
          ],
        },
      ],
    });
    if (res.stop_reason === 'refusal') return { text: null, unclear: [], error: 'the model declined to read this document' };
    if (res.stop_reason === 'max_tokens') return { text: null, unclear: [], error: 'the transcription was cut off (document too long)' };
    const out = res.parsed_output;
    if (!out || !out.transcription.trim()) return { text: null, unclear: [], error: 'the model returned no transcription' };
    return {
      text: out.transcription.replace(/\r\n?/g, '\n').trim(),
      unclear: out.unclear_fields,
      documentType: out.document_type,
    };
  } catch (e) {
    let msg: string;
    if (e instanceof Anthropic.AuthenticationError) msg = 'the Anthropic API key was rejected';
    else if (e instanceof Anthropic.PermissionDeniedError) msg = 'the API key has no access to this model';
    else if (e instanceof Anthropic.NotFoundError) msg = `model "${cfg.model}" was not found`;
    else if (e instanceof Anthropic.RateLimitError) msg = 'rate limited by the Anthropic API, try again shortly';
    else if (e instanceof Anthropic.APIConnectionError) msg = 'could not reach the Anthropic API (network)';
    else if (e instanceof Anthropic.APIError) msg = `Anthropic API error ${e.status ?? ''}`.trim();
    else msg = e instanceof Error ? e.message : String(e);
    return { text: null, unclear: [], error: msg };
  }
}

/** One cheap call to confirm a key and model work (Settings → "Test connection"). */
export async function testAiConnection(cfg: AiConfig): Promise<{ ok: boolean; error?: string }> {
  const client = new Anthropic({ apiKey: cfg.apiKey, maxRetries: 0, timeout: 30_000 });
  try {
    await client.models.retrieve(cfg.model);
    return { ok: true };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, error: 'The API key was rejected.' };
    if (e instanceof Anthropic.NotFoundError) return { ok: false, error: `Model "${cfg.model}" was not found for this key.` };
    if (e instanceof Anthropic.APIConnectionError) return { ok: false, error: 'Could not reach api.anthropic.com from the server.' };
    if (e instanceof Anthropic.APIError) return { ok: false, error: `Anthropic API error ${e.status ?? ''}: ${e.message}` };
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
