import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { RepositoryError } from '../../repositories/base.js';
import { CaptureIdempotencyConflictError, CaptureValidationError, type CaptureService } from './captureService.js';

export async function captureRoutes(app: FastifyInstance, service: CaptureService): Promise<void> {
  app.post('/api/v1/brain-dumps', { preHandler: (request, reply) => app.requireUser(request, reply) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const idempotencyKey = request.headers['idempotency-key'];
    const key = Array.isArray(idempotencyKey) ? idempotencyKey[0] : idempotencyKey;
    if (key && key.length > 256) return reply.code(400).send({ error: 'INVALID_REQUEST' });
    try {
      const response = await service.createTextDraft(request.user, request.body, key);
      return reply.code(201).send(response);
    } catch (error) {
      if (error instanceof CaptureValidationError) return reply.code(400).send({ error: 'INVALID_REQUEST' });
      if (error instanceof CaptureIdempotencyConflictError) return reply.code(409).send({ error: 'IDEMPOTENCY_CONFLICT' });
      if (error instanceof RepositoryError) return reply.code(error.code === 'INVALID' ? 400 : 503).send({ error: 'STORAGE_UNAVAILABLE' });
      request.log.warn('Brain dump capture failed');
      return reply.code(503).send({ error: 'STORAGE_UNAVAILABLE' });
    }
  });
}
