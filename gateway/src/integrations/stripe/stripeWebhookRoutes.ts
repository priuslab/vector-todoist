import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { EntitlementRepository } from '../../repositories/entitlementRepository.js';
import { StripeSignatureError, verifyStripeSignature, type StripeEvent } from './stripeClient.js';

export class StripeEventRejectedError extends Error { readonly code = 'STRIPE_EVENT_REJECTED'; }
export type StripeWebhookService = ReturnType<typeof createStripeWebhookService>;

export function createStripeWebhookService(options: { secret: string; priceId: string; mode: 'test' | 'live'; repository: EntitlementRepository; resolveUser?: (userId: string) => Promise<boolean> }) {
  const claim = async (event: StripeEvent) => {
    const existing = await options.repository.event(event.id);
    if (existing) return { duplicate: true, event: existing };
    try { return { duplicate: false, event: await options.repository.createEvent({ eventId: event.id, eventType: event.type, status: 'received', userId: event.data.object.metadata?.userId, receivedAt: new Date().toISOString() }) }; }
    catch {
      const raced = await options.repository.event(event.id);
      if (raced) return { duplicate: true, event: raced };
      throw new Error('EVENT_RESERVATION_UNAVAILABLE');
    }
  };
  return {
    async handle(rawBody: string, signature: string | undefined) {
      verifyStripeSignature(rawBody, signature, options.secret);
      let event: StripeEvent;
      try { event = JSON.parse(rawBody) as StripeEvent; } catch { throw new StripeEventRejectedError('Invalid Stripe event'); }
      if (!event?.id || !event.type || !event.data?.object) throw new StripeEventRejectedError('Invalid Stripe event');
      const reservation = await claim(event);
      if (reservation.duplicate) return { duplicate: true };
      const record = reservation.event;
      try {
        if (event.type !== 'checkout.session.completed') {
          await options.repository.updateEvent(record.id, { status: 'ignored', processedAt: new Date().toISOString() });
          return { processed: true, ignored: true };
        }
        const session = event.data.object; const metadata = session.metadata ?? {};
        const userId = metadata.userId; const priceId = metadata.priceId ?? session.line_items?.data?.[0]?.price?.id;
        if (session.mode !== 'payment' || session.payment_status !== 'paid' || metadata.product !== 'lifetime_pro' || (metadata.mode && metadata.mode !== options.mode) || !userId || priceId !== options.priceId || (options.resolveUser && !(await options.resolveUser(userId)))) throw new StripeEventRejectedError('Stripe session is not an eligible Lifetime Pro payment');
        await options.repository.upsert({ user: userId, product: 'lifetime_pro', priceId, mode: options.mode, status: 'active', checkoutSessionId: session.id, activatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        await options.repository.updateEvent(record.id, { status: 'processed', processedAt: new Date().toISOString(), userId });
        return { processed: true };
      } catch (error) {
        if (error instanceof StripeEventRejectedError) { await options.repository.updateEvent(record.id, { status: 'ignored', processedAt: new Date().toISOString() }); throw error; }
        try { await options.repository.updateEvent(record.id, { status: 'failed' }); } catch { /* preserve retryable response */ }
        throw error;
      }
    },
  };
}

function rawPayload(request: FastifyRequest): string {
  const body = request.body as unknown;
  if (typeof body === 'string') return body;
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  return JSON.stringify(body ?? {});
}
export async function stripeWebhookRoutes(app: FastifyInstance, service: StripeWebhookService): Promise<void> {
  app.post('/webhooks/stripe', async (request: FastifyRequest, reply: FastifyReply) => {
    try { const signature = request.headers['stripe-signature']; return reply.code(200).send(await service.handle(rawPayload(request), Array.isArray(signature) ? signature[0] : signature)); }
    catch (error) {
      if (error instanceof StripeSignatureError || error instanceof StripeEventRejectedError) return reply.code(400).send({ error: 'INVALID_STRIPE_EVENT' });
      return reply.code(503).send({ error: 'WEBHOOK_RETRY', retryable: true });
    }
  });
}
