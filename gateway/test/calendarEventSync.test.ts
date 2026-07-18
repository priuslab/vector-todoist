import { describe, expect, it, vi } from 'vitest';
import { createCalendarEventService, createGoogleCalendarEventProvider, type CalendarEventLinkRepository } from '../src/modules/calendar/calendarEventService.js';

const user = { userId: 'u1', email: 'olena@example.com' };

function setup() {
  const links: any[] = [];
  const jobs: any[] = [];
  const tasks: any[] = [{ id: 'task-1', user: 'u1', title: 'Підготувати структуру', plannedStart: '2026-07-18T09:00:00.000Z', plannedEnd: '2026-07-18T10:00:00.000Z', status: 'scheduled', syncStatus: 'pending' }];
  const linkRepository: CalendarEventLinkRepository = {
    getByTask: vi.fn(async (_user, taskId) => links.find((item) => item.taskId === taskId) ?? null),
    getByIdempotencyKey: vi.fn(async (_user, key) => links.find((item) => item.idempotencyKey === key) ?? null),
    create: vi.fn(async (_user, input) => { const item = { id: `link-${links.length + 1}`, user: 'u1', ...input }; links.push(item); return item; }),
    update: vi.fn(async (_user, id, input) => { const item = links.find((row) => row.id === id); Object.assign(item, input); return item; }),
  };
  const jobRepository = {
    getByIdempotencyKey: vi.fn(async (_user, key) => jobs.find((item) => item.idempotencyKey === key) ?? null),
    create: vi.fn(async (_user: any, input: any) => { const item = { id: `job-${jobs.length + 1}`, user: 'u1', ...input }; jobs.push(item); return item; }),
    claim: vi.fn(async (_owner: string) => jobs.find((job) => job.status === 'pending' && ((job.attempts ?? 0) < 5)) ?? null),
    complete: vi.fn(async (_id: string) => undefined),
    fail: vi.fn(async (_id: string, _owner: string, error: string) => { const job = jobs.find((item) => item.id === _id); if (job) { job.status = 'pending'; job.lastError = error; job.attempts = (job.attempts ?? 0) + 1; } }),
  };
  const taskRepository = {
    get: vi.fn(async (_user: any, id: string) => tasks.find((task) => task.id === id) ?? null),
    update: vi.fn(async (_user: any, id: string, input: any) => { const task = tasks.find((row) => row.id === id); Object.assign(task, input); return task; }),
  };
  const provider = { createEvent: vi.fn(async () => ({ id: 'google-event-1', status: 'confirmed' })), deleteEvent: vi.fn() };
  const service = createCalendarEventService({ linkRepository, jobRepository, taskRepository, provider, calendarId: 'primary', now: () => 1_700_000_000_000 });
  return { service, links, jobs, tasks, linkRepository, jobRepository, taskRepository, provider };
}

describe('app-owned Google Calendar event blocks', () => {
  it('persists an outbox link/job and creates exactly one event on retries', async () => {
    const setupState = setup();
    const first = await setupState.service.syncTask(user, 'task-1');
    const second = await setupState.service.syncTask(user, 'task-1');
    expect(first.googleEventId).toBe('google-event-1');
    expect(second.googleEventId).toBe('google-event-1');
    expect(setupState.provider.createEvent).toHaveBeenCalledOnce();
    expect(setupState.links).toHaveLength(1);
    expect(setupState.jobs).toHaveLength(1);
    expect(setupState.tasks[0].syncStatus).toBe('synced');
  });

  it('keeps a valid task pending when Google fails and retry uses the same key', async () => {
    const setupState = setup();
    setupState.provider.createEvent.mockRejectedValueOnce(new Error('offline'));
    await expect(setupState.service.syncTask(user, 'task-1')).rejects.toThrow('offline');
    expect(setupState.tasks[0].status).toBe('scheduled');
    expect(setupState.tasks[0].syncStatus).toBe('sync_pending');
    setupState.provider.createEvent.mockResolvedValueOnce({ id: 'google-event-1', status: 'confirmed' });
    const retry = await setupState.service.syncTask(user, 'task-1');
    expect(retry.googleEventId).toBe('google-event-1');
    expect(setupState.provider.createEvent).toHaveBeenCalledTimes(2);
    expect(setupState.jobs[0].idempotencyKey).toBe(setupState.links[0].idempotencyKey);
  });

  it('marks a deleted app event unscheduled without deleting the task', async () => {
    const setupState = setup();
    await setupState.service.syncTask(user, 'task-1');
    await setupState.service.markMissingEvent(user, 'task-1');
    expect(setupState.tasks[0]).toMatchObject({ status: 'needs_reschedule', syncStatus: 'attention' });
    expect(setupState.tasks).toHaveLength(1);
  });

  it('does not create an event when the calendar connection belongs to another user', async () => {
    const setupState = setup();
    const provider = createGoogleCalendarEventProvider({ connectionRepository: { get: vi.fn().mockResolvedValue({ user: 'other', status: 'connected', encryptedRefreshToken: 'x', provider: 'google' }) }, googleCalendarClient: { createEvent: vi.fn() } as any });
    const service = createCalendarEventService({ linkRepository: setupState.linkRepository, jobRepository: setupState.jobRepository, taskRepository: setupState.taskRepository, provider, calendarId: 'primary' });
    await expect(service.syncTask(user, 'task-1')).rejects.toThrow('CALENDAR_RECONNECT_REQUIRED');
    expect(setupState.links).toHaveLength(0);
  });

  it('coalesces concurrent service instances around one deterministic provider call', async () => {
    const state = setupStateForRace();
    const one = createCalendarEventService({ linkRepository: state.linkRepository, jobRepository: state.jobRepository, taskRepository: state.taskRepository, provider: state.provider, calendarId: 'primary' });
    const two = createCalendarEventService({ linkRepository: state.linkRepository, jobRepository: state.jobRepository, taskRepository: state.taskRepository, provider: state.provider, calendarId: 'primary' });
    await Promise.all([one.syncTask(user, 'task-1'), two.syncTask(user, 'task-1')]);
    expect(state.provider.createEvent).toHaveBeenCalledOnce();
  });
});

function setupStateForRace() {
  const state = setup(); let resolve!: (value: { id: string }) => void;
  const pending = new Promise<{ id: string }>((done) => { resolve = done; });
  state.provider.createEvent.mockReturnValueOnce(pending);
  setTimeout(() => resolve({ id: 'google-event-1' }), 0);
  return state;
}
