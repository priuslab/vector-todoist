import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { RepositoryError } from '../../repositories/base.js';
import { UndoConflictError, UndoNotFoundError, type UndoService } from './undoService.js';

const mapError = (error: unknown) => {
  if (error instanceof UndoNotFoundError || (error instanceof RepositoryError && error.code === 'NOT_FOUND')) return { status: 404, body: { error: 'NOT_FOUND' } };
  if (error instanceof UndoConflictError) return { status: 409, body: { error: 'UNDO_CONFLICT', retryable: true } };
  if (error instanceof RepositoryError) return { status: 503, body: { error: 'STORAGE_UNAVAILABLE', retryable: true } };
  return { status: 503, body: { error: 'STORAGE_UNAVAILABLE', retryable: true } };
};

export async function changeSetRoutes(app: FastifyInstance, service: UndoService): Promise<void> {
  const auth = { preHandler: (request: FastifyRequest, reply: FastifyReply) => app.requireUser(request, reply) };
  app.post('/api/v1/change-sets/:id/undo', auth, async (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply) => {
    try { return reply.code(200).send(await service.undo(request.user, request.params.id, request.body)); } catch (error) { const mapped = mapError(error); return reply.code(mapped.status).send(mapped.body); }
  });
}
