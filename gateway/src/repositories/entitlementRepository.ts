import type { PocketBaseClient, PocketBaseRecord } from '../pocketbase/client.js';
import { PocketBaseClientError } from '../pocketbase/client.js';

export type EntitlementRecord = PocketBaseRecord & { user: string; product: string; priceId: string; mode: 'test' | 'live'; status: 'active' | 'revoked'; checkoutSessionId: string; activatedAt: string; updatedAt: string };
export type StripeWebhookEventRecord = PocketBaseRecord & { eventId: string; eventType: string; status: 'received' | 'processed' | 'ignored' | 'failed'; userId?: string; receivedAt: string; processedAt?: string };
export type EntitlementInput = { user: string; product: string; priceId: string; mode: 'test' | 'live'; status: 'active' | 'revoked'; checkoutSessionId: string; activatedAt: string; updatedAt: string };
export type StripeWebhookEventInput = { eventId: string; eventType: string; status: 'received' | 'processed' | 'ignored' | 'failed'; userId?: string; receivedAt: string; processedAt?: string };
export interface EntitlementRepository {
  get(userId: string, product?: string): Promise<EntitlementRecord | null>;
  upsert(input: EntitlementInput): Promise<EntitlementRecord>;
  event(eventId: string): Promise<StripeWebhookEventRecord | null>;
  createEvent(input: StripeWebhookEventInput): Promise<StripeWebhookEventRecord>;
  updateEvent(id: string, input: Partial<StripeWebhookEventRecord>): Promise<StripeWebhookEventRecord>;
}

const esc = (value: string) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
export function createEntitlementRepository(client: PocketBaseClient): EntitlementRepository {
  return {
    async get(userId, product = 'lifetime_pro') {
      const rows = await client.list<EntitlementRecord>('stripe_entitlements', `user = '${esc(userId)}' && product = '${esc(product)}'`);
      return rows.find((row) => row.user === userId && row.product === product && row.status === 'active') ?? null;
    },
    async upsert(input) {
      const existing = await this.get(input.user, input.product);
      if (existing) return client.update<EntitlementRecord>('stripe_entitlements', existing.id, { ...input, user: input.user });
      try { return await client.create<EntitlementRecord>('stripe_entitlements', input); }
      catch (error) { if (!(error instanceof PocketBaseClientError)) throw error; const retry = await this.get(input.user, input.product); if (retry) return client.update<EntitlementRecord>('stripe_entitlements', retry.id, { ...input, user: input.user }); throw error; }
    },
    async event(eventId) { const rows = await client.list<StripeWebhookEventRecord>('stripe_webhook_events', `eventId = '${esc(eventId)}'`); return rows.find((row) => row.eventId === eventId) ?? null; },
    createEvent: (input) => client.create<StripeWebhookEventRecord>('stripe_webhook_events', input),
    updateEvent: (id, input) => client.update<StripeWebhookEventRecord>('stripe_webhook_events', id, input),
  };
}
