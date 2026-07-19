import { describe, expect, it, vi } from 'vitest';
import { createFocusModeService } from '../src/modules/focus/focusModeService.js';
import { createUndoService } from '../src/modules/changeSets/undoService.js';

const user = { userId: 'alice', email: 'alice@example.test' } as any;
function setup() {
  const tasks: any[] = [
    { id: 'goal-task', user: 'alice', title: 'Структура епізоду', status: 'scheduled', flexible: true, goalId: 'goal-1', goalAlignment: .95, plannedStart: '2026-07-20T09:00:00+02:00', plannedEnd: '2026-07-20T10:00:00+02:00', estimatedMinutes: 60, priority: 'high', energy: 'high', version: 1 },
    { id: 'unrelated', user: 'alice', title: 'Замовити корм коту', status: 'scheduled', flexible: true, goalAlignment: .1, plannedStart: '2026-07-20T15:00:00+02:00', plannedEnd: '2026-07-20T15:15:00+02:00', estimatedMinutes: 15, priority: 'low', energy: 'low', version: 1 },
    { id: 'deadline', user: 'alice', title: 'Подати звіт', status: 'scheduled', flexible: true, goalAlignment: .1, deadline: '2026-07-20T12:00:00+02:00', plannedStart: '2026-07-20T10:00:00+02:00', plannedEnd: '2026-07-20T10:30:00+02:00', estimatedMinutes: 30, priority: 'urgent', energy: 'medium', version: 1 },
    { id: 'locked', user: 'alice', title: 'Командний синк', status: 'scheduled', flexible: false, locked: true, goalAlignment: 0, plannedStart: '2026-07-20T11:00:00+02:00', plannedEnd: '2026-07-20T11:45:00+02:00', estimatedMinutes: 45, priority: 'medium', energy: 'medium', version: 1 },
    { id: 'other-user', user: 'bob', title: 'Чужа задача', status: 'scheduled', flexible: true, goalAlignment: 0, version: 1 },
  ];
  const changes: any[] = []; let sequence = 0;
  const taskRepository: any = { list: vi.fn(async (u: any) => tasks.filter((item) => item.user === u.userId)), get: vi.fn(async (u: any, id: string) => tasks.find((item) => item.user === u.userId && item.id === id) ?? null), updateIfVersion: vi.fn(async (u: any, id: string, version: number, patch: any) => { const task = tasks.find((item) => item.user === u.userId && item.id === id); if (!task || task.version !== version) throw Object.assign(new Error(), { code: 'INVALID' }); Object.assign(task, patch); return task; }), update: vi.fn(async (_u: any, id: string, patch: any) => { const task = tasks.find((item) => item.id === id); Object.assign(task, patch); return task; }) };
  const changeSetRepository: any = { list: vi.fn(async (u: any) => changes.filter((item) => item.user === u.userId)), create: vi.fn(async (u: any, input: any) => { const c = { id: `change-${++sequence}`, user: u.userId, ...input }; changes.push(c); return c; }), update: vi.fn(async (_u: any, id: string, input: any) => { const c = changes.find((item) => item.id === id); Object.assign(c, input); return c; }), get: vi.fn(async (u: any, id: string) => changes.find((item) => item.id === id && item.user === u.userId) ?? null) };
  return { tasks, changes, taskRepository, changeSetRepository, service: createFocusModeService({ taskRepository, changeSetRepository, now: () => new Date('2026-07-20T08:00:00+02:00') }) };
}
const input = (mode: 'balanced' | 'goal_focus' = 'goal_focus', idempotencyKey = 'focus-test-key') => ({ mode, goalId: mode === 'goal_focus' ? 'goal-1' : undefined, now: '2026-07-20T08:00:00+02:00', timezone: 'Europe/Warsaw', profile: { timezone: 'Europe/Warsaw', workHours: { start: '09:00', end: '18:00' }, energyPeak: { start: '09:30', end: '12:30' }, focusBlockMinutes: 50, breakMinutes: 10, dailyLimitMinutes: 360 }, busySlots: [], idempotencyKey });
describe('focus modes', () => {
  it('defaults to Balanced and Goal Focus defers only unrelated flexible work', async () => {
    const { service } = setup();
    const balanced = await service.preview(user, { ...input('balanced'), idempotencyKey: undefined });
    expect(balanced.mode).toBe('balanced'); expect(balanced.deferred).toEqual([]);
    const focused = await service.preview(user, input());
    expect(focused.deferred.map((item) => item.taskId)).toEqual(['unrelated']);
    expect(focused.tasks.find((task) => task.id === 'deadline')?.status).toBe('scheduled');
    expect(focused.tasks.find((task) => task.id === 'locked')?.plannedStart).toContain('11:00');
  });
  it('applies idempotently, isolates ownership and persists Ukrainian reasons for Undo', async () => {
    const state = setup(); const first = await state.service.apply(user, input()); const second = await state.service.apply(user, input());
    expect(first.changeSet.id).toBe(second.changeSet.id); expect(state.changes).toHaveLength(1); expect(state.tasks.find((task) => task.id === 'unrelated').status).toBe('needs_reschedule');
    expect(first.deferred[0].reason).toContain('Balanced'); expect(first.undoId).toBe(first.changeSet.id);
    const undone = await createUndoService(state).undo(user, first.undoId);
    expect(undone.changeSet.status).toBe('undone');
    expect(state.tasks.find((task) => task.id === 'unrelated')).toMatchObject({ status: 'scheduled', plannedStart: '2026-07-20T15:00:00+02:00', version: 3 });
    await expect(state.service.preview({ userId: 'bob' } as any, input())).resolves.toBeTruthy();
    expect(state.tasks.find((task) => task.id === 'other-user').status).toBe('scheduled');
  });
  it('rejects missing goal and strict unknown fields', async () => {
    const { service } = setup();
    await expect(service.preview(user, { ...input(), goalId: undefined })).rejects.toMatchObject({ code: 'INVALID_FOCUS' });
    await expect(service.preview(user, { ...input(), extra: true })).rejects.toMatchObject({ code: 'INVALID_FOCUS' });
  });
});
