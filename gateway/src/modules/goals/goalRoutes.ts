import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { RepositoryError } from '../../repositories/base.js';
import { GoalConflictError, GoalEntitlementError, GoalNotFoundError, GoalValidationError, type GoalService } from './goalService.js';

const mapError = (error: unknown) => {
  if (error instanceof GoalNotFoundError || (error instanceof RepositoryError && error.code === 'NOT_FOUND')) return { status: 404, body: { error: 'NOT_FOUND' } };
  if (error instanceof GoalEntitlementError) return { status: 402, body: { error: 'ENTITLEMENT_REQUIRED', feature: 'unlimited_goals', paywall: true } };
  if (error instanceof GoalValidationError) return { status: 422, body: { error: 'INVALID_GOAL' } };
  if (error instanceof GoalConflictError) return { status: 409, body: { error: 'GOAL_CONFLICT', retryable: true } };
  if (error instanceof RepositoryError) return { status: 503, body: { error: 'STORAGE_UNAVAILABLE', retryable: true } };
  return { status: 503, body: { error: 'STORAGE_UNAVAILABLE', retryable: true } };
};
const auth = (app: FastifyInstance) => ({ preHandler: (request: FastifyRequest, reply: FastifyReply) => app.requireUser(request, reply) });
const safe = (app: FastifyInstance, fn: (request: any, reply: FastifyReply) => Promise<unknown>) => async (request: any, reply: FastifyReply) => { try { return reply.code(200).send(await fn(request, reply)); } catch (e) { const mapped = mapError(e); return reply.code(mapped.status).send(mapped.body); } };

export async function goalRoutes(app: FastifyInstance, service: GoalService): Promise<void> {
  const secured = auth(app);
  app.get('/api/v1/goals', secured, safe(app, (request) => service.goals.list(request.user)));
  app.post('/api/v1/goals', secured, safe(app, (request) => service.goals.create(request.user, request.body)));
  app.get('/api/v1/goals/:id', secured, safe(app, (request: FastifyRequest<{ Params: { id: string } }>) => service.goals.get(request.user, request.params.id)));
  app.patch('/api/v1/goals/:id', secured, safe(app, (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>) => service.goals.update(request.user, request.params.id, request.body)));
  app.delete('/api/v1/goals/:id', secured, safe(app, async (request: FastifyRequest<{ Params: { id: string } }>) => { await service.goals.delete(request.user, request.params.id); return { ok: true }; }));
  app.get('/api/v1/projects', secured, safe(app, (request) => service.projects.list(request.user)));
  app.post('/api/v1/projects', secured, safe(app, (request) => service.projects.create(request.user, request.body)));
  app.get('/api/v1/projects/:id', secured, safe(app, (request: FastifyRequest<{ Params: { id: string } }>) => service.projects.get(request.user, request.params.id)));
  app.patch('/api/v1/projects/:id', secured, safe(app, (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>) => service.projects.update(request.user, request.params.id, request.body)));
  app.delete('/api/v1/projects/:id', secured, safe(app, async (request: FastifyRequest<{ Params: { id: string } }>) => { await service.projects.delete(request.user, request.params.id); return { ok: true }; }));
  app.get('/api/v1/ideas', secured, safe(app, (request) => service.ideas.list(request.user)));
  app.post('/api/v1/ideas', secured, safe(app, (request) => service.ideas.create(request.user, request.body)));
  app.get('/api/v1/ideas/:id', secured, safe(app, (request: FastifyRequest<{ Params: { id: string } }>) => service.ideas.get(request.user, request.params.id)));
  app.patch('/api/v1/ideas/:id', secured, safe(app, (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>) => service.ideas.update(request.user, request.params.id, request.body)));
  app.post('/api/v1/ideas/:id/convert-preview', secured, safe(app, (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>) => service.conversion.preview(request.user, request.params.id, request.body)));
  app.post('/api/v1/ideas/:id/convert', secured, safe(app, (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>) => service.conversion.apply(request.user, request.params.id, request.body)));
  app.post('/api/v1/graph', secured, safe(app, (request) => service.graph.create(request.user, request.body)));
  app.get('/api/v1/graph', secured, safe(app, (request) => service.graph.list(request.user)));
  app.patch('/api/v1/graph/:id', secured, safe(app, (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>) => service.graph.update(request.user, request.params.id, request.body)));
  app.delete('/api/v1/graph/:id', secured, safe(app, async (request: FastifyRequest<{ Params: { id: string } }>) => { await service.graph.delete(request.user, request.params.id); return { ok: true }; }));
  app.post('/api/v1/change-sets/:id/undo-goal', secured, safe(app, (request: FastifyRequest<{ Params: { id: string } }>) => service.conversion.undo(request.user, request.params.id)));
}
