import type { VerifiedUser } from '../../auth/verifyPocketBaseToken.js';
import type { JobRepository } from '../jobs/jobRepository.js';
import type { TaskRecord, TaskRepository } from '../../repositories/taskRepository.js';
import type { PocketBaseClient } from '../../pocketbase/client.js';
import { createOwned, updateOwned } from '../../repositories/base.js';
import type { CalendarConnectionRepository } from '../../integrations/google/googleOAuth.js';
import type { GoogleCalendarClient } from '../../integrations/google/calendarClient.js';
import { createHash } from 'node:crypto';

export type CalendarEventLink = {
  id: string;
  user: string;
  taskId: string;
  calendarId: string;
  googleEventId?: string;
  idempotencyKey: string;
  status: 'pending' | 'synced' | 'sync_pending' | 'attention' | 'unscheduled';
  lastError?: string;
};

export interface CalendarEventLinkRepository {
  getByTask(user: VerifiedUser, taskId: string): Promise<CalendarEventLink | null>;
  getByIdempotencyKey(user: VerifiedUser, key: string): Promise<CalendarEventLink | null>;
  create(user: VerifiedUser, input: Omit<CalendarEventLink, 'id' | 'user'>): Promise<CalendarEventLink>;
  update(user: VerifiedUser, id: string, input: Partial<CalendarEventLink>): Promise<CalendarEventLink>;
}

export function createCalendarEventLinkRepository(client: PocketBaseClient): CalendarEventLinkRepository {
  const scoped = (user: VerifiedUser) => user.token && client.withToken ? client.withToken(user.token) : client;
  return {
    async getByTask(user, taskId) { const rows = await scoped(user).list<CalendarEventLink>('calendar_event_links', `user = '${user.userId}' && taskId = '${taskId}'`); return rows[0] ?? null; },
    async getByIdempotencyKey(user, key) { const rows = await scoped(user).list<CalendarEventLink>('calendar_event_links', `user = '${user.userId}' && idempotencyKey = '${key}'`); return rows[0] ?? null; },
    create: (user, input) => createOwned<CalendarEventLink>(client, 'calendar_event_links', user, input),
    update: (user, id, input) => updateOwned<CalendarEventLink>(client, 'calendar_event_links', user, id, input),
  };
}

export type CalendarCreateEventInput = {
  user?: VerifiedUser;
  calendarId: string;
  idempotencyKey: string;
  summary: string;
  start: string;
  end: string;
  taskId: string;
  eventId?: string;
};

export interface CalendarEventProvider {
  validateUser?(user: VerifiedUser): Promise<void>;
  createEvent(input: CalendarCreateEventInput): Promise<{ id: string; status?: string }>;
  deleteEvent?(input: { calendarId: string; googleEventId: string }): Promise<void>;
}

export class CalendarEventNotFoundError extends Error { readonly code = 'NOT_FOUND'; }

export function createGoogleCalendarEventProvider(deps: { connectionRepository: CalendarConnectionRepository; googleCalendarClient: GoogleCalendarClient }): CalendarEventProvider {
  return {
    async validateUser(user) { const connection = await deps.connectionRepository.get(user); if (!connection || connection.user !== user.userId || connection.status !== 'connected') throw new Error('CALENDAR_RECONNECT_REQUIRED'); },
    async createEvent(input) {
      if (!input.user) throw new Error('CALENDAR_USER_REQUIRED');
      const connection = await deps.connectionRepository.get(input.user);
      if (!connection || connection.user !== input.user.userId || connection.status !== 'connected') throw new Error('CALENDAR_RECONNECT_REQUIRED');
      return deps.googleCalendarClient.createEvent({ connection, calendarId: input.calendarId, summary: input.summary, start: input.start, end: input.end, idempotencyKey: input.idempotencyKey, eventId: input.eventId! });
    },
  };
}

export interface CalendarEventService {
  syncTask(user: VerifiedUser, taskId: string): Promise<CalendarEventLink>;
  markMissingEvent(user: VerifiedUser, taskId: string): Promise<CalendarEventLink>;
}

const eventKey = (userId: string, task: TaskRecord) => `calendar:create:${userId}:${task.id}:${String(task.plannedStart ?? '')}:${String(task.plannedEnd ?? '')}`;
const eventIdFor = (key: string) => createHash('sha256').update(key).digest('hex').slice(0, 40);
const inFlight = new Map<string, Promise<{ id: string; status?: string }>>();

/** Coordinates local task state, event links, and an outbox job before calling Google. */
export function createCalendarEventService(deps: {
  linkRepository: CalendarEventLinkRepository;
  jobRepository: Pick<JobRepository, 'getByIdempotencyKey' | 'create'> & Partial<Pick<JobRepository, 'complete'>>;
  taskRepository: Pick<TaskRepository, 'get' | 'update'>;
  provider: CalendarEventProvider;
  calendarId: string;
}): CalendarEventService {
  const { linkRepository, jobRepository, taskRepository, provider, calendarId } = deps;
  return {
    async syncTask(user, taskId) {
      const task = await taskRepository.get(user, taskId);
      if (!task || task.user !== user.userId) throw new CalendarEventNotFoundError();
      if (!task.plannedStart || !task.plannedEnd) throw new Error('TASK_NOT_SCHEDULED');
      const key = eventKey(user.userId, task);
      if (provider.validateUser) await provider.validateUser(user);
      let link = await linkRepository.getByTask(user, taskId);
      if (link?.status === 'synced' && link.googleEventId) return link;
      if (!link) {
        try { link = await linkRepository.create(user, { taskId, calendarId, idempotencyKey: key, status: 'pending' }); }
        catch { link = await linkRepository.getByIdempotencyKey(user, key) ?? await linkRepository.getByTask(user, taskId); if (!link) throw new Error('CALENDAR_LINK_UNAVAILABLE'); }
      }
      if (!await jobRepository.getByIdempotencyKey(user, key)) {
        try { await jobRepository.create(user, { type: 'calendar.create', idempotencyKey: key, payloadJson: { taskId, linkId: link.id, calendarId }, status: 'pending', attempts: 0, nextRunAt: new Date().toISOString() }); } catch { /* another worker reserved the same idempotency key */ }
      }
      await taskRepository.update(user, taskId, { syncStatus: 'sync_pending', calendarEventId: link.googleEventId ?? null });
      try {
        const request = inFlight.get(key) ?? provider.createEvent({ user, calendarId, idempotencyKey: key, eventId: eventIdFor(key), taskId, summary: String(task.title ?? 'Задача'), start: String(task.plannedStart), end: String(task.plannedEnd) });
        if (!inFlight.has(key)) inFlight.set(key, request);
        let event: { id: string; status?: string };
        try { event = await request; } finally { if (inFlight.get(key) === request) inFlight.delete(key); }
        link = await linkRepository.update(user, link.id, { googleEventId: event.id, status: 'synced', lastError: '' });
        await taskRepository.update(user, taskId, { syncStatus: 'synced', calendarEventId: event.id });
        if (jobRepository.complete) await jobRepository.complete((await jobRepository.getByIdempotencyKey(user, key))?.id ?? '', 'inline');
        return link;
      } catch (error) {
        await linkRepository.update(user, link.id, { status: 'sync_pending', lastError: error instanceof Error ? error.message.slice(0, 500) : 'CALENDAR_UNAVAILABLE' });
        await taskRepository.update(user, taskId, { syncStatus: 'sync_pending' });
        throw error;
      }
    },
    async markMissingEvent(user, taskId) {
      const task = await taskRepository.get(user, taskId);
      if (!task || task.user !== user.userId) throw new CalendarEventNotFoundError();
      const link = await linkRepository.getByTask(user, taskId);
      if (!link) throw new CalendarEventNotFoundError();
      const updated = await linkRepository.update(user, link.id, { status: 'attention', lastError: 'GOOGLE_EVENT_MISSING' });
      await taskRepository.update(user, taskId, { status: 'needs_reschedule', syncStatus: 'attention', plannedStart: null, plannedEnd: null, calendarEventId: null });
      return updated;
    },
  };
}
