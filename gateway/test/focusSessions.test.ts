import { describe, expect, it, vi } from 'vitest';
import { createFocusSessionService, type FocusSessionRecord, type FocusSessionRepository } from '../src/modules/focusSessions/focusSessionRoutes.js';
import { RepositoryError } from '../src/repositories/base.js';

const alice = { userId: 'alice', email: 'alice@example.test' } as any;
const bob = { userId: 'bob', email: 'bob@example.test' } as any;
function setup() {
  let now = new Date('2026-07-20T09:00:00.000Z'); let seq = 0; const rows: FocusSessionRecord[] = [];
  const repository: FocusSessionRepository = {
    list: vi.fn(async (user) => rows.filter((row) => row.user === user.userId)),
    get: vi.fn(async (user, id) => rows.find((row) => row.user === user.userId && row.id === id) ?? null),
    create: vi.fn(async (user, input) => { const row = { id: `focus-${++seq}`, user: user.userId, ...input } as FocusSessionRecord; rows.push(row); return row; }),
    update: vi.fn(async (user, id, input) => { const row = rows.find((item) => item.user === user.userId && item.id === id); if (!row) throw new Error('missing'); Object.assign(row, input); return row; }),
    updateIfVersion: vi.fn(async (user, id, expected, input) => { const row = rows.find((item) => item.user === user.userId && item.id === id); if (!row) throw new Error('missing'); if (row.version !== expected) throw Object.assign(new Error('VERSION_CONFLICT'), { code: 'INVALID' }); Object.assign(row, input); return row; }),
  };
  const task = { id: 'task-1', user: 'alice', title: 'Структура епізоду', status: 'scheduled' } as any;
  const taskRepository = { get: vi.fn(async (user: any, id: string) => user.userId === 'alice' && id === task.id ? task : null) } as any;
  return { rows, repository, taskRepository, service: createFocusSessionService({ repository, taskRepository, now: () => now }), setNow: (value: string) => { now = new Date(value); } };
}

describe('persistent focus sessions', () => {
  it('starts an owned session with absolute timestamps and is idempotent', async () => {
    const state = setup();
    const one = await state.service.start(alice, { taskId: 'task-1', durationMinutes: 25, idempotencyKey: 'focus-idempotent-1' });
    const two = await state.service.start(alice, { taskId: 'task-1', durationMinutes: 25, idempotencyKey: 'focus-idempotent-1' });
    expect(one.id).toBe(two.id); expect(one.status).toBe('active'); expect(one.plannedEndAt).toBe('2026-07-20T09:25:00.000Z'); expect(state.rows).toHaveLength(1);
  });
  it('extends absolute end on pause/resume and computes actual minutes on finish', async () => {
    const state = setup(); const started = await state.service.start(alice, { taskId: 'task-1', durationMinutes: 25, idempotencyKey: 'focus-pause-1' });
    state.setNow('2026-07-20T09:05:00.000Z'); await state.service.pause(alice, started.id);
    state.setNow('2026-07-20T09:10:30.000Z'); const resumed = await state.service.resume(alice, started.id);
    expect(resumed.plannedEndAt).toBe('2026-07-20T09:30:30.000Z'); expect(resumed.pausedSeconds).toBe(330);
    state.setNow('2026-07-20T09:20:30.000Z'); const finished = await state.service.finish(alice, started.id, {});
    expect(finished.status).toBe('finished'); expect(finished.actualMinutes).toBe(15); expect(finished.pausedSeconds).toBe(330);
    expect(await state.service.finish(alice, started.id, {})).toEqual(finished);
  });
  it('rejects cross-user access and does not auto-complete the task', async () => {
    const state = setup(); const started = await state.service.start(alice, { taskId: 'task-1', durationMinutes: 25, idempotencyKey: 'focus-owner-1' });
    await expect(state.service.finish(bob, started.id, { completeTask: true })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await state.service.finish(alice, started.id, { completeTask: true });
    expect(state.taskRepository.get).not.toHaveBeenCalledWith(expect.anything(), expect.stringContaining('complete'));
    expect(state.rows[0]).toMatchObject({ status: 'finished' }); expect((state.taskRepository.get as any).mock.calls.length).toBe(1);
  });
  it('rejects a second active session for the same task', async () => {
    const state = setup(); await state.service.start(alice, { taskId: 'task-1', durationMinutes: 25, idempotencyKey: 'focus-active-1' });
    await expect(state.service.start(alice, { taskId: 'task-1', durationMinutes: 25, idempotencyKey: 'focus-active-2' })).rejects.toMatchObject({ code: 'FOCUS_SESSION_CONFLICT' });
  });
  it('rejects stale pause/resume/finish mutations using the persisted version', async () => {
    const state = setup(); const started = await state.service.start(alice, { taskId: 'task-1', durationMinutes: 25, idempotencyKey: 'focus-version-1' });
    state.repository.updateIfVersion = vi.fn().mockRejectedValue(new RepositoryError('INVALID', 'VERSION_CONFLICT'));
    await expect(state.service.pause(alice, started.id)).rejects.toMatchObject({ code: 'FOCUS_SESSION_CONFLICT' });
  });
});
