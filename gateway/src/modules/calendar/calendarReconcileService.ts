import type { VerifiedUser } from '../../auth/verifyPocketBaseToken.js';
import type { CalendarConnectionRepository } from '../../integrations/google/googleOAuth.js';
import type { ChangeSetRepository } from '../../repositories/changeSetRepository.js';
import type { TaskRepository, TaskRecord } from '../../repositories/taskRepository.js';
import type { CalendarEventLink, CalendarEventLinkRepository, CalendarEventService } from './calendarEventService.js';

export type ReconcileEvent = {
  id: string;
  status?: string;
  etag?: string;
  updated?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string | undefined> };
};

export interface CalendarReconcileClient {
  getEvent(input: { connection: unknown; calendarId: string; googleEventId: string }): Promise<ReconcileEvent | null>;
}

type LinkRepository = Pick<CalendarEventLinkRepository, 'update'> & {
  getByGoogleEvent(user: VerifiedUser, calendarId: string, googleEventId: string): Promise<CalendarEventLink | null>;
  listByCalendar?(user: VerifiedUser, calendarId: string): Promise<CalendarEventLink[]>;
};

export class CalendarReconcileUnavailableError extends Error {
  readonly code = 'CALENDAR_RECONCILE_UNAVAILABLE';
  constructor() { super('Google Calendar reconciliation unavailable'); }
}

export class CalendarReconcileNotFoundError extends Error {
  readonly code = 'CALENDAR_EVENT_NOT_FOUND';
  constructor() { super('Calendar event link not found'); }
}

const iso = (value?: string) => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
};

const eventTimes = (event: ReconcileEvent) => ({ start: iso(event.start?.dateTime ?? event.start?.date), end: iso(event.end?.dateTime ?? event.end?.date) });
const privateValue = (event: Partial<ReconcileEvent>, key: string) => event.extendedProperties?.private?.[key];

/** Applies provider changes to an owned task, recording a reversible, idempotent Change Set. */
export function createCalendarReconcileService(deps: {
  linkRepository: LinkRepository;
  taskRepository: Pick<TaskRepository, 'get' | 'update'>;
  changeSetRepository: Pick<ChangeSetRepository, 'get' | 'list' | 'create' | 'update'>;
  connectionRepository: CalendarConnectionRepository;
  googleCalendarClient: CalendarReconcileClient;
  listEvents?: (input: { connection: unknown; calendarId: string }) => Promise<ReconcileEvent[]>;
  calendarEventService?: Pick<CalendarEventService, 'markMissingEvent'>;
  now?: () => number;
}) {
  const now = deps.now ?? (() => Date.now());
  const reservations = new Map<string, Promise<void>>();

  async function reserve(user: VerifiedUser, key: string, input: Record<string, unknown>) {
    const previous = reservations.get(key);
    if (previous) await previous;
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    reservations.set(key, current);
    try {
      const found = (await deps.changeSetRepository.list(user)).find((change) => change.idempotencyKey === key);
      return found ?? await deps.changeSetRepository.create(user, input);
    } finally {
      release();
      if (reservations.get(key) === current) reservations.delete(key);
    }
  }

  async function reconcile(user: VerifiedUser, input: { calendarId: string; googleEventId: string; version?: string; event?: ReconcileEvent | null }) {
    const link = await deps.linkRepository.getByGoogleEvent(user, input.calendarId, input.googleEventId);
    if (!link || link.user !== user.userId || link.calendarId !== input.calendarId || link.googleEventId !== input.googleEventId) throw new CalendarReconcileNotFoundError();
    const task = await deps.taskRepository.get(user, link.taskId);
    if (!task || task.user !== user.userId) throw new CalendarReconcileNotFoundError();
    const connection = await deps.connectionRepository.get(user);
    if (!connection || connection.status !== 'connected') throw new CalendarReconcileUnavailableError();
    let event: ReconcileEvent | null;
    try { event = input.event === undefined ? await deps.googleCalendarClient.getEvent({ connection, calendarId: input.calendarId, googleEventId: input.googleEventId }) : input.event; }
    catch { throw new CalendarReconcileUnavailableError(); }

    const version = String(input.version ?? event?.etag ?? event?.updated ?? '');
    const key = `calendar.reconcile.apply:${user.userId}:${link.taskId}:${input.googleEventId}:${version || 'missing'}`;
    const existing = (await deps.changeSetRepository.list(user)).find((change) => change.idempotencyKey === key);
    if (existing?.status === 'applied') return { status: 'ignored' as const, task, changeSet: existing };

    // Google sends an echo after Vector creates/updates an event. If the version we
    // last acknowledged is unchanged, there is no user change to apply.
    const previousVersion = (link as CalendarEventLink & { providerVersion?: string }).providerVersion;
    const origin = privateValue(event ?? {}, 'vectorOrigin') ?? privateValue(event ?? {}, 'origin');
    if (event && origin === 'vector' && previousVersion && previousVersion === version) {
      return { status: 'ignored' as const, task, changeSet: existing ?? null };
    }

    const before = { id: task.id, plannedStart: task.plannedStart ?? null, plannedEnd: task.plannedEnd ?? null, syncStatus: task.syncStatus ?? null, calendarEventId: task.calendarEventId ?? link.googleEventId };
    if (!event || event.status === 'cancelled') {
      const after = { ...before, plannedStart: null, plannedEnd: null, syncStatus: 'attention', calendarEventId: null, status: 'needs_reschedule' };
      let change = existing;
      if (!change) change = await reserve(user, key, { kind: 'calendar_reconcile', status: 'pending', idempotencyKey: key, taskId: task.id, beforeJson: before, afterJson: after });
      if (change.status !== 'applied') {
        await deps.taskRepository.update(user, task.id, after);
        change = await deps.changeSetRepository.update(user, change.id, { status: 'applied', afterJson: after });
      }
      await deps.linkRepository.update(user, link.id, { status: 'attention', lastError: 'GOOGLE_EVENT_MISSING', providerVersion: version });
      return { status: 'unscheduled' as const, task: await deps.taskRepository.get(user, task.id), changeSet: change };
    }

    const times = eventTimes(event);
    if (!times.start || !times.end || Date.parse(times.end) <= Date.parse(times.start)) throw new CalendarReconcileUnavailableError();
    const after = { ...before, plannedStart: times.start, plannedEnd: times.end, syncStatus: 'synced', calendarEventId: link.googleEventId, status: task.status ?? 'scheduled' };
    const unchanged = before.plannedStart === after.plannedStart && before.plannedEnd === after.plannedEnd && before.syncStatus === after.syncStatus;
    if (unchanged) {
      await deps.linkRepository.update(user, link.id, { status: 'synced', lastError: '', providerVersion: version });
      return { status: 'ignored' as const, task, changeSet: existing ?? null };
    }
    let change = existing;
    if (!change) change = await reserve(user, key, { kind: 'calendar_reconcile', status: 'pending', idempotencyKey: key, taskId: task.id, beforeJson: before, afterJson: after });
    if (change.status !== 'applied') {
      await deps.taskRepository.update(user, task.id, after);
      change = await deps.changeSetRepository.update(user, change.id, { status: 'applied', afterJson: after });
    }
    await deps.linkRepository.update(user, link.id, { status: 'synced', lastError: '', providerVersion: version });
    return { status: 'updated' as const, task: await deps.taskRepository.get(user, task.id), changeSet: change };
  }

  async function reconcileWatch(user: VerifiedUser, input: { calendarId: string }) {
    const connection = await deps.connectionRepository.get(user);
    if (!connection || connection.status !== 'connected' || !deps.listEvents || !deps.linkRepository.listByCalendar) throw new CalendarReconcileUnavailableError();
    const links = await deps.linkRepository.listByCalendar(user, input.calendarId);
    const events = await deps.listEvents({ connection, calendarId: input.calendarId });
    const byId = new Map(events.map((event) => [event.id, event]));
    const results = [];
    for (const link of links) results.push(await reconcile(user, { calendarId: input.calendarId, googleEventId: String(link.googleEventId ?? ''), event: byId.get(String(link.googleEventId ?? '')) ?? null }));
    return results;
  }

  return { reconcile, reconcileWatch };
}

export type CalendarReconcileService = ReturnType<typeof createCalendarReconcileService>;
