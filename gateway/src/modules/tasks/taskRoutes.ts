import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { RepositoryError } from '../../repositories/base.js';
import { TaskConflictError, TaskNotFoundError, TaskValidationError, type TaskService } from './taskService.js';

const mapError = (error: unknown) => {
  if (error instanceof TaskNotFoundError || (error instanceof RepositoryError && error.code === 'NOT_FOUND')) return { status: 404, body: { error: 'NOT_FOUND' } };
  if (error instanceof TaskValidationError) return { status: 422, body: { error: 'INVALID_TASK' } };
  if (error instanceof TaskConflictError) return { status: 409, body: { error: 'TASK_CONFLICT', retryable: true } };
  if (error instanceof RepositoryError) return { status: 503, body: { error: 'STORAGE_UNAVAILABLE', retryable: true } };
  return { status: 503, body: { error: 'STORAGE_UNAVAILABLE', retryable: true } };
};

export async function taskRoutes(app: FastifyInstance, service: TaskService): Promise<void> {
  const auth = { preHandler: (request: FastifyRequest, reply: FastifyReply) => app.requireUser(request, reply) };
  app.patch('/api/v1/tasks/:id', auth, async (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply) => {
    try { const body = request.body && typeof request.body === 'object' ? { ...(request.body as Record<string, unknown>) } : {}; const header = request.headers['idempotency-key']; if (typeof header === 'string' && body.idempotencyKey === undefined) body.idempotencyKey = header; return reply.code(200).send(await service.update(request.user, request.params.id, body)); } catch (error) { const mapped = mapError(error); return reply.code(mapped.status).send(mapped.body); }
  });
  app.post('/api/v1/tasks/:id/complete', auth, async (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply) => {
    try { const body = request.body && typeof request.body === 'object' ? { ...(request.body as Record<string, unknown>) } : {}; const header = request.headers['idempotency-key']; if (typeof header === 'string' && body.idempotencyKey === undefined) body.idempotencyKey = header; return reply.code(200).send(await service.complete(request.user, request.params.id, body)); } catch (error) { const mapped = mapError(error); return reply.code(mapped.status).send(mapped.body); }
  });
}
