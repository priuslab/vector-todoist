import { describe, expect, it, vi } from 'vitest';
import { createCalendarReconcileService } from '../src/modules/calendar/calendarReconcileService.js';

const user = { userId: 'u1', email: 'olena@example.com' };
const connection = { user: 'u1', provider: 'google' as const, status: 'connected' as const, encryptedRefreshToken: 'encrypted' };

function setup() {
  const links: any[] = [{ id: 'link-1', user: 'u1', taskId: 'task-1', calendarId: 'primary', googleEventId: 'event-1', status: 'synced', providerVersion: 'old' }];
  const tasks: any[] = [{ id: 'task-1', user: 'u1', title: 'Структура епізоду', status: 'scheduled', plannedStart: '2026-07-18T09:00:00.000Z', plannedEnd: '2026-07-18T10:00:00.000Z', syncStatus: 'synced', calendarEventId: 'event-1' }];
  const changes: any[] = [];
  const linkRepository = { getByGoogleEvent: vi.fn(async (_user: any, calendarId: string, id: string) => links.find((link) => link.user === _user.userId && link.calendarId === calendarId && link.googleEventId === id) ?? null), update: vi.fn(async (_user: any, id: string, input: any) => { const link = links.find((item) => item.id === id); Object.assign(link, input); return link; }) };
  const taskRepository = { get: vi.fn(async (_user: any, id: string) => tasks.find((task) => task.id === id && task.user === _user.userId) ?? null), update: vi.fn(async (_user: any, id: string, input: any) => { const task = tasks.find((item) => item.id === id); Object.assign(task, input); return task; }) };
  const changeSetRepository = { get: vi.fn(), list: vi.fn(async (_user: any) => changes.filter((change) => change.user === _user.userId)), create: vi.fn(async (_user: any, input: any) => { const change = { id: `change-${changes.length + 1}`, user: _user.userId, ...input }; changes.push(change); return change; }), update: vi.fn(async (_user: any, id: string, input: any) => { const change = changes.find((item) => item.id === id); Object.assign(change, input); return change; }) };
  const googleCalendarClient = { getEvent: vi.fn() };
  const service = createCalendarReconcileService({ linkRepository, taskRepository, changeSetRepository, connectionRepository: { get: vi.fn().mockResolvedValue(connection) }, googleCalendarClient });
  return { service, links, tasks, changes, linkRepository, taskRepository, changeSetRepository, googleCalendarClient };
}

describe('two-way Google Calendar reconciliation', () => {
  it('updates only the owned task when the provider event moves and records a Change Set', async () => {
    const state = setup();
    state.googleCalendarClient.getEvent.mockResolvedValue({ id: 'event-1', etag: 'v2', start: { dateTime: '2026-07-18T12:00:00+00:00' }, end: { dateTime: '2026-07-18T13:00:00+00:00' } });
    const result = await state.service.reconcile(user, { calendarId: 'primary', googleEventId: 'event-1' });
    expect(result.status).toBe('updated');
    expect(state.tasks[0]).toMatchObject({ plannedStart: '2026-07-18T12:00:00.000Z', plannedEnd: '2026-07-18T13:00:00.000Z', syncStatus: 'synced' });
    expect(state.changes[0]).toMatchObject({ kind: 'calendar_reconcile', status: 'applied', beforeJson: expect.objectContaining({ plannedStart: '2026-07-18T09:00:00.000Z' }) });
  });

  it('unschedules but never deletes a task when its app-owned event is cancelled', async () => {
    const state = setup();
    state.googleCalendarClient.getEvent.mockResolvedValue({ id: 'event-1', status: 'cancelled', etag: 'v3' });
    const result = await state.service.reconcile(user, { calendarId: 'primary', googleEventId: 'event-1' });
    expect(result.status).toBe('unscheduled');
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0]).toMatchObject({ status: 'needs_reschedule', plannedStart: null, plannedEnd: null, syncStatus: 'attention' });
  });

  it('ignores an unchanged app-originated echo and duplicate version idempotently', async () => {
    const state = setup();
    state.links[0].providerVersion = 'v4';
    state.googleCalendarClient.getEvent.mockResolvedValue({ id: 'event-1', etag: 'v4', extendedProperties: { private: { vectorOrigin: 'vector' } }, start: { dateTime: '2026-07-18T09:00:00Z' }, end: { dateTime: '2026-07-18T10:00:00Z' } });
    expect((await state.service.reconcile(user, { calendarId: 'primary', googleEventId: 'event-1' })).status).toBe('ignored');
    expect(state.taskRepository.update).not.toHaveBeenCalled();
    expect(state.changes).toHaveLength(0);
  });

  it('does not apply a second Change Set for the same provider version after a race', async () => {
    const state = setup();
    state.googleCalendarClient.getEvent.mockResolvedValue({ id: 'event-1', etag: 'v5', start: { dateTime: '2026-07-18T12:00:00Z' }, end: { dateTime: '2026-07-18T13:00:00Z' } });
    await Promise.all([state.service.reconcile(user, { calendarId: 'primary', googleEventId: 'event-1' }), state.service.reconcile(user, { calendarId: 'primary', googleEventId: 'event-1' })]);
    expect(state.changes).toHaveLength(1);
    expect(state.tasks[0].plannedStart).toBe('2026-07-18T12:00:00.000Z');
  });
});
