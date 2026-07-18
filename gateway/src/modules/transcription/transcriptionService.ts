import type { VerifiedUser } from '../../auth/verifyPocketBaseToken.js';
import type { AudioStorage } from './audioStorage.js';
import { normalizeTranscript, supportedAudioMimeTypes, transcriptionInputSchema } from './transcriptionSchema.js';

export interface TranscriptionAdapter {
  transcribe(input: { bytes: Buffer; mimeType: string; locale: 'uk-UA' }): Promise<string>;
}

export function createGeminiTranscriptionAdapter(options: { apiKey?: string; model?: string; timeoutMs?: number; fetcher?: typeof fetch }): TranscriptionAdapter {
  const key = options.apiKey?.trim();
  const model = options.model?.trim() || 'gemini-2.5-flash';
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = Math.min(Math.max(Math.floor(options.timeoutMs ?? 20_000), 500), 60_000);
  return {
    async transcribe(input) {
      if (!key) throw new Error('Transcription provider is not configured');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST', signal: controller.signal,
          headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [
            { inlineData: { mimeType: input.mimeType, data: input.bytes.toString('base64') } },
            { text: 'Точно транскрибуй цей український аудіозапис. Поверни лише текст транскрипту без пояснень.' },
          ] }], generationConfig: { temperature: 0 } }),
        });
        if (!response.ok) throw new Error('Transcription provider request failed');
        const body = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> };
        const text = body.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text;
        if (typeof text !== 'string' || text.length > 100_000) throw new Error('Transcription provider returned no text');
        return text;
      } finally { clearTimeout(timer); }
    },
  };
}

export class TranscriptionValidationError extends Error { readonly code = 'INVALID_AUDIO'; }
export class TranscriptionUnavailableError extends Error { readonly code = 'TRANSCRIPTION_UNAVAILABLE'; }
export interface TranscriptionService {
  transcribe(user: VerifiedUser, input: unknown): Promise<{ transcript: string; locale: 'uk-UA' }>;
}

export function createTranscriptionService(adapter: TranscriptionAdapter, storage: AudioStorage, options: { maxBytes?: number; maxDurationSeconds?: number; maxTextLength?: number } = {}): TranscriptionService {
  const maxBytes = Math.min(Math.max(Math.floor(options.maxBytes ?? 15_000_000), 1), 25_000_000);
  const maxDurationSeconds = Math.min(Math.max(Math.floor(options.maxDurationSeconds ?? 180), 1), 600);
  const maxTextLength = Math.min(Math.max(Math.floor(options.maxTextLength ?? 20_000), 1), 20_000);
  return {
    async transcribe(_user, input) {
      const parsed = transcriptionInputSchema.safeParse(input);
      if (!parsed.success || parsed.data.bytes.length > maxBytes || !supportedAudioMimeTypes.includes(parsed.data.mimeType as typeof supportedAudioMimeTypes[number]) || (parsed.data.durationSeconds !== undefined && parsed.data.durationSeconds > maxDurationSeconds)) throw new TranscriptionValidationError();
      let temporary: { path: string } | undefined;
      try {
        temporary = await storage.save(parsed.data.bytes, parsed.data.mimeType);
        const transcript = normalizeTranscript(await adapter.transcribe({ bytes: parsed.data.bytes, mimeType: parsed.data.mimeType, locale: 'uk-UA' }), maxTextLength);
        if (!transcript) throw new TranscriptionUnavailableError();
        return { transcript, locale: 'uk-UA' as const };
      } catch (error) {
        if (error instanceof TranscriptionValidationError || error instanceof TranscriptionUnavailableError) throw error;
        throw new TranscriptionUnavailableError();
      } finally {
        if (temporary) await storage.cleanup(temporary).catch(() => undefined);
      }
    },
  };
}
