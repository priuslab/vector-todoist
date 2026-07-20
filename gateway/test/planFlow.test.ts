import { describe, expect, it, vi } from 'vitest';
import { createPlanService } from '../src/modules/planning/planService.js';
import type { VerifiedUser } from '../src/auth/verifyPocketBaseToken.js';

const user: VerifiedUser = { userId: 'alice', email: 'alice@example.test' };
const analysis = { id: 'session-1', status: 'classified' as const, analysis: { summary: 'Готово', confidence: .95, questions: [], context: [], tasks: [{ title: 'Підготувати структуру', description: 'Тези', priority: 'high' as const, estimatedMinutes: 60, deadline: null, energy: 'high' as const, confidence: .95 }], ideas: [{ text: 'Епізод про синдром самозванця', summary: 'Можлива тема', confidence: .9 }] } };
function repos() {
  let sequence = 0; const dumps = [{ id: 'dump-1', user: 'alice', rawText: 'думки' }]; const tasks: any[] = []; const ideas: any[] = []; const changes: any[] = [];
  return {
    dumpRepository: { get: vi.fn(async () => dumps[0]) } as any,
    analysisService: { result: vi.fn(async () => analysis) } as any,
    taskRepository: { create: vi.fn(async (_u: VerifiedUser, input: any) => { const item = { id: `task-${++sequence}`, user: 'alice', collectionName: 'tasks', created: 'now', updated: 'now', ...input }; tasks.push(item); return item; }), list: vi.fn(async () => tasks), get: vi.fn(async (_u: VerifiedUser, id: string) => tasks.find((x) => x.id === id) ?? null), delete: vi.fn(async (_u: VerifiedUser, id: string) => { const index = tasks.findIndex((x) => x.id === id); if (index >= 0) tasks.splice(index, 1); }) } as any,
    ideaRepository: { create: vi.fn(async (_u: VerifiedUser, input: any) => { const item = { id: `idea-${++sequence}`, user: 'alice', collectionName: 'ideas', created: 'now', updated: 'now', ...input }; ideas.push(item); return item; }), list: vi.fn(async () => ideas), delete: vi.fn(async (_u: VerifiedUser, id: string) => { const index = ideas.findIndex((x) => x.id === id); if (index >= 0) ideas.splice(index, 1); }) } as any,
    changeSetRepository: { create: vi.fn(async (_u: VerifiedUser, input: any) => { const item = { id: `change-${++sequence}`, user: 'alice', ...input }; changes.push(item); return item; }), get: vi.fn(async (_u: VerifiedUser, id: string) => changes.find((x) => x.id === id) ?? null), list: vi.fn(async () => changes), update: vi.fn(async (_u: VerifiedUser, id: string, input: any) => { const item = changes.find((x) => x.id === id); Object.assign(item, input); return item; }) } as any,
    tasks, ideas, changes,
  };
}

describe('Brain Dump → Today vertical slice', () => {
  it('previews without writes, applies tasks and ideas once, and lists Today', async () => {
    const r = repos(); const service = createPlanService(r);
    const preview = await service.preview(user, 'dump-1', { now: '2026-07-18T08:00:00+02:00', idempotencyKey: 'plan-12345678' });
    const repeatedPreview = await service.preview(user, 'dump-1', { now: '2026-07-18T08:00:00+02:00', idempotencyKey: 'plan-12345678' });
    expect(preview.tasks[0].priority).toBe('high'); expect(preview.ideas).toHaveLength(1); expect(r.tasks).toHaveLength(0); expect(r.ideas).toHaveLength(0);
    expect(repeatedPreview.changeSetId).toBe(preview.changeSetId); expect(r.changes).toHaveLength(1);
    const applied = await service.apply(user, preview.changeSetId, {});
    expect(applied.changeSet.status).toBe('applied'); expect(applied.tasks).toHaveLength(1); expect(applied.ideas).toHaveLength(1);
    const repeated = await service.apply(user, preview.changeSetId, {}); expect(repeated.changeSet.id).toBe(preview.changeSetId); expect(r.tasks).toHaveLength(1); expect(r.ideas).toHaveLength(1);
    expect((await service.inbox(user)).ideas).toHaveLength(1);
  });
  it('rolls back partial persistence and leaves change set retryable', async () => {
    const r = repos(); r.ideaRepository.create = vi.fn(async () => { throw new Error('injected persistence failure'); }); const service = createPlanService(r);
    const preview = await service.preview(user, 'dump-1', { now: '2026-07-18T08:00:00+02:00', idempotencyKey: 'plan-87654321' });
    await expect(service.apply(user, preview.changeSetId, {})).rejects.toBeDefined(); expect(r.tasks).toHaveLength(0); expect(r.changes[0].status).toBe('failed');
  });
  it('stores the actual affected pre-state in the Change Set snapshot', async () => {
    const r = repos(); r.tasks.push({ id: 'old-task', user: 'alice', sourceDump: 'dump-1', title: 'Стара задача', status: 'inbox' }); r.ideas.push({ id: 'old-idea', user: 'alice', sourceDump: 'dump-1', text: 'Стара ідея', status: 'backlog' });
    const service = createPlanService(r); const preview = await service.preview(user, 'dump-1', { idempotencyKey: 'plan-snapshot-1' });
    expect(r.changes[0].beforeJson.tasks).toEqual([expect.objectContaining({ id: 'old-task' })]); expect(r.changes[0].beforeJson.ideas).toEqual([expect.objectContaining({ id: 'old-idea' })]); expect(preview.changeSetId).toBe(r.changes[0].id);
  });
  it('saves a task to Inbox when there is no remaining slot today instead of applying an invalid scheduled task', async () => {
    const r = repos(); const service = createPlanService(r);
    const preview = await service.preview(user, 'dump-1', { now: '2026-07-18T19:00:00+02:00', idempotencyKey: 'plan-no-slot-123' });

    expect(preview.unscheduledTaskIds).toHaveLength(1);
    expect(preview.tasks[0]).toMatchObject({ status: 'inbox', plannedStart: null, plannedEnd: null });

    const applied = await service.apply(user, preview.changeSetId, {});
    expect(applied.tasks[0]).toMatchObject({ status: 'inbox', plannedStart: null, plannedEnd: null });
  });
});
