import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { type GatewayConfig } from './config.js';
import { requestContext } from './plugins/requestContext.js';

export interface GatewayServices {
  readonly [name: string]: unknown;
}

export interface GatewayAppOptions {
  config: GatewayConfig;
  services: GatewayServices;
  rateLimit?: {
    max: number;
    timeWindow: string;
  };
}

export async function buildApp({
  config,
  services: _services,
  rateLimit: rateLimitOptions,
}: GatewayAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    requestIdHeader: 'x-request-id',
    trustProxy: config.trustProxy,
  });

  await app.register(cors, {
    origin(origin, callback) {
      callback(null, origin === config.publicWebOrigin);
    },
  });
  await app.register(rateLimit, rateLimitOptions ?? { max: 120, timeWindow: '1 minute' });
  await requestContext(app);

  app.get('/health', { config: { rateLimit: false } }, async () => ({ status: 'ok', service: 'vector-gateway' }));

  return app;
}
