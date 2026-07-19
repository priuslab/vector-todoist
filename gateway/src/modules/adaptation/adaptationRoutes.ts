import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AdaptationService } from './adaptationService.js';
import { RepositoryError } from '../../repositories/base.js';
export async function adaptationRoutes(app: FastifyInstance, service: AdaptationService): Promise<void> {
  const auth = { preHandler: (request: FastifyRequest, reply: FastifyReply) => app.requireUser(request, reply) };
  app.get('/api/v1/adaptation', auth, async (request, reply) => { try { return reply.send(await service.get(request.user)); } catch { return reply.code(503).send({ error: 'ADAPTATION_UNAVAILABLE', retryable: true }); } });
  app.patch('/api/v1/adaptation/consent', auth, async (request, reply) => { const parsed = z.object({ consent: z.boolean() }).strict().safeParse(request.body); if (!parsed.success) return reply.code(400).send({ error: 'INVALID_ADAPTATION_SETTINGS' }); try { return reply.send(await service.setConsent(request.user, parsed.data.consent)); } catch { return reply.code(503).send({ error: 'ADAPTATION_UNAVAILABLE', retryable: true }); } });
  const action = (name: 'accept' | 'reject') => async (request: FastifyRequest, reply: FastifyReply) => { const id = String((request.params as { id?: string })?.id ?? ''); try { return reply.send(await service[name](request.user, id)); } catch (error) { if (error instanceof RepositoryError && error.code === 'NOT_FOUND') return reply.code(404).send({ error: 'ADAPTATION_NOT_FOUND' }); return reply.code(503).send({ error: 'ADAPTATION_UNAVAILABLE', retryable: true }); } };
  app.post('/api/v1/adaptation/suggestions/:id/accept', auth, action('accept'));
  app.post('/api/v1/adaptation/suggestions/:id/reject', auth, action('reject'));
  app.post('/api/v1/adaptation/reset', auth, async (request, reply) => { try { await service.reset(request.user); return reply.code(204).send(); } catch { return reply.code(503).send({ error: 'ADAPTATION_UNAVAILABLE', retryable: true }); } });
}
