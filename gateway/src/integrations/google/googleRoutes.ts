import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { OAuthProviderError, OAuthStateError, type GoogleOAuthService } from './googleOAuth.js';

const auth = (app: FastifyInstance) => ({ preHandler: (request: FastifyRequest, reply: FastifyReply) => app.requireUser(request, reply) });

export async function googleRoutes(app: FastifyInstance, service: GoogleOAuthService): Promise<void> {
  app.post('/api/v1/integrations/google-calendar/start', auth(app), async (request, reply) => {
    try { return reply.code(200).send(await service.start(request.user)); }
    catch { return reply.code(503).send({ error: 'GOOGLE_CALENDAR_UNAVAILABLE', retryable: true }); }
  });
  app.get('/api/v1/integrations/google-calendar/callback', async (request: FastifyRequest<{ Querystring: { code?: string; state?: string; error?: string } }>, reply) => {
    if (request.query.error) return reply.code(400).send({ error: 'GOOGLE_AUTH_DENIED' });
    try { return reply.code(200).send(await service.callback(request.query)); }
    catch (error) {
      if (error instanceof OAuthStateError) return reply.code(400).send({ error: 'GOOGLE_AUTH_STATE_INVALID' });
      if (error instanceof OAuthProviderError) return reply.code(502).send({ error: 'GOOGLE_CALENDAR_UNAVAILABLE', retryable: true });
      request.log.warn('Google Calendar callback failed');
      return reply.code(502).send({ error: 'GOOGLE_CALENDAR_UNAVAILABLE', retryable: true });
    }
  });
  app.get('/api/v1/integrations/google-calendar/status', auth(app), async (request, reply) => {
    try { return reply.code(200).send(await service.status(request.user)); }
    catch { return reply.code(503).send({ error: 'GOOGLE_CALENDAR_UNAVAILABLE', retryable: true }); }
  });
  app.delete('/api/v1/integrations/google-calendar', auth(app), async (request, reply) => {
    try { await service.disconnect(request.user); return reply.code(204).send(); }
    catch { return reply.code(503).send({ error: 'GOOGLE_CALENDAR_UNAVAILABLE', retryable: true }); }
  });
}
