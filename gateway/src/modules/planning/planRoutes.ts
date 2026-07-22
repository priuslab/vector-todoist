import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { RepositoryError } from '../../repositories/base.js';
import { PlanConflictError, PlanNotFoundError, PlanValidationError, type PlanService } from './planService.js';
import { todayQuerySchema } from './planSchemas.js';

const mapError = (error: unknown) => {
  if (error instanceof PlanNotFoundError) return { status: 404, body: { error: 'NOT_FOUND' } };
  if (error instanceof PlanValidationError) return { status: 422, body: { error: 'INVALID_PLAN' } };
  if (error instanceof PlanConflictError) return { status: 409, body: { error: 'PLAN_CONFLICT', retryable: true } };
  if (error instanceof RepositoryError) return { status: 503, body: { error: 'STORAGE_UNAVAILABLE', retryable: true } };
  return { status: 503, body: { error: 'STORAGE_UNAVAILABLE', retryable: true } };
};

export async function planRoutes(app: FastifyInstance, service: PlanService): Promise<void> {
  const auth = { preHandler: (request: FastifyRequest, reply: FastifyReply) => app.requireUser(request, reply) };
  app.post('/api/v1/brain-dumps/:id/plan-preview', auth, async (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply) => {
    try { return reply.code(200).send(await service.preview(request.user, request.params.id, request.body)); } catch (error) { const mapped = mapError(error); return reply.code(mapped.status).send(mapped.body); }
  });
  app.post('/api/v1/change-sets/:id/apply', auth, async (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply) => {
    try { return reply.code(200).send(await service.apply(request.user, request.params.id, request.body)); } catch (error) { const mapped = mapError(error); return reply.code(mapped.status).send(mapped.body); }
  });
  app.get('/api/v1/today', auth, async (request: FastifyRequest<{ Querystring: unknown }>, reply) => {
    const parsed = todayQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_QUERY' });
    try { return reply.code(200).send(await service.today(request.user, parsed.data.date, parsed.data.timezone)); } catch (error) { const mapped = mapError(error); return reply.code(mapped.status).send(mapped.body); }
  });
  app.get('/api/v1/inbox', auth, async (request, reply) => {
    try { return reply.code(200).send(await service.inbox(request.user)); } catch (error) { const mapped = mapError(error); return reply.code(mapped.status).send(mapped.body); }
  });
  app.get('/api/v1/tasks/:id', auth, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try { return reply.code(200).send(await service.task(request.user, request.params.id)); } catch (error) { const mapped = mapError(error); return reply.code(mapped.status).send(mapped.body); }
  });
}
