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
import { planRoutes } from './modules/planning/planRoutes.js';
import { createPlanService, type PlanService } from './modules/planning/planService.js';
import type { TaskRepository } from './repositories/taskRepository.js';
import type { IdeaRepository } from './repositories/ideaRepository.js';
import type { ChangeSetRepository } from './repositories/changeSetRepository.js';
import { transcriptionRoutes } from './modules/transcription/transcriptionRoutes.js';
import { createGeminiTranscriptionAdapter, createTranscriptionService } from './modules/transcription/transcriptionService.js';
import { createAudioStorage } from './modules/transcription/audioStorage.js';
import { taskRoutes } from './modules/tasks/taskRoutes.js';
import { createTaskService } from './modules/tasks/taskService.js';
import { changeSetRoutes } from './modules/changeSets/changeSetRoutes.js';
import { createUndoService } from './modules/changeSets/undoService.js';

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
  const voiceMaxBytes = config.voiceMaxBytes ?? 15_000_000;
  const app = Fastify({
    requestIdHeader: 'x-request-id',
    trustProxy: config.trustProxy,
    // Leave room for multipart headers while remaining bounded by config.
    bodyLimit: Math.min(Math.max(voiceMaxBytes + 1_048_576, 1_048_576), 26_000_000),
  });
  app.addContentTypeParser(/^(audio\/.+|multipart\/form-data)(?:;.*)?$/, { parseAs: 'buffer' }, (_request, body, done) => done(null, body));

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
  const transcriptionService = _services.transcriptionService as ReturnType<typeof createTranscriptionService> | undefined
    ?? (_services.transcriptionAdapter
      ? createTranscriptionService(_services.transcriptionAdapter as Parameters<typeof createTranscriptionService>[0], createAudioStorage())
      : config.geminiApiKey
        ? createTranscriptionService(createGeminiTranscriptionAdapter({ apiKey: config.geminiApiKey, model: config.geminiModel, timeoutMs: config.aiTimeoutMs }), createAudioStorage(), {
          maxBytes: config.voiceMaxBytes,
          maxDurationSeconds: config.voiceMaxDurationSeconds,
          timeoutMs: config.voiceTranscriptionTimeoutMs,
        })
        : undefined);
  if (transcriptionService) await transcriptionRoutes(app, transcriptionService);
  const analysisService = (_services.analysisService as AnalysisService | undefined) ?? (brainDumpRepository && _services.analysisSessionRepository && _services.aiClient
    ? createAnalysisService(brainDumpRepository, _services.analysisSessionRepository as AnalysisSessionRepository, _services.aiClient as AnalysisAiClient)
    : undefined);
  if (analysisService) await analysisRoutes(app, analysisService);
  const planService = _services.planService as PlanService | undefined;
  if (planService) await planRoutes(app, planService);
  else if (brainDumpRepository && analysisService && _services.taskRepository && _services.ideaRepository && _services.changeSetRepository) {
    await planRoutes(app, createPlanService({
      dumpRepository: brainDumpRepository,
      analysisService,
      taskRepository: _services.taskRepository as TaskRepository,
      ideaRepository: _services.ideaRepository as IdeaRepository,
      changeSetRepository: _services.changeSetRepository as ChangeSetRepository,
    }));
  }

  const taskRepository = _services.taskRepository as TaskRepository | undefined;
  const changeSetRepository = _services.changeSetRepository as ChangeSetRepository | undefined;
  if (taskRepository && changeSetRepository) {
    await taskRoutes(app, createTaskService({ taskRepository, changeSetRepository }));
    await changeSetRoutes(app, createUndoService({ taskRepository, changeSetRepository }));
  }

  return app;
}
