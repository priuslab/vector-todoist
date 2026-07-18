import type { VerifiedUser } from '../../auth/verifyPocketBaseToken.js';
import { RepositoryError } from '../../repositories/base.js';
import type { BrainDumpRepository } from '../../repositories/brainDumpRepository.js';
import { captureRequestSchema, isTimezone, normalizeBrainDumpText, type CaptureDraftResponse, type CaptureRequest } from './captureSchemas.js';

export class CaptureValidationError extends Error { readonly code = 'INVALID'; }
export class CaptureIdempotencyConflictError extends Error { readonly code = 'CONFLICT'; }

type Entry = { fingerprint: string; response: CaptureDraftResponse };

export interface CaptureService {
  createTextDraft(user: VerifiedUser, input: unknown, idempotencyKey?: string): Promise<CaptureDraftResponse>;
}

export function createCaptureService(repository: BrainDumpRepository, options: { maxTextLength?: number } = {}): CaptureService {
  const maxTextLength = Math.min(Math.max(Math.floor(options.maxTextLength ?? 20_000), 1), 20_000);
  const idempotency = new Map<string, Entry>();

  return {
    async createTextDraft(user, input, idempotencyKey) {
      const parsed = captureRequestSchema.safeParse(input);
      if (!parsed.success || !isTimezone(parsed.success ? parsed.data.timezone : '')) throw new CaptureValidationError();
      const request: CaptureRequest = parsed.data;
      const rawText = normalizeBrainDumpText(request.text);
      if (!rawText || rawText.length > maxTextLength) throw new CaptureValidationError();
      const fingerprint = JSON.stringify({ kind: request.kind, rawText, timezone: request.timezone });
      const key = idempotencyKey?.trim();
      const cacheKey = key ? `${user.userId}:${key}` : undefined;
      if (cacheKey) {
        const existing = idempotency.get(cacheKey);
        if (existing) {
          if (existing.fingerprint !== fingerprint) throw new CaptureIdempotencyConflictError();
          return existing.response;
        }
      }
      let record;
      try {
        record = await repository.create(user, { kind: 'text', rawText, source: 'web', status: 'received' });
      } catch (error) {
        if (error instanceof RepositoryError) throw error;
        throw new RepositoryError('UNAVAILABLE');
      }
      const response: CaptureDraftResponse = { id: record.id, status: 'draft', rawText };
      if (cacheKey) idempotency.set(cacheKey, { fingerprint, response });
      return response;
    },
  };
}
