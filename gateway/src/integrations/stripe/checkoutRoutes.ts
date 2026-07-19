import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { VerifiedUser } from '../../auth/verifyPocketBaseToken.js';
import type { EntitlementRepository } from '../../repositories/entitlementRepository.js';
import { StripeRequestError, type StripeCheckoutSession } from './stripeClient.js';

export type StripeBillingService = ReturnType<typeof createStripeBillingService>;
const auth = (app: FastifyInstance) => ({ preHandler: (request: FastifyRequest, reply: FastifyReply) => app.requireUser(request, reply) });
const safeError = (reply: FastifyReply, error: unknown) => error instanceof StripeRequestError ? reply.code(503).send({ error: 'BILLING_UNAVAILABLE', retryable: true }) : reply.code(422).send({ error: 'INVALID_BILLING_REQUEST' });

export function createStripeBillingService(options: { client: { createCheckoutSession(input: { priceId: string; userId: string; successUrl: string; cancelUrl: string; idempotencyKey: string; mode?: 'test' | 'live' }): Promise<StripeCheckoutSession> }; repository: EntitlementRepository; priceId: string; mode: 'test' | 'live'; webOrigin: string }) {
  return {
    async checkout(user: VerifiedUser, input: unknown) {
      const body = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
      const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim().length >= 8 && body.idempotencyKey.length <= 255 ? body.idempotencyKey.trim() : `checkout:${user.userId}:lifetime_pro`;
      const session = await options.client.createCheckoutSession({ priceId: options.priceId, userId: user.userId, mode: options.mode, successUrl: `${options.webOrigin}/?screen=payment-success&session_id={CHECKOUT_SESSION_ID}`, cancelUrl: `${options.webOrigin}/?screen=payment-failed`, idempotencyKey });
      if (!session?.id || typeof session.url !== 'string') throw new StripeRequestError();
      return { url: session.url, sessionId: session.id, mode: options.mode, product: 'lifetime_pro' };
    },
    status: async (user: VerifiedUser) => ({ active: Boolean(await options.repository.get(user.userId, 'lifetime_pro')), product: 'lifetime_pro', mode: options.mode }),
  };
}

export async function checkoutRoutes(app: FastifyInstance, service: StripeBillingService): Promise<void> {
  app.post('/api/v1/billing/checkout', auth(app), async (request: FastifyRequest, reply: FastifyReply) => { try { return reply.code(200).send(await service.checkout(request.user, request.body)); } catch (error) { return safeError(reply, error); } });
  app.get('/api/v1/billing/status', auth(app), async (request: FastifyRequest, reply: FastifyReply) => { try { return reply.code(200).send(await service.status(request.user)); } catch (error) { return safeError(reply, error); } });
}
