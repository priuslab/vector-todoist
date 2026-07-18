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
  return {
    async createTextDraft(user, input, idempotencyKey) {
      const parsed = captureRequestSchema.safeParse(input);
      if (!parsed.success || !isTimezone(parsed.success ? parsed.data.timezone : '')) throw new CaptureValidationError();
      const request: CaptureRequest = parsed.data;
      const rawText = normalizeBrainDumpText(request.text);
      if (!rawText || rawText.length > maxTextLength) throw new CaptureValidationError();
      const fingerprint = JSON.stringify({ kind: request.kind, rawText, timezone: request.timezone });
      const key = idempotencyKey?.trim();
      if (key && repository.findByIdempotencyKey) {
        const existing = await repository.findByIdempotencyKey(user, key);
        if (existing) {
          const existingText = normalizeBrainDumpText(String(existing.rawText ?? ''));
          if (existingText !== rawText || existing.kind !== 'text' || existing.timezone !== request.timezone) throw new CaptureIdempotencyConflictError();
          return { id: existing.id, status: 'draft', rawText: existingText };
        }
      }
      let record;
      try {
        record = await repository.create(user, { kind: 'text', rawText, timezone: request.timezone, ...(key ? { idempotencyKey: key } : {}), source: 'web', status: 'received' });
      } catch (error) {
        if (key && repository.findByIdempotencyKey) {
          const winner = await repository.findByIdempotencyKey(user, key);
          if (winner) {
            const winnerText = normalizeBrainDumpText(String(winner.rawText ?? ''));
            if (winnerText !== rawText || winner.kind !== 'text' || winner.timezone !== request.timezone) throw new CaptureIdempotencyConflictError();
            return { id: winner.id, status: 'draft', rawText: winnerText };
          }
        }
        if (error instanceof RepositoryError) throw error;
        throw new RepositoryError('UNAVAILABLE');
      }
      const response: CaptureDraftResponse = { id: record.id, status: 'draft', rawText };
      return response;
    },
  };
}
