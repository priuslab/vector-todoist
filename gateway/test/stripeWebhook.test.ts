import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createStripeWebhookService } from '../src/integrations/stripe/stripeWebhookRoutes.js';

const secret = 'whsec_test';
const user = { userId: 'alice' };
function signed(body: string, timestamp = Math.floor(Date.now() / 1000)) { return `t=${timestamp},v1=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`; }
function setup() {
  const events: any[] = []; const entitlements: any[] = [];
  const repository: any = {
    event: vi.fn(async (id: string) => events.find((item) => item.eventId === id) ?? null),
    createEvent: vi.fn(async (input: any) => { if (events.some((item) => item.eventId === input.eventId)) throw new Error('unique'); const row = { id: `event-${events.length + 1}`, ...input }; events.push(row); return row; }),
    updateEvent: vi.fn(async (id: string, input: any) => { const row = events.find((item) => item.id === id); Object.assign(row, input); return row; }),
    upsert: vi.fn(async (input: any) => { const row = { id: 'ent-1', ...input }; entitlements.push(row); return row; }),
  };
  const service = createStripeWebhookService({ secret, priceId: 'price_lifetime_test', mode: 'test', repository, resolveUser: async (id) => id === user.userId });
  return { service, repository, events, entitlements };
}
const event = (overrides: Record<string, unknown> = {}) => ({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: 'cs_1', mode: 'payment', payment_status: 'paid', metadata: { userId: 'alice', product: 'lifetime_pro', priceId: 'price_lifetime_test' }, ...overrides } } });

describe('Stripe webhook-first Lifetime Pro', () => {
  it('activates only after a valid signed paid test checkout', async () => { const s = setup(); const body = JSON.stringify(event()); await expect(s.service.handle(body, signed(body))).resolves.toEqual({ processed: true }); expect(s.repository.upsert).toHaveBeenCalledWith(expect.objectContaining({ user: 'alice', product: 'lifetime_pro', priceId: 'price_lifetime_test' })); });
  it('rejects invalid signatures, wrong mode/price and forged users without granting access', async () => { const s = setup(); const body = JSON.stringify(event()); await expect(s.service.handle(body, 'bad')).rejects.toMatchObject({ code: 'STRIPE_SIGNATURE' }); const wrong = JSON.stringify({ ...event(), id: 'evt_wrong', data: { object: { ...event().data.object, metadata: { userId: 'alice', product: 'lifetime_pro', priceId: 'price_other' } } } }); await expect(s.service.handle(wrong, signed(wrong))).rejects.toMatchObject({ code: 'STRIPE_EVENT_REJECTED' }); const forged = JSON.stringify({ ...event(), id: 'evt_forged', data: { object: { ...event().data.object, metadata: { userId: 'bob', product: 'lifetime_pro', priceId: 'price_lifetime_test' } } } }); await expect(s.service.handle(forged, signed(forged))).rejects.toMatchObject({ code: 'STRIPE_EVENT_REJECTED' }); expect(s.repository.upsert).not.toHaveBeenCalled(); });
  it('is idempotent for duplicate and safely ignores out-of-order events', async () => { const s = setup(); const body = JSON.stringify(event()); await s.service.handle(body, signed(body)); await expect(s.service.handle(body, signed(body))).resolves.toEqual({ duplicate: true }); const pending = JSON.stringify({ ...event(), id: 'evt_pending', data: { object: { ...event().data.object, payment_status: 'unpaid' } } }); await expect(s.service.handle(pending, signed(pending))).rejects.toMatchObject({ code: 'STRIPE_EVENT_REJECTED' }); expect(s.repository.upsert).toHaveBeenCalledTimes(1); });
  it('retries a previously failed event instead of acknowledging it as a duplicate', async () => { const s = setup(); s.repository.upsert.mockRejectedValueOnce(new Error('temporary')); const body = JSON.stringify(event({ id: 'evt_retry' })); await expect(s.service.handle(body, signed(body))).rejects.toThrow('temporary'); expect(s.events[0].status).toBe('failed'); s.repository.upsert.mockResolvedValueOnce({ id: 'ent-1' }); await expect(s.service.handle(body, signed(body))).resolves.toEqual({ processed: true }); });
  it('signs the exact raw payload, including whitespace and key order', async () => { const s = setup(); const body = '{"data":{"object":{"metadata":{"priceId":"price_lifetime_test","product":"lifetime_pro","userId":"alice"},"payment_status":"paid","mode":"payment","id":"cs_1"}},"type":"checkout.session.completed","id":"evt_raw"}'; await expect(s.service.handle(body, signed(body))).resolves.toEqual({ processed: true }); });
});
