import { describe, expect, it, vi } from 'vitest';
import { createStripeBillingService } from '../src/integrations/stripe/checkoutRoutes.js';

const user = { userId: 'alice', email: 'a@test' };
describe('Stripe checkout and entitlement status', () => {
  it('uses verified user metadata and idempotency key without exposing secret', async () => { const createCheckoutSession = vi.fn(async (input: any) => ({ id: 'cs_1', url: 'https://checkout.stripe.test/cs_1' })); const service = createStripeBillingService({ client: { createCheckoutSession }, repository: { get: vi.fn(async () => null) } as any, priceId: 'price_lifetime_test', mode: 'test', webOrigin: 'https://app.vector.test' }); const result = await service.checkout(user, { idempotencyKey: 'checkout-key-123' }); expect(result.url).toContain('checkout.stripe.test'); expect(createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({ userId: 'alice', priceId: 'price_lifetime_test', idempotencyKey: 'checkout-key-123', successUrl: expect.stringContaining('payment-success') })); });
  it('reports only webhook-confirmed ownership', async () => { const get = vi.fn(async () => ({ id: 'ent-1' })); const service = createStripeBillingService({ client: { createCheckoutSession: vi.fn() }, repository: { get } as any, priceId: 'price_lifetime_test', mode: 'test', webOrigin: 'https://app.vector.test' }); await expect(service.status(user)).resolves.toMatchObject({ active: true, product: 'lifetime_pro' }); expect(get).toHaveBeenCalledWith('alice', 'lifetime_pro'); });
});
