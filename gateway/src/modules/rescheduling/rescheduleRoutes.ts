import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { RepositoryError } from '../../repositories/base.js';
import { RescheduleConflictError, RescheduleNotFoundError, RescheduleValidationError, type RescheduleService } from './rescheduleService.js';

const mapError = (error: unknown) => {
  if (error instanceof RescheduleNotFoundError || (error instanceof RepositoryError && error.code === 'NOT_FOUND')) return { status: 404, body: { error: 'NOT_FOUND' } };
  if (error instanceof RescheduleValidationError) return { status: 422, body: { error: 'INVALID_RESCHEDULE' } };
  if (error instanceof RescheduleConflictError || (error instanceof RepositoryError && error.code === 'INVALID')) return { status: 409, body: { error: 'RESCHEDULE_CONFLICT', retryable: true } };
  if (error instanceof RepositoryError) return { status: 503, body: { error: 'STORAGE_UNAVAILABLE', retryable: true } };
  return { status: 503, body: { error: 'RESCHEDULE_UNAVAILABLE', retryable: true } };
};

export async function rescheduleRoutes(app: FastifyInstance, service: RescheduleService): Promise<void> {
  const auth = { preHandler: (request: FastifyRequest, reply: FastifyReply) => app.requireUser(request, reply) };
  app.post('/api/v1/plans/reschedule-preview', auth, async (request: FastifyRequest<{ Body: unknown }>, reply) => {
    try { return reply.code(200).send(await service.preview(request.user, request.body)); } catch (error) { const mapped = mapError(error); return reply.code(mapped.status).send(mapped.body); }
  });
  app.post('/api/v1/plans/reschedule', auth, async (request: FastifyRequest<{ Body: unknown }>, reply) => {
    try { return reply.code(200).send(await service.apply(request.user, request.body)); } catch (error) { const mapped = mapError(error); return reply.code(mapped.status).send(mapped.body); }
  });
}
