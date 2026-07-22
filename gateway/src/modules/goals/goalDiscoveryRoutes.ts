import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { RepositoryError } from '../../repositories/base.js';
import { GoalDiscoveryConflictError, GoalDiscoveryDisabledError, GoalDiscoveryNotFoundError, GoalDiscoveryValidationError, type GoalDiscoveryService } from './goalDiscoveryService.js';

const auth = (app: FastifyInstance) => ({ preHandler: (request: FastifyRequest, reply: FastifyReply) => app.requireUser(request, reply) });
const map = (error: unknown) => {
  if (error instanceof GoalDiscoveryDisabledError) return { status: 404, body: { enabled: false, error: 'GOAL_DISCOVERY_DISABLED' } };
  if (error instanceof GoalDiscoveryNotFoundError || (error instanceof RepositoryError && error.code === 'NOT_FOUND')) return { status: 404, body: { error: 'GOAL_DISCOVERY_NOT_FOUND' } };
  if (error instanceof GoalDiscoveryValidationError) return { status: 422, body: { error: 'INVALID_GOAL_DISCOVERY' } };
  if (error instanceof GoalDiscoveryConflictError) return { status: 409, body: { error: 'GOAL_DISCOVERY_CONFLICT', retryable: true } };
  return { status: 503, body: { error: 'GOAL_DISCOVERY_UNAVAILABLE', retryable: true } };
};
const safe = (fn: (request: any) => Promise<unknown>) => async (request: any, reply: FastifyReply) => {
  try {
    return reply.code(200).send(await fn(request));
  } catch (error) {
    const mapped = map(error);
    // The public response stays deliberately generic, but retain the original
    // failure in the protected gateway log to diagnose PocketBase schema/rule
    // errors without ever logging the user's bearer token.
    request.log.error({ err: error, goalDiscoveryError: mapped.body.error }, 'Goal discovery request failed');
    return reply.code(mapped.status).send(mapped.body);
  }
};

export async function goalDiscoveryRoutes(app: FastifyInstance, service: GoalDiscoveryService): Promise<void> {
  app.get('/api/v1/goals/discovery/protocol', safe(() => Promise.resolve(service.protocol())));
  const secured = auth(app);
  app.post('/api/v1/goals/discovery/sessions', secured, safe((request) => service.start(request.user)));
  app.get('/api/v1/goals/discovery/sessions/:id', secured, safe((request: FastifyRequest<{ Params: { id: string } }>) => service.get(request.user, request.params.id)));
  app.post('/api/v1/goals/discovery/sessions/:id/answers', secured, safe((request: FastifyRequest<{ Params: { id: string }; Body: unknown }>) => service.answer(request.user, request.params.id, request.body)));
  app.post('/api/v1/goals/discovery/sessions/:id/complete', secured, safe((request: FastifyRequest<{ Params: { id: string }; Body: unknown }>) => service.complete(request.user, request.params.id, request.body)));
  app.patch('/api/v1/goals/discovery/sessions/:id/suggestion', secured, safe((request: FastifyRequest<{ Params: { id: string }; Body: unknown }>) => service.edit(request.user, request.params.id, request.body)));
  app.post('/api/v1/goals/discovery/sessions/:id/skip', secured, safe((request: FastifyRequest<{ Params: { id: string } }>) => service.skip(request.user, request.params.id)));
}
