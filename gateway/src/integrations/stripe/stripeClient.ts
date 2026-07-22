import { createHmac, timingSafeEqual } from 'node:crypto';

export type StripeMode = 'test' | 'live';
export type StripeCheckoutSession = {
  id: string;
  url?: string;
  mode?: string;
  status?: string;
  payment_status?: string;
  metadata?: Record<string, string>;
  client_reference_id?: string;
  line_items?: { data?: Array<{ price?: { id?: string } }> };
};
export type StripeEvent = { id: string; type: string; data: { object: StripeCheckoutSession } };

export class StripeConfigError extends Error { readonly code = 'STRIPE_CONFIG'; }
export class StripeSignatureError extends Error { readonly code = 'STRIPE_SIGNATURE'; }
export class StripeRequestError extends Error { readonly code = 'STRIPE_UNAVAILABLE'; readonly retryable = true; }

export function stripeModeFromSecret(secret: string): StripeMode {
  return secret.startsWith('sk_live_') ? 'live' : 'test';
}

export function verifyStripeSignature(rawBody: string, signature: string | undefined, secret: string, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300): void {
  if (!signature) throw new StripeSignatureError('Missing Stripe signature');
  const parts = new Map(signature.split(',').map((part) => { const [key, value] = part.split('=', 2); return [key, value]; }));
  const timestamp = Number(parts.get('t'));
  const value = parts.get('v1');
  if (!Number.isInteger(timestamp) || !value || Math.abs(nowSeconds - timestamp) > toleranceSeconds || !/^[a-f0-9]{64}$/i.test(value)) throw new StripeSignatureError('Invalid Stripe signature');
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const a = Buffer.from(value, 'hex'); const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new StripeSignatureError('Invalid Stripe signature');
}

export function createStripeClient(options: { secretKey: string; fetcher?: typeof fetch; timeoutMs?: number }) {
  if (!options.secretKey.trim()) throw new StripeConfigError('Missing Stripe secret key');
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 10_000, 500), 30_000);
  async function request<T>(path: string, body: URLSearchParams, idempotencyKey?: string): Promise<T> {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(`https://api.stripe.com${path}`, { method: 'POST', headers: { authorization: `Bearer ${options.secretKey}`, 'content-type': 'application/x-www-form-urlencoded', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) }, body, signal: controller.signal });
      const payload = await response.json().catch(() => undefined);
      if (!response.ok) throw new StripeRequestError(typeof payload === 'object' && payload && 'error' in payload ? 'Stripe request failed' : 'Stripe request failed');
      return payload as T;
    } catch (error) { if (error instanceof StripeRequestError) throw error; throw new StripeRequestError(); } finally { clearTimeout(timer); }
  }
  return {
    mode: stripeModeFromSecret(options.secretKey),
    createCheckoutSession(input: { priceId: string; userId: string; successUrl: string; cancelUrl: string; idempotencyKey: string; mode?: StripeMode }) {
      const body = new URLSearchParams(); body.set('mode', 'payment'); body.set('success_url', input.successUrl); body.set('cancel_url', input.cancelUrl); body.set('client_reference_id', input.userId); body.set('metadata[userId]', input.userId); body.set('metadata[product]', 'lifetime_pro'); body.set('metadata[priceId]', input.priceId); if (input.mode) body.set('metadata[mode]', input.mode); body.set('line_items[0][price]', input.priceId); body.set('line_items[0][quantity]', '1');
      return request<StripeCheckoutSession>('/v1/checkout/sessions', body, input.idempotencyKey);
    },
  };
}
