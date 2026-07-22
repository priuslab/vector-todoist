import { describe, expect, it, vi } from 'vitest';
import { createRescheduleService } from '../src/modules/rescheduling/rescheduleService.js';
import { createUndoService } from '../src/modules/changeSets/undoService.js';

const user = { userId: 'alice', email: 'a@test' };

function createSetup() {
  const tasks: any[] = [
    { id: 'past', user: 'alice', title: 'Вчора', status: 'scheduled', flexible: true, plannedStart: '2026-07-18T09:00:00+02:00', plannedEnd: '2026-07-18T09:30:00+02:00', estimatedMinutes: 30, priority: 'high', energy: 'medium', version: 1 },
    { id: 'done', user: 'alice', title: 'Готово', status: 'completed', flexible: true, plannedStart: '2026-07-19T09:00:00+02:00', plannedEnd: '2026-07-19T09:30:00+02:00', estimatedMinutes: 30, priority: 'high', energy: 'medium', version: 2 },
    { id: 'locked', user: 'alice', title: 'Зустріч', status: 'scheduled', locked: true, flexible: false, plannedStart: '2026-07-19T11:00:00+02:00', plannedEnd: '2026-07-19T11:45:00+02:00', estimatedMinutes: 45, priority: 'medium', energy: 'medium', version: 3 },
    { id: 'google', user: 'alice', title: 'Google подія', status: 'scheduled', flexible: false, calendarEventId: 'g1', plannedStart: '2026-07-19T13:00:00+02:00', plannedEnd: '2026-07-19T14:00:00+02:00', estimatedMinutes: 60, priority: 'medium', energy: 'medium', version: 4 },
    { id: 'flex', user: 'alice', title: 'Гнучка задача', status: 'scheduled', flexible: true, plannedStart: '2026-07-19T09:00:00+02:00', plannedEnd: '2026-07-19T10:00:00+02:00', estimatedMinutes: 60, priority: 'high', energy: 'high', version: 1 },
  ];
  const changes: any[] = [];
  const jobs: any[] = [];
  let sequence = 0;
  const taskRepository: any = {
    list: vi.fn(async () => tasks.filter((task) => task.user === user.userId)),
    get: vi.fn(async (_u: any, id: string) => tasks.find((task) => task.id === id && task.user === _u.userId) ?? null),
    updateIfVersion: vi.fn(async (_u: any, id: string, version: number, patch: any) => {
      const task = tasks.find((item) => item.id === id && item.user === _u.userId);
      if (!task || Number(task.version ?? 0) !== version) throw Object.assign(new Error('conflict'), { code: 'INVALID', message: 'VERSION_CONFLICT' });
      Object.assign(task, patch); return { ...task };
    }),
    update: vi.fn(async (_u: any, id: string, patch: any) => { const task = tasks.find((item) => item.id === id); Object.assign(task, patch); return { ...task }; }),
  };
  const changeSetRepository: any = {
    list: vi.fn(async (_u: any) => changes.filter((item) => item.user === _u.userId)),
    get: vi.fn(async (_u: any, id: string) => changes.find((item) => item.id === id && item.user === _u.userId) ?? null),
    create: vi.fn(async (_u: any, input: any) => { const value = { id: `change-${++sequence}`, user: _u.userId, ...input }; changes.push(value); return value; }),
    update: vi.fn(async (_u: any, id: string, input: any) => { const value = changes.find((item) => item.id === id); Object.assign(value, input); return { ...value }; }),
    transition: vi.fn(async (_u: any, id: string, from: string, to: string, input: any = {}) => { const value = changes.find((item) => item.id === id); if (value.status !== from) throw Object.assign(new Error(), { code: 'INVALID' }); Object.assign(value, input, { status: to }); return { ...value }; }),
  };
  const jobRepository: any = { getByIdempotencyKey: vi.fn(async (_u: any, key: string) => jobs.find((job) => job.user === _u.userId && job.idempotencyKey === key) ?? null), create: vi.fn(async (_u: any, input: any) => { const value = { id: `job-${jobs.length + 1}`, user: _u.userId, ...input }; jobs.push(value); return value; }) };
  return { tasks, changes, jobs, taskRepository, changeSetRepository, jobRepository };
}

const input = { now: '2026-07-19T08:00:00+02:00', timezone: 'Europe/Warsaw', idempotencyKey: 'reschedule-123456', profile: { workHours: { start: '09:00', end: '18:00' }, energyPeak: { start: '09:30', end: '12:30' }, focusBlockMinutes: 50, breakMinutes: 10, dailyLimitMinutes: 360 } };

describe('automatic flexible rescheduling', () => {
  it('previews only future flexible tasks and returns exact diff with immutable reasons', async () => {
    const setup = createSetup();
    const service = createRescheduleService(setup);
    const preview = await service.preview(user, input);
    expect(setup.changes).toHaveLength(0);
    expect(preview.changes.find((change: any) => change.taskId === 'flex')).toEqual(expect.objectContaining({ before: expect.objectContaining({ plannedStart: expect.any(String) }), after: expect.objectContaining({ plannedStart: expect.any(String) }) }));
    expect(preview.changes.find((change: any) => change.taskId === 'past')).toMatchObject({ changed: false, reason: expect.stringContaining('Минулий') });
    expect(preview.changes.find((change: any) => change.taskId === 'done')).toMatchObject({ changed: false });
    expect(preview.changes.find((change: any) => change.taskId === 'google')).toMatchObject({ changed: false, reason: expect.stringContaining('Google') });
  });

  it('applies once, records a Change Set, queues calendar compensation, and repeats idempotently', async () => {
    const setup = createSetup();
    const service = createRescheduleService(setup);
    const first = await service.apply(user, input);
    const second = await service.apply(user, input);
    expect(first.changeSet.status).toBe('applied');
    expect(second.changeSet.id).toBe(first.changeSet.id);
    expect(setup.changes).toHaveLength(1);
    expect(setup.taskRepository.updateIfVersion).toHaveBeenCalledWith(user, 'flex', 1, expect.objectContaining({ version: 2 }));
    expect(setup.jobs).toHaveLength(0); // no Google-owned flexible task in this fixture
  });

  it('reports overload instead of silently dropping work', async () => {
    const setup = createSetup();
    setup.tasks.push({ id: 'too-long', user: 'alice', title: 'Завелика', status: 'scheduled', flexible: true, plannedStart: '2026-07-19T09:00:00+02:00', plannedEnd: '2026-07-19T10:00:00+02:00', estimatedMinutes: 1200, priority: 'low', energy: 'low', version: 1 });
    const service = createRescheduleService(setup);
    const preview = await service.preview(user, { ...input, profile: { ...input.profile, dailyLimitMinutes: 60 } });
    expect(preview.unscheduledTaskIds).toContain('too-long');
    expect(preview.warnings.join(' ')).toMatch(/ліміт|план/);
  });

  it('restores every moved task through one Undo and queues app-calendar compensation', async () => {
    const setup = createSetup();
    setup.tasks.find((task: any) => task.id === 'flex').syncStatus = 'synced';
    setup.tasks.find((task: any) => task.id === 'flex').calendarEventId = 'app-event';
    const service = createRescheduleService({ ...setup, jobRepository: setup.jobRepository });
    const applied = await service.apply(user, input);
    const undo = createUndoService({ taskRepository: setup.taskRepository, changeSetRepository: setup.changeSetRepository, jobRepository: setup.jobRepository });
    const restored = await undo.undo(user, applied.undoId);
    expect(restored.changeSet.status).toBe('undone');
    expect(setup.tasks.find((task: any) => task.id === 'flex')).toMatchObject({ plannedStart: '2026-07-19T09:00:00+02:00', version: 3 });
    expect(setup.jobs.some((job: any) => job.type === 'calendar.update')).toBe(true);
  });

  it('keeps an in-progress block immutable during preview', async () => {
    const setup = createSetup();
    setup.tasks.push({ id: 'active', user: 'alice', title: 'Фокус зараз', status: 'scheduled', flexible: true, plannedStart: '2026-07-19T07:30:00+02:00', plannedEnd: '2026-07-19T09:30:00+02:00', estimatedMinutes: 120, priority: 'urgent', energy: 'high', version: 1 });
    const service = createRescheduleService(setup);
    const preview = await service.preview(user, { ...input, now: '2026-07-19T08:30:00+02:00' });
    expect(preview.changes.find((change: any) => change.taskId === 'active')).toMatchObject({ changed: false, reason: expect.stringContaining('Активний') });
  });

  it('does not leave a partial batch Undo after an injected second-row failure', async () => {
    const setup = createSetup();
    setup.tasks.push({ id: 'flex-2', user: 'alice', title: 'Друга', status: 'scheduled', flexible: true, plannedStart: '2026-07-19T10:00:00+02:00', plannedEnd: '2026-07-19T11:00:00+02:00', estimatedMinutes: 60, priority: 'low', energy: 'low', version: 1 });
    const service = createRescheduleService(setup);
    const applied = await service.apply(user, input);
    const original = setup.taskRepository.updateIfVersion;
    let updates = 0;
    setup.taskRepository.updateIfVersion = vi.fn(async (...args: any[]) => { updates += 1; if (updates === 2) throw new Error('injected'); return original(...args); });
    const undo = createUndoService({ taskRepository: setup.taskRepository, changeSetRepository: setup.changeSetRepository });
    await expect(undo.undo(user, applied.undoId)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(setup.tasks.find((task: any) => task.id === 'flex').plannedStart).not.toBe('2026-07-19T09:00:00+02:00');
    expect(setup.changes.find((change: any) => change.id === applied.undoId).status).toBe('applied');
  });
});
