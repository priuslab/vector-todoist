import { describe, expect, it, vi } from 'vitest';
import { createTaskService } from '../src/modules/tasks/taskService.js';
import { createUndoService } from '../src/modules/changeSets/undoService.js';

const user = { userId: 'alice', email: 'a@test' };
function repos() {
  const tasks: any[] = [{ id: 't1', user: 'alice', title: 'Стара назва', status: 'scheduled', priority: 'high', estimatedMinutes: 30, version: 1 }];
  const changes: any[] = [];
  let sequence = 0;
  const taskRepository: any = { get: vi.fn(async (_u: any, id: string) => tasks.find((t) => t.id === id && t.user === _u.userId) ?? null), update: vi.fn(async (_u: any, id: string, data: any) => { const t = tasks.find((x) => x.id === id && x.user === _u.userId); if (!t) throw Object.assign(new Error(), { code: 'NOT_FOUND' }); Object.assign(t, data); return { ...t }; }), list: vi.fn(async () => tasks) };
  const changeSetRepository: any = { list: vi.fn(async (_u: any) => changes.filter((x) => x.user === _u.userId)), get: vi.fn(async (_u: any, id: string) => changes.find((x) => x.id === id && x.user === _u.userId) ?? null), create: vi.fn(async (_u: any, data: any) => { const c = { id: `c${++sequence}`, user: _u.userId, ...data }; changes.push(c); return c; }), update: vi.fn(async (_u: any, id: string, data: any) => { const c = changes.find((x) => x.id === id); Object.assign(c, data); return { ...c }; }) };
  return { tasks, changes, taskRepository, changeSetRepository };
}

describe('task mutations and Undo', () => {
  it('validates fields, edits owned task, and records a change set', async () => {
    const r = repos(); const service = createTaskService(r);
    await expect(service.update(user, 't1', { title: 'Нова назва', idempotencyKey: 'edit-123456' })).resolves.toMatchObject({ task: { title: 'Нова назва' } });
    await expect(service.update(user, 't1', { unknown: true })).rejects.toMatchObject({ code: 'INVALID_TASK' });
    expect(r.changes).toHaveLength(1);
  });
  it('completion is idempotent and cross-user task is safe 404', async () => {
    const r = repos(); const service = createTaskService(r);
    const one = await service.complete(user, 't1', { idempotencyKey: 'complete-123456' });
    const two = await service.complete(user, 't1', { idempotencyKey: 'complete-123456' });
    expect(one.task.status).toBe('completed'); expect(two.task.status).toBe('completed'); expect(r.changes).toHaveLength(1);
    await expect(service.get({ userId: 'bob', email: 'b@test' }, 't1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('rejects stale optimistic version and undoes once, then returns current state', async () => {
    const r = repos(); const service = createTaskService(r); const undo = createUndoService(r);
    const result = await service.update(user, 't1', { title: 'Нова назва', expectedVersion: 1, idempotencyKey: 'edit-abcdef' });
    await expect(service.update(user, 't1', { title: 'Застаріле', expectedVersion: 1 })).rejects.toMatchObject({ code: 'CONFLICT' });
    const first = await undo.undo(user, result.changeSet.id); expect(first.task?.title).toBe('Стара назва');
    const second = await undo.undo(user, result.changeSet.id); expect(second.changeSet.status).toBe('undone'); expect(second.task?.title).toBe('Стара назва');
  });
  it('assigns numeric version 1 when updating a legacy task without version', async () => {
    const r = repos(); delete r.tasks[0].version; const service = createTaskService(r);
    const result = await service.update(user, 't1', { title: 'Оновлено', idempotencyKey: 'legacy-123456' });
    expect(result.task.version).toBe(1); expect(r.tasks[0].version).toBe(1);
  });
});
