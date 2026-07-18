import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { RepositoryError } from '../../repositories/base.js';
import { AnalysisAnswersError, AnalysisNotFoundError, AnalysisValidationError, AiRetryableError, type AnalysisService } from './analyzeBrainDump.js';

const safeError = (error: unknown) => {
  if (error instanceof AnalysisNotFoundError) return { status: 404, body: { error: 'NOT_FOUND' } };
  if (error instanceof AnalysisAnswersError) return { status: 400, body: { error: 'INVALID_ANSWERS' } };
  if (error instanceof AnalysisValidationError) return { status: 422, body: { error: 'NEEDS_ATTENTION' } };
  if (error instanceof AiRetryableError || error instanceof RepositoryError) return { status: 503, body: { error: 'AI_UNAVAILABLE', retryable: true } };
  return { status: 503, body: { error: 'AI_UNAVAILABLE', retryable: true } };
};

export async function analysisRoutes(app: FastifyInstance, service: AnalysisService): Promise<void> {
  app.post('/api/v1/brain-dumps/:id/analyze', { preHandler: (request, reply) => app.requireUser(request, reply) }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try { return reply.code(200).send(await service.analyze(request.user, request.params.id)); } catch (error) { const mapped = safeError(error); return reply.code(mapped.status).send(mapped.body); }
  });
  app.post('/api/v1/brain-dumps/:id/answers', { preHandler: (request, reply) => app.requireUser(request, reply) }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try { return reply.code(200).send(await service.answer(request.user, request.params.id, request.body)); } catch (error) { const mapped = safeError(error); return reply.code(mapped.status).send(mapped.body); }
  });
  app.get('/api/v1/brain-dumps/:id/result', { preHandler: (request, reply) => app.requireUser(request, reply) }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try { const result = await service.result(request.user, request.params.id); return result ? reply.code(200).send(result) : reply.code(404).send({ error: 'NOT_FOUND' }); } catch (error) { const mapped = safeError(error); return reply.code(mapped.status).send(mapped.body); }
  });
}
