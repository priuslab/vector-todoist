import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createPocketBaseClient } from './pocketbase/client.js';
import { createBrainDumpRepository } from './repositories/brainDumpRepository.js';
import { createCaptureService } from './modules/capture/captureService.js';
import { createAnalysisSessionRepository, createAnalysisService } from './modules/ai/analyzeBrainDump.js';
import { createGeminiClient } from './modules/ai/geminiClient.js';
import { createTaskRepository } from './repositories/taskRepository.js';
import { createIdeaRepository } from './repositories/ideaRepository.js';
import { createChangeSetRepository } from './repositories/changeSetRepository.js';
import { createCalendarConnectionRepository } from './repositories/calendarConnectionRepository.js';
import { createGoogleOAuthService } from './integrations/google/googleOAuth.js';
import { createGoogleCalendarClient } from './integrations/google/calendarClient.js';
import { createCalendarBusySlotRepository } from './repositories/calendarBusySlotRepository.js';
import { createBusySlotService } from './modules/calendar/busySlotService.js';

async function start(): Promise<void> {
  const config = loadConfig();
  const pocketBase = createPocketBaseClient({ baseUrl: config.pocketbaseUrl });
  const brainDumpRepository = createBrainDumpRepository(pocketBase);
  const calendarConnectionRepository = createCalendarConnectionRepository(pocketBase);
  const calendarBusySlotRepository = createCalendarBusySlotRepository(pocketBase);
  const googleOAuthService = config.enableGoogleIntegration && config.googleClientId && config.googleClientSecret && config.googleOAuthRedirectUri && config.googleTokenEncryptionKey
    ? createGoogleOAuthService({ clientId: config.googleClientId, clientSecret: config.googleClientSecret, redirectUri: config.googleOAuthRedirectUri, encryptionKey: config.googleTokenEncryptionKey, repository: calendarConnectionRepository })
    : undefined;
  const app = await buildApp({ config, services: {
    pocketBase,
    brainDumpRepository,
    captureService: createCaptureService(brainDumpRepository, { maxTextLength: config.brainDumpMaxTextLength }),
    analysisSessionRepository: createAnalysisSessionRepository(pocketBase),
    aiClient: createGeminiClient({ apiKey: config.geminiApiKey, model: config.geminiModel, timeoutMs: config.aiTimeoutMs }),
    taskRepository: createTaskRepository(pocketBase),
    ideaRepository: createIdeaRepository(pocketBase),
    changeSetRepository: createChangeSetRepository(pocketBase),
    ...(googleOAuthService ? { googleOAuthService } : {}),
    ...(googleOAuthService && config.googleClientId && config.googleClientSecret && config.googleTokenEncryptionKey ? {
      busySlotService: createBusySlotService({
        connectionRepository: calendarConnectionRepository,
        busySlotRepository: calendarBusySlotRepository,
        googleCalendarClient: createGoogleCalendarClient({ clientId: config.googleClientId, clientSecret: config.googleClientSecret, encryptionKey: config.googleTokenEncryptionKey }),
      }),
    } : {}),
  } });

  await app.listen({ host: config.host, port: config.port });
}

start().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
