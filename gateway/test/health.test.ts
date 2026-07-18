import { describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

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

describe('GET /health', () => {
  it('returns the public gateway health payload', async () => {
    const app = await buildApp({ config, services: {} });

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', service: 'vector-gateway' });

    await app.close();
  });

  it('does not expose configuration secrets', async () => {
    const app = await buildApp({
      config: { ...config, pocketbaseUrl: 'https://secret.example.test/hidden' },
      services: {},
    });

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.body).not.toContain('secret.example.test');
    expect(response.body).not.toContain('hidden');

    await app.close();
  });

  it('allows requests from the configured web origin', async () => {
    const app = await buildApp({ config, services: {} });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: config.publicWebOrigin },
    });

    expect(response.headers['access-control-allow-origin']).toBe(config.publicWebOrigin);

    await app.close();
  });

  it('does not allow CORS access from an unconfigured origin', async () => {
    const app = await buildApp({ config, services: {} });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://untrusted.example.test' },
    });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();

    await app.close();
  });

  it('matches the browser Origin against a canonicalized configured origin', async () => {
    const canonicalConfig = loadConfig({
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT: '8787',
      PUBLIC_WEB_ORIGIN: 'https://app.vector.test/plans/today',
      POCKETBASE_URL: 'http://127.0.0.1:8090',
    });
    const app = await buildApp({ config: canonicalConfig, services: {} });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://app.vector.test' },
    });

    expect(response.headers['access-control-allow-origin']).toBe('https://app.vector.test');

    await app.close();
  });

  it('propagates the Fastify request ID in every response', async () => {
    const app = await buildApp({ config, services: {} });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'request-from-client' },
    });

    expect(response.headers['x-request-id']).toBe('request-from-client');

    await app.close();
  });

  it('generates a request ID when the client does not provide one', async () => {
    const app = await buildApp({ config, services: {} });

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.headers['x-request-id']).toEqual(expect.any(String));
    expect(response.headers['x-request-id']).not.toHaveLength(0);

    await app.close();
  });

  it('registers the rate-limit plugin', async () => {
    const app = await buildApp({ config, services: {} });

    expect(app.hasPlugin('@fastify/rate-limit')).toBe(true);

    await app.close();
  });

  it('enforces the global rate limit for a non-exempt composed route', async () => {
    const app = await buildApp({
      config,
      services: {},
      rateLimit: { max: 1, timeWindow: '1 minute' },
    });
    app.get('/rate-limit-probe', async () => ({ ok: true }));

    const firstResponse = await app.inject({ method: 'GET', url: '/rate-limit-probe' });
    const limitedResponse = await app.inject({ method: 'GET', url: '/rate-limit-probe' });

    expect(firstResponse.statusCode).toBe(200);
    expect(limitedResponse.statusCode).toBe(429);

    await app.close();
  });
});
