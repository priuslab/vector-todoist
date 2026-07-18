import { describe, expect, it, vi } from 'vitest';

import { createPocketBaseTokenVerifier, hashToken, type PocketBaseFetch } from '../src/auth/verifyPocketBaseToken.js';
import { buildApp } from '../src/app.js';

const config = {
  nodeEnv: 'test' as const,
  host: '127.0.0.1',
  port: 8787,
  publicWebOrigin: 'https://app.vector.test',
  pocketbaseUrl: 'http://127.0.0.1:8090',
  trustProxy: false,
  enableGoogleIntegration: false,
  enableTelegramIntegration: false,
  enableStripeIntegration: false,
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('PocketBase token verification', () => {
  it('fails closed when authorization is absent, invalid, expired, or PocketBase is unavailable', async () => {
    const fetcher = vi.fn<PocketBaseFetch>().mockRejectedValue(new Error('down'));
    const verifier = createPocketBaseTokenVerifier({ baseUrl: config.pocketbaseUrl, fetcher, cacheTtlMs: 60_000 });

    await expect(verifier.verify(undefined)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(verifier.verify('Basic abc')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(verifier.verify('Bearer expired')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('returns only verified identity and caches by a one-way token hash with a capped TTL', async () => {
    const fetcher = vi.fn<PocketBaseFetch>().mockResolvedValue(response({
      token: 'new-token',
      record: { id: 'user-1', email: 'olena@example.test', password: 'never-return' },
    }));
    const verifier = createPocketBaseTokenVerifier({ baseUrl: config.pocketbaseUrl, fetcher, cacheTtlMs: 600_000 });

    const first = await verifier.verify('Bearer secret-token');
    const second = await verifier.verify('Bearer secret-token');

    expect(first).toEqual({ userId: 'user-1', email: 'olena@example.test' });
    expect(second).toEqual(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({ authorization: 'Bearer secret-token' });
    expect(hashToken('secret-token')).not.toContain('secret-token');
    expect(verifier.cacheTtlMs).toBeLessThanOrEqual(60_000);
  });

  it('does not expose raw tokens in errors or logs and rejects malformed PocketBase responses', async () => {
    const token = 'raw-secret-token';
    const fetcher = vi.fn<PocketBaseFetch>().mockResolvedValue(response({ token: 123, record: { id: '' } }));
    const logger = { warn: vi.fn(), error: vi.fn() };
    const verifier = createPocketBaseTokenVerifier({ baseUrl: config.pocketbaseUrl, fetcher, logger });

    await expect(verifier.verify(`Bearer ${token}`)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(logger.warn.mock.calls.flat().join(' ')).not.toContain(token);
    expect(logger.error.mock.calls.flat().join(' ')).not.toContain(token);
  });

  it('evicts old cache entries when the bounded cache is full', async () => {
    const fetcher = vi.fn<PocketBaseFetch>((_url, init) => {
      const token = String(init?.headers && (init.headers as Record<string, string>).authorization).replace('Bearer ', '');
      return Promise.resolve(response({ record: { id: token, email: `${token}@example.test` } }));
    });
    const verifier = createPocketBaseTokenVerifier({ baseUrl: config.pocketbaseUrl, fetcher, maxCacheEntries: 1 });
    await verifier.verify('Bearer first');
    await verifier.verify('Bearer second');
    await verifier.verify('Bearer first');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});

describe('requireUser hook', () => {
  it('rejects missing auth and exposes verified identity only to handlers', async () => {
    const verifier = { verify: vi.fn((authorization?: string) => authorization ? Promise.resolve({ userId: 'user-1', email: 'olena@example.test' }) : Promise.reject(new Error('missing'))) };
    const app = await buildApp({ config, services: { authVerifier: verifier } });
    app.get('/private', { preHandler: app.requireUser }, async (request) => ({ user: request.user }));

    const missing = await app.inject({ method: 'GET', url: '/private' });
    expect(missing.statusCode).toBe(401);
    const valid = await app.inject({
      method: 'GET',
      url: '/private?userId=spoofed',
      headers: { authorization: 'Bearer token' },
    });
    expect(valid.statusCode).toBe(200);
    expect(valid.json()).toEqual({ user: { userId: 'user-1', email: 'olena@example.test' } });
    await app.close();
  });
});
