import type { JobRecord, JobRepository } from './jobRepository.js';

export type JobHandler = (job: JobRecord) => Promise<void>;

/** Routes server-owned jobs to their domain handler. Unknown job types fail closed. */
export function createAppJobHandler(handlers: {
  calendar: JobHandler;
  notification?: JobHandler;
}): JobHandler {
  return async (job) => {
    if (job.type.startsWith('calendar.')) return handlers.calendar(job);
    if (job.type.startsWith('telegram.notification.')) {
      if (!handlers.notification) throw new Error('NOTIFICATION_HANDLER_UNAVAILABLE');
      return handlers.notification(job);
    }
    throw new Error('UNKNOWN_JOB');
  };
}

/** Dispatches Calendar background jobs without letting untrusted webhook payloads choose ownership. */
export function createCalendarJobHandler(deps: {
  watchService?: { renew(user: { userId: string; email: string }, calendarId?: string): Promise<unknown> };
  reconcileService?: { reconcile(user: { userId: string; email: string }, input: { calendarId: string; googleEventId: string; version?: string }): Promise<unknown>; reconcileWatch?(user: { userId: string; email: string }, input: { calendarId: string }): Promise<unknown> };
  resolveUser: (userId: string) => Promise<{ userId: string; email: string } | null>;
}): JobHandler {
  return async (job) => {
    const payload = job.payloadJson && typeof job.payloadJson === 'object' ? job.payloadJson as Record<string, unknown> : {};
    const userId = typeof job.user === 'string' ? job.user : typeof payload.userId === 'string' ? payload.userId : '';
    if (!userId) throw new Error('JOB_OWNER_REQUIRED');
    const user = await deps.resolveUser(userId);
    if (!user || user.userId !== userId) throw new Error('JOB_OWNER_UNAVAILABLE');
    if (job.type === 'calendar.watch.renew') {
      if (!deps.watchService || typeof payload.calendarId !== 'string') throw new Error('CALENDAR_WATCH_HANDLER_UNAVAILABLE');
      await deps.watchService.renew(user, payload.calendarId);
      return;
    }
    if (job.type === 'calendar.reconcile') {
      if (!deps.reconcileService || typeof payload.calendarId !== 'string') throw new Error('CALENDAR_RECONCILE_HANDLER_UNAVAILABLE');
      if (!deps.reconcileService.reconcileWatch) throw new Error('CALENDAR_RECONCILE_SYNC_UNAVAILABLE');
      await deps.reconcileService.reconcileWatch(user, { calendarId: payload.calendarId });
      return;
    }
    throw new Error('UNKNOWN_CALENDAR_JOB');
  };
}

export function createJobRunner(options: {
  repository: Pick<JobRepository, 'claim' | 'complete' | 'fail'>;
  handler: JobHandler;
  owner: string;
  now?: () => number;
  leaseMs?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
}): { runOnce(): Promise<boolean> } {
  const now = options.now ?? (() => Date.now());
  const leaseMs = Math.min(Math.max(options.leaseMs ?? 30_000, 1_000), 300_000);
  const maxAttempts = Math.min(Math.max(options.maxAttempts ?? 5, 1), 10);
  const baseDelayMs = Math.min(Math.max(options.baseDelayMs ?? 1_000, 100), 300_000);
  return {
    async runOnce() {
      const job = await options.repository.claim(options.owner, new Date(now()).toISOString(), leaseMs);
      if (!job) return false;
      try {
        await options.handler(job);
        await options.repository.complete(job.id, options.owner);
      } catch (error) {
        const attempts = Number(job.attempts ?? 0) + 1;
        const delay = Math.min(baseDelayMs * 2 ** Math.max(0, attempts - 1), 300_000);
        await options.repository.fail(job.id, options.owner, {
          status: attempts >= maxAttempts ? 'failed' : 'pending',
          nextRunAt: new Date(now() + delay).toISOString(),
          lastError: error instanceof Error ? error.message.slice(0, 500) : 'JOB_FAILED',
        });
      }
      return true;
    },
  };
}
