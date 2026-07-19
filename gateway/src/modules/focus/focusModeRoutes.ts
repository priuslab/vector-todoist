import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { RepositoryError } from '../../repositories/base.js';
import { FocusConflictError, FocusNotFoundError, FocusValidationError, type FocusModeService } from './focusModeService.js';

const mapError = (error: unknown) => {
  if (error instanceof FocusNotFoundError || (error instanceof RepositoryError && error.code === 'NOT_FOUND')) return { status: 404, body: { error: 'NOT_FOUND' } };
  if (error instanceof FocusValidationError) return { status: 422, body: { error: 'INVALID_FOCUS' } };
  if (error instanceof FocusConflictError || (error instanceof RepositoryError && error.code === 'INVALID')) return { status: 409, body: { error: 'FOCUS_CONFLICT', retryable: true } };
  if (error instanceof RepositoryError) return { status: 503, body: { error: 'STORAGE_UNAVAILABLE', retryable: true } };
  return { status: 503, body: { error: 'FOCUS_UNAVAILABLE', retryable: true } };
};
export async function focusModeRoutes(app: FastifyInstance, service: FocusModeService): Promise<void> {
  const auth = { preHandler: (request: FastifyRequest, reply: FastifyReply) => app.requireUser(request, reply) };
  app.post('/api/v1/focus/preview', auth, async (request: FastifyRequest<{ Body: unknown }>, reply) => {
    try { return reply.code(200).send(await service.preview(request.user, request.body)); } catch (error) { const mapped = mapError(error); return reply.code(mapped.status).send(mapped.body); }
  });
  app.post('/api/v1/focus/apply', auth, async (request: FastifyRequest<{ Body: unknown }>, reply) => {
    try { return reply.code(200).send(await service.apply(request.user, request.body)); } catch (error) { const mapped = mapError(error); return reply.code(mapped.status).send(mapped.body); }
  });
}
