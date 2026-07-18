import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { type GatewayConfig } from './config.js';
import { requestContext } from './plugins/requestContext.js';
import { makeRequireUser } from './auth/requireUser.js';
import { createPocketBaseTokenVerifier, type PocketBaseTokenVerifier } from './auth/verifyPocketBaseToken.js';
import { createCaptureService } from './modules/capture/captureService.js';
import { captureRoutes } from './modules/capture/captureRoutes.js';
import type { BrainDumpRepository } from './repositories/brainDumpRepository.js';
import { analysisRoutes } from './modules/ai/analysisRoutes.js';
import { createAnalysisService, type AnalysisService } from './modules/ai/analyzeBrainDump.js';
import type { AnalysisSessionRepository } from './modules/ai/analyzeBrainDump.js';
import type { AnalysisAiClient } from './modules/ai/geminiClient.js';

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
  const verifier = (_services.authVerifier as PocketBaseTokenVerifier | undefined) ?? createPocketBaseTokenVerifier({ baseUrl: config.pocketbaseUrl });
  app.decorate('requireUser', makeRequireUser(verifier));

  app.get('/health', { config: { rateLimit: false } }, async () => ({ status: 'ok', service: 'vector-gateway' }));

  const brainDumpRepository = _services.brainDumpRepository as BrainDumpRepository | undefined;
  const captureService = _services.captureService as ReturnType<typeof createCaptureService> | undefined;
  if (captureService || brainDumpRepository) {
    await captureRoutes(app, captureService ?? createCaptureService(brainDumpRepository!, { maxTextLength: Number(_services.captureMaxTextLength) || 20_000 }));
  }
  const analysisService = _services.analysisService as AnalysisService | undefined;
  if (analysisService) await analysisRoutes(app, analysisService);
  else if (brainDumpRepository && _services.analysisSessionRepository && _services.aiClient) {
    await analysisRoutes(app, createAnalysisService(brainDumpRepository, _services.analysisSessionRepository as AnalysisSessionRepository, _services.aiClient as AnalysisAiClient));
  }

  return app;
}
