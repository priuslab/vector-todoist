import { createAppJobHandler, createCalendarJobHandler, createJobRunner } from './modules/jobs/jobRunner.js';
import type { JobHandler } from './modules/jobs/jobRunner.js';
import type { JobRepository } from './modules/jobs/jobRepository.js';
import { loadConfig } from './config.js';
import { createPocketBaseClient } from './pocketbase/client.js';
import { createJobRepository } from './modules/jobs/jobRepository.js';
import { createCalendarConnectionRepository } from './repositories/calendarConnectionRepository.js';
import { createCalendarWatchRepository, createCalendarWatchService } from './integrations/google/calendarWatch.js';
import { createGoogleCalendarClient } from './integrations/google/calendarClient.js';
import { createCalendarEventLinkRepository } from './modules/calendar/calendarEventService.js';
import { createTaskRepository } from './repositories/taskRepository.js';
import { createChangeSetRepository } from './repositories/changeSetRepository.js';
import { createCalendarReconcileService } from './modules/calendar/calendarReconcileService.js';
import { createTelegramClient } from './integrations/telegram/telegramClient.js';
import { createPocketBaseNotificationClaimStore, createTelegramNotificationJobHandler } from './modules/notifications/notificationJobs.js';

/** VPS worker entrypoint factory. The caller supplies server-token repositories/services. */
export function createCalendarWorker(options: {
  repository: Pick<JobRepository, 'claim' | 'complete' | 'fail'>;
  resolveUser: (userId: string) => Promise<{ userId: string; email: string } | null>;
  watchService: { renew(user: { userId: string; email: string }, calendarId?: string): Promise<unknown> };
  reconcileService: { reconcile(user: { userId: string; email: string }, input: { calendarId: string; googleEventId: string; version?: string }): Promise<unknown>; reconcileWatch?(user: { userId: string; email: string }, input: { calendarId: string }): Promise<unknown> };
  notificationHandler?: JobHandler;
  owner: string;
  pollMs?: number;
}) {
  const runner = createJobRunner({ repository: options.repository, owner: options.owner, handler: createAppJobHandler({ calendar: createCalendarJobHandler({ resolveUser: options.resolveUser, watchService: options.watchService, reconcileService: options.reconcileService }), notification: options.notificationHandler }) });
  let timer: ReturnType<typeof setInterval> | undefined;
  return {
    runOnce: () => runner.runOnce(),
    start() { if (!timer) timer = setInterval(() => { void runner.runOnce(); }, Math.max(1_000, options.pollMs ?? 5_000)); return () => { if (timer) clearInterval(timer); timer = undefined; }; },
  };
}

export async function start(): Promise<() => void> {
  const config = loadConfig();
  if (!config.pocketbaseServerToken || !config.googleClientId || !config.googleClientSecret || !config.googleTokenEncryptionKey || !config.googleWebhookUrl) throw new Error('Worker requires PocketBase server token and Google integration configuration');
  const base = createPocketBaseClient({ baseUrl: config.pocketbaseUrl });
  const client = base.withToken ? base.withToken(config.pocketbaseServerToken) : base;
  const jobs = createJobRepository(base, { serverToken: config.pocketbaseServerToken });
  const connections = createCalendarConnectionRepository(client);
  const watchRepo = createCalendarWatchRepository(client);
  const google = createGoogleCalendarClient({ clientId: config.googleClientId, clientSecret: config.googleClientSecret, encryptionKey: config.googleTokenEncryptionKey, callbackUrl: config.googleWebhookUrl });
  const watch = createCalendarWatchService({ repository: watchRepo, connectionRepository: connections, provider: { watch: (input) => google.watchCalendar(input), stop: (input) => google.stopWatch(input) }, jobRepository: jobs });
  const reconcile = createCalendarReconcileService({ linkRepository: createCalendarEventLinkRepository(client) as never, taskRepository: createTaskRepository(client), changeSetRepository: createChangeSetRepository(client), connectionRepository: connections, googleCalendarClient: { getEvent: (input) => google.getEvent(input as Parameters<typeof google.getEvent>[0]).then((event) => event && event.id ? event as never : null) }, listEvents: (input) => google.listEvents(input as Parameters<typeof google.listEvents>[0]).then((events) => events.filter((event) => typeof event.id === 'string') as never) });
  const notificationHandler = config.enableTelegramIntegration && config.telegramBotToken
    ? createTelegramNotificationJobHandler({ telegram: createTelegramClient({ botToken: config.telegramBotToken }), claims: createPocketBaseNotificationClaimStore(client) })
    : undefined;
  const worker = createCalendarWorker({ repository: jobs, owner: `worker-${process.pid}`, resolveUser: async (userId) => { const rows = await client.list<{ id: string; email?: string }>('users', `id = '${userId.replaceAll("'", "\\'")}'`); const record = rows[0]; return record ? { userId, email: record.email ?? '' } : null; }, watchService: watch, reconcileService: reconcile, notificationHandler });
  const stop = worker.start();
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
  return stop;
}

if (process.argv[1]?.endsWith('/worker.js')) start().catch((error) => { console.error(error instanceof Error ? error.message : 'Worker failed to start'); process.exitCode = 1; });
