import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { RepositoryError } from '../../repositories/base.js';
import type { OracleService, OracleNodeType } from './oracleService.js';

const types = z.enum(['goal', 'project', 'idea', 'task', 'completed']);
const pathQuery = z.object({ fromType: types, fromId: z.string().trim().min(1).max(128), goalId: z.string().trim().min(1).max(128) }).strict();
const graphQuery = z.object({ goalId: z.string().trim().min(1).max(128).optional() }).strict();
const mapError = (e: unknown) => e instanceof z.ZodError ? { status: 422, body: { error: 'INVALID_ORACLE_REQUEST' } } : e instanceof RepositoryError ? { status: 503, body: { error: 'STORAGE_UNAVAILABLE', retryable: true } } : { status: 503, body: { error: 'ORACLE_UNAVAILABLE', retryable: true } };
const safe = (fn: (request: any) => Promise<unknown>) => async (request: any, reply: FastifyReply) => { try { return reply.code(200).send(await fn(request)); } catch (e) { const mapped = mapError(e); return reply.code(mapped.status).send(mapped.body); } };
export async function oracleRoutes(app: FastifyInstance, service: OracleService): Promise<void> {
  const secure = { preHandler: (request: FastifyRequest, reply: FastifyReply) => app.requireUser(request, reply) };
  app.get('/api/v1/oracle/graph', secure, safe((request) => { const parsed = graphQuery.parse(request.query ?? {}); return service.graph(request.user, parsed.goalId); }));
  app.get('/api/v1/oracle/path', secure, safe((request) => service.path(request.user, pathQuery.parse(request.query) as { fromType: OracleNodeType; fromId: string; goalId: string })));
  app.get('/api/v1/oracle/insight', secure, safe((request) => service.insight(request.user, pathQuery.parse(request.query) as { fromType: OracleNodeType; fromId: string; goalId: string })));
}
