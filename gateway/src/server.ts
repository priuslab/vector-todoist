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
import { createCalendarEventLinkRepository, createCalendarEventService, createGoogleCalendarEventProvider } from './modules/calendar/calendarEventService.js';
import { createJobRepository } from './modules/jobs/jobRepository.js';
import { createCalendarWatchRepository, createCalendarWatchService } from './integrations/google/calendarWatch.js';
import { createCalendarReconcileService } from './modules/calendar/calendarReconcileService.js';

async function start(): Promise<void> {
  const config = loadConfig();
  const pocketBase = createPocketBaseClient({ baseUrl: config.pocketbaseUrl });
  const workerPocketBase = config.pocketbaseServerToken && pocketBase.withToken ? pocketBase.withToken(config.pocketbaseServerToken) : pocketBase;
  const brainDumpRepository = createBrainDumpRepository(pocketBase);
  const calendarConnectionRepository = createCalendarConnectionRepository(pocketBase);
  const workerCalendarConnectionRepository = createCalendarConnectionRepository(workerPocketBase);
  const calendarBusySlotRepository = createCalendarBusySlotRepository(pocketBase);
  const jobRepository = config.pocketbaseServerToken ? createJobRepository(pocketBase, { serverToken: config.pocketbaseServerToken }) : undefined;
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
    ...(jobRepository ? { jobRepository } : {}),
    ...(googleOAuthService ? { googleOAuthService } : {}),
    ...(googleOAuthService && config.googleClientId && config.googleClientSecret && config.googleTokenEncryptionKey ? {
      busySlotService: createBusySlotService({
        connectionRepository: calendarConnectionRepository,
        busySlotRepository: calendarBusySlotRepository,
        googleCalendarClient: createGoogleCalendarClient({ clientId: config.googleClientId, clientSecret: config.googleClientSecret, encryptionKey: config.googleTokenEncryptionKey }),
      }),
      calendarEventService: config.pocketbaseServerToken && jobRepository ? createCalendarEventService({
        linkRepository: createCalendarEventLinkRepository(pocketBase),
        jobRepository,
        taskRepository: createTaskRepository(pocketBase),
        provider: createGoogleCalendarEventProvider({ connectionRepository: calendarConnectionRepository, googleCalendarClient: createGoogleCalendarClient({ clientId: config.googleClientId, clientSecret: config.googleClientSecret, encryptionKey: config.googleTokenEncryptionKey }) }),
        calendarId: 'primary',
      }) : undefined,
      ...(config.pocketbaseServerToken && jobRepository ? (() => {
        const googleCalendarClient = createGoogleCalendarClient({ clientId: config.googleClientId!, clientSecret: config.googleClientSecret!, encryptionKey: config.googleTokenEncryptionKey!, callbackUrl: config.googleWebhookUrl! });
        const watchRepository = createCalendarWatchRepository(workerPocketBase);
        const watchService = createCalendarWatchService({ repository: watchRepository, connectionRepository: workerCalendarConnectionRepository, provider: { watch: (input) => googleCalendarClient.watchCalendar(input), stop: (input) => googleCalendarClient.stopWatch(input) }, jobRepository });
        const taskRepository = createTaskRepository(workerPocketBase);
        const eventLinkRepository = createCalendarEventLinkRepository(workerPocketBase);
        const reconcileService = createCalendarReconcileService({ linkRepository: eventLinkRepository as never, taskRepository, changeSetRepository: createChangeSetRepository(workerPocketBase), connectionRepository: workerCalendarConnectionRepository, googleCalendarClient: { getEvent: (input) => googleCalendarClient.getEvent(input as Parameters<typeof googleCalendarClient.getEvent>[0]).then((event) => event && event.id ? event as never : null) }, listEvents: (input) => googleCalendarClient.listEvents(input as Parameters<typeof googleCalendarClient.listEvents>[0]).then((events) => events.filter((event) => typeof event.id === 'string') as never) });
        return { calendarWatchService: watchService, calendarReconcileService: reconcileService };
      })() : {}),
    } : {}),
  } });

  await app.listen({ host: config.host, port: config.port });
}

start().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
