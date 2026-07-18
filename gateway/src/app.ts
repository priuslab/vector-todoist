import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { type GatewayConfig } from './config.js';
import { requestContext } from './plugins/requestContext.js';

export interface GatewayServices {
  readonly [name: string]: unknown;
}

export async function buildApp({
  config: _config,
  services: _services,
}: {
  config: GatewayConfig;
  services: GatewayServices;
}): Promise<FastifyInstance> {
  const app = Fastify({
    requestIdHeader: 'x-request-id',
    trustProxy: _config.trustProxy,
  });

  await app.register(cors, {
    origin(origin, callback) {
      callback(null, origin === _config.publicWebOrigin);
    },
  });
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  await requestContext(app);

  app.get('/health', { config: { rateLimit: false } }, async () => ({ status: 'ok', service: 'vector-gateway' }));

  return app;
}
