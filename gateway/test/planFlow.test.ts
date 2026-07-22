import { describe, expect, it, vi } from 'vitest';
import { createPlanService } from '../src/modules/planning/planService.js';
import type { VerifiedUser } from '../src/auth/verifyPocketBaseToken.js';

const user: VerifiedUser = { userId: 'alice', email: 'alice@example.test' };
const analysis = { id: 'session-1', status: 'classified' as const, analysis: { summary: 'Готово', confidence: .95, questions: [], context: [], tasks: [{ title: 'Підготувати структуру', description: 'Тези', priority: 'high' as const, estimatedMinutes: 60, deadline: null, energy: 'high' as const, confidence: .95 }], ideas: [{ text: 'Епізод про синдром самозванця', summary: 'Можлива тема', confidence: .9 }] } };
function repos({ goals = [] as any[] }: { goals?: any[] } = {}) {
  let sequence = 0; const dumps = [{ id: 'dump-1', user: 'alice', rawText: 'думки', source: 'web', kind: 'text', status: 'classified', created: '2026-07-18 08:00:00' }]; const tasks: any[] = []; const ideas: any[] = []; const changes: any[] = []; const edges: any[] = [];
  return {
    dumpRepository: { get: vi.fn(async (u: VerifiedUser, id: string) => dumps.find((dump) => dump.id === id && dump.user === u.userId) ?? null), list: vi.fn(async () => dumps), update: vi.fn(async (_u: VerifiedUser, id: string, input: any) => { const dump = dumps.find((item) => item.id === id); Object.assign(dump, input); return dump; }) } as any,
    analysisService: { result: vi.fn(async () => analysis) } as any,
    taskRepository: { create: vi.fn(async (_u: VerifiedUser, input: any) => { const item = { id: `task-${++sequence}`, user: 'alice', collectionName: 'tasks', created: 'now', updated: 'now', ...input }; tasks.push(item); return item; }), update: vi.fn(async (_u: VerifiedUser, id: string, input: any) => { const item = tasks.find((x) => x.id === id); Object.assign(item, input); return item; }), list: vi.fn(async () => tasks), get: vi.fn(async (_u: VerifiedUser, id: string) => tasks.find((x) => x.id === id) ?? null), delete: vi.fn(async (_u: VerifiedUser, id: string) => { const index = tasks.findIndex((x) => x.id === id); if (index >= 0) tasks.splice(index, 1); }) } as any,
    ideaRepository: { create: vi.fn(async (_u: VerifiedUser, input: any) => { const item = { id: `idea-${++sequence}`, user: 'alice', collectionName: 'ideas', created: 'now', updated: 'now', ...input }; ideas.push(item); return item; }), update: vi.fn(async (_u: VerifiedUser, id: string, input: any) => { const item = ideas.find((x) => x.id === id); Object.assign(item, input); return item; }), list: vi.fn(async () => ideas), delete: vi.fn(async (_u: VerifiedUser, id: string) => { const index = ideas.findIndex((x) => x.id === id); if (index >= 0) ideas.splice(index, 1); }) } as any,
    changeSetRepository: { create: vi.fn(async (_u: VerifiedUser, input: any) => { if (changes.some((item) => item.idempotencyKey === input.idempotencyKey)) throw new Error('duplicate idempotency key'); const item = { id: `change-${++sequence}`, user: 'alice', ...input }; changes.push(item); return item; }), get: vi.fn(async (_u: VerifiedUser, id: string) => changes.find((x) => x.id === id) ?? null), list: vi.fn(async () => changes), update: vi.fn(async (_u: VerifiedUser, id: string, input: any) => { const item = changes.find((x) => x.id === id); Object.assign(item, input); return item; }), delete: vi.fn(async (_u: VerifiedUser, id: string) => { const index = changes.findIndex((item) => item.id === id); if (index >= 0) changes.splice(index, 1); }) } as any,
    goalGraphRepository: {
      goals: { get: vi.fn(async (u: VerifiedUser, id: string) => goals.find((goal) => goal.id === id && goal.user === u.userId) ?? null) },
      edges: { create: vi.fn(async (_u: VerifiedUser, input: any) => { const item = { id: `edge-${++sequence}`, user: 'alice', ...input }; edges.push(item); return item; }), list: vi.fn(async () => edges), delete: vi.fn(async (_u: VerifiedUser, id: string) => { const index = edges.findIndex((edge) => edge.id === id); if (index >= 0) edges.splice(index, 1); }) },
    } as any,
    dumps, tasks, ideas, changes, edges, goals,
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
    expect(r.dumps[0].status).toBe('applied');
    const repeated = await service.apply(user, preview.changeSetId, {}); expect(repeated.changeSet.id).toBe(preview.changeSetId); expect(r.tasks).toHaveLength(1); expect(r.ideas).toHaveLength(1);
    expect((await service.inbox(user)).ideas).toHaveLength(1);
  });
  it('previews classified analysis even when non-critical clarification questions remain', async () => {
    const r = repos();
    r.analysisService.result = vi.fn(async () => ({ ...analysis, analysis: { ...analysis.analysis, questions: [{ id: 'q1', prompt: 'Коли це робити?' }] } }));
    const service = createPlanService(r);

    const preview = await service.preview(user, 'dump-1', { now: '2026-07-18T08:00:00+02:00', idempotencyKey: 'plan-questions-123' });

    expect(preview.tasks).toHaveLength(1);
    expect(preview.ideas).toHaveLength(1);
    expect(r.changes).toHaveLength(1);
  });
  it('replays the persisted proposals and blocks when a preview response is lost', async () => {
    const r = repos(); const service = createPlanService(r);
    const firstPreview = await service.preview(user, 'dump-1', { now: '2026-07-18T08:00:00+02:00', idempotencyKey: 'plan-response-loss' });

    const retriedPreview = await service.preview(user, 'dump-1', { now: '2026-07-18T19:00:00+02:00', idempotencyKey: 'plan-response-loss' });

    expect(retriedPreview).toEqual(firstPreview);
    expect(r.changes).toHaveLength(1);
    expect(r.changes[0].afterJson).toEqual(expect.objectContaining({
      tasks: firstPreview.tasks,
      ideas: firstPreview.ideas,
      preview: expect.objectContaining({ blocks: firstPreview.blocks }),
    }));
  });
  it('requires a fresh key when replaying a legacy pending Change Set without a stored preview', async () => {
    const r = repos(); const service = createPlanService(r);
    const firstPreview = await service.preview(user, 'dump-1', { now: '2026-07-18T08:00:00+02:00', idempotencyKey: 'plan-legacy-missing-preview' });
    delete r.changes[0].afterJson.preview;

    await expect(service.preview(user, 'dump-1', { now: '2026-07-18T19:00:00+02:00', idempotencyKey: 'plan-legacy-missing-preview' }))
      .rejects.toMatchObject({ code: 'CONFLICT' });

    expect(r.changes).toHaveLength(1);
    expect(r.changes[0].afterJson.tasks).toEqual(firstPreview.tasks);
    await expect(service.apply(user, firstPreview.changeSetId, {})).resolves.toMatchObject({ tasks: [expect.objectContaining({ title: 'Підготувати структуру' })] });
  });
  it('rolls back partial persistence and leaves change set retryable', async () => {
    const r = repos(); r.ideaRepository.create = vi.fn(async () => { throw new Error('injected persistence failure'); }); const service = createPlanService(r);
    const preview = await service.preview(user, 'dump-1', { now: '2026-07-18T08:00:00+02:00', idempotencyKey: 'plan-87654321' });
    await expect(service.apply(user, preview.changeSetId, {})).rejects.toBeDefined(); expect(r.tasks).toHaveLength(0); expect(r.changes[0].status).toBe('failed'); expect(r.dumps[0].status).toBe('classified');
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
  it('lists saved Brain Dump drafts in Inbox even before a task is scheduled', async () => {
    const r = repos(); const service = createPlanService(r);

    const inbox = await service.inbox(user);

    expect(inbox.drafts).toEqual([expect.objectContaining({ id: 'dump-1', text: 'думки', status: 'classified' })]);
  });
  it('links confirmed proposals to an owned goal and creates Oracle edges', async () => {
    const r = repos({ goals: [{ id: 'goal-1', user: 'alice', title: 'Запустити застосунок', status: 'active' }] });
    const service = createPlanService(r);

    const preview = await service.preview(user, 'dump-1', { goalId: 'goal-1', idempotencyKey: 'plan-goal-123' });
    await service.apply(user, preview.changeSetId, {});
    await service.apply(user, preview.changeSetId, {});

    expect(r.tasks[0]).toMatchObject({ goalId: 'goal-1', sourceDump: 'dump-1' });
    expect(r.ideas[0]).toMatchObject({ goalId: 'goal-1', sourceDump: 'dump-1' });
    expect(r.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ fromType: 'task', toType: 'goal', fromId: r.tasks[0].id, toId: 'goal-1', status: 'confirmed' }),
      expect.objectContaining({ fromType: 'idea', toType: 'goal', fromId: r.ideas[0].id, toId: 'goal-1', status: 'confirmed' }),
    ]));
    expect(r.edges).toHaveLength(2);
    expect(r.changes[0].afterJson.appliedEdgeIds).toHaveLength(2);
  });
  it('rejects another user’s goal', async () => {
    const r = repos({ goals: [{ id: 'goal-bob', user: 'bob', title: 'Приватна мета', status: 'active' }] });
    const service = createPlanService(r);

    await expect(service.preview(user, 'dump-1', { goalId: 'goal-bob', idempotencyKey: 'plan-goal-456' }))
      .rejects.toMatchObject({ code: 'INVALID_PLAN' });
  });
  it('rolls back created Oracle edges before linked records when persistence fails', async () => {
    const r = repos({ goals: [{ id: 'goal-1', user: 'alice', title: 'Запустити застосунок', status: 'active' }] });
    r.goalGraphRepository.edges.create = vi.fn(async (_u: VerifiedUser, input: any) => {
      if (r.edges.length === 1) throw new Error('injected edge failure');
      const edge = { id: `edge-${r.edges.length + 1}`, user: 'alice', ...input };
      r.edges.push(edge);
      return edge;
    });
    const service = createPlanService(r);
    const preview = await service.preview(user, 'dump-1', { goalId: 'goal-1', idempotencyKey: 'plan-goal-rollback' });

    await expect(service.apply(user, preview.changeSetId, {})).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(r.edges).toHaveLength(0);
    expect(r.tasks).toHaveLength(0);
    expect(r.ideas).toHaveLength(0);
    expect(r.changes[0].status).toBe('failed');
  });
  it('rejects malformed stored proposal payloads before persistence', async () => {
    const r = repos(); const service = createPlanService(r);
    const preview = await service.preview(user, 'dump-1', { idempotencyKey: 'plan-malformed-payload' });
    r.changes[0].afterJson.tasks[0].estimatedMinutes = 'sixty';

    await expect(service.apply(user, preview.changeSetId, {})).rejects.toMatchObject({ code: 'INVALID_PLAN' });
    expect(r.tasks).toHaveLength(0);
    expect(r.ideas).toHaveLength(0);
  });
  it('revalidates stored goals immediately before applying', async () => {
    const r = repos({ goals: [{ id: 'goal-1', user: 'alice', title: 'Запустити застосунок', status: 'active' }] });
    const service = createPlanService(r);
    const preview = await service.preview(user, 'dump-1', { goalId: 'goal-1', idempotencyKey: 'plan-goal-revalidate' });
    r.goals[0].status = 'archived';

    await expect(service.apply(user, preview.changeSetId, {})).rejects.toMatchObject({ code: 'INVALID_PLAN' });
    expect(r.tasks).toHaveLength(0);
    expect(r.edges).toHaveLength(0);
  });
  it('updates reused records with the confirmed goal before linking them', async () => {
    const r = repos({ goals: [{ id: 'goal-1', user: 'alice', title: 'Запустити застосунок', status: 'active' }] });
    r.tasks.push({ id: 'existing-task', user: 'alice', sourceDump: 'dump-1', title: 'Підготувати структуру', status: 'inbox', goalId: null });
    r.ideas.push({ id: 'existing-idea', user: 'alice', sourceDump: 'dump-1', text: 'Епізод про синдром самозванця', status: 'backlog', goalId: null });
    const service = createPlanService(r);
    const preview = await service.preview(user, 'dump-1', { goalId: 'goal-1', idempotencyKey: 'plan-reuse-goal' });

    await service.apply(user, preview.changeSetId, {});

    expect(r.tasks).toEqual([expect.objectContaining({ id: 'existing-task', goalId: 'goal-1', sourceDump: 'dump-1' })]);
    expect(r.ideas).toEqual([expect.objectContaining({ id: 'existing-idea', goalId: 'goal-1', sourceDump: 'dump-1' })]);
    expect(r.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ fromId: 'existing-task', toId: 'goal-1' }),
      expect.objectContaining({ fromId: 'existing-idea', toId: 'goal-1' }),
    ]));
  });
  it('replaces obsolete confirmed goal links and deterministically removes persisted duplicates', async () => {
    const r = repos({ goals: [
      { id: 'goal-old', user: 'alice', title: 'Стара мета', status: 'active' },
      { id: 'goal-1', user: 'alice', title: 'Нова мета', status: 'active' },
    ] });
    r.tasks.push({ id: 'existing-task', user: 'alice', sourceDump: 'dump-1', title: 'Підготувати структуру', status: 'inbox', goalId: 'goal-old' });
    r.ideas.push({ id: 'existing-idea', user: 'alice', sourceDump: 'dump-1', text: 'Епізод про синдром самозванця', status: 'backlog', goalId: 'goal-old' });
    r.edges.push(
      { id: 'edge-task-old', user: 'alice', fromType: 'task', fromId: 'existing-task', toType: 'goal', toId: 'goal-old', status: 'confirmed' },
      { id: 'edge-task-z', user: 'alice', fromType: 'task', fromId: 'existing-task', toType: 'goal', toId: 'goal-1', status: 'confirmed' },
      { id: 'edge-task-a', user: 'alice', fromType: 'task', fromId: 'existing-task', toType: 'goal', toId: 'goal-1', status: 'confirmed' },
      { id: 'edge-idea-old', user: 'alice', fromType: 'idea', fromId: 'existing-idea', toType: 'goal', toId: 'goal-old', status: 'confirmed' },
      { id: 'edge-idea-z', user: 'alice', fromType: 'idea', fromId: 'existing-idea', toType: 'goal', toId: 'goal-1', status: 'confirmed' },
      { id: 'edge-idea-a', user: 'alice', fromType: 'idea', fromId: 'existing-idea', toType: 'goal', toId: 'goal-1', status: 'confirmed' },
    );
    const service = createPlanService(r);
    const preview = await service.preview(user, 'dump-1', { goalId: 'goal-1', idempotencyKey: 'plan-replace-goal' });

    await service.apply(user, preview.changeSetId, {});

    expect(r.edges.filter((edge) => edge.fromType === 'task' && edge.fromId === 'existing-task' && edge.toType === 'goal' && edge.status === 'confirmed'))
      .toEqual([expect.objectContaining({ id: 'edge-task-a', toId: 'goal-1' })]);
    expect(r.edges.filter((edge) => edge.fromType === 'idea' && edge.fromId === 'existing-idea' && edge.toType === 'goal' && edge.status === 'confirmed'))
      .toEqual([expect.objectContaining({ id: 'edge-idea-a', toId: 'goal-1' })]);
    expect(r.changes[0].afterJson.appliedEdgeIds).toEqual(['edge-task-a', 'edge-idea-a']);
  });
  it('restores reused records when a later linked-edge write fails', async () => {
    const r = repos({ goals: [{ id: 'goal-1', user: 'alice', title: 'Запустити застосунок', status: 'active' }] });
    r.tasks.push({ id: 'existing-task', user: 'alice', sourceDump: 'dump-1', title: 'Підготувати структуру', status: 'inbox', goalId: null });
    r.ideas.push({ id: 'existing-idea', user: 'alice', sourceDump: 'dump-1', text: 'Епізод про синдром самозванця', status: 'backlog', goalId: null });
    r.goalGraphRepository.edges.create = vi.fn(async (_u: VerifiedUser, input: any) => {
      if (r.edges.length === 1) throw new Error('injected edge failure');
      const edge = { id: `edge-${r.edges.length + 1}`, user: 'alice', ...input }; r.edges.push(edge); return edge;
    });
    const service = createPlanService(r);
    const preview = await service.preview(user, 'dump-1', { goalId: 'goal-1', idempotencyKey: 'plan-reuse-rollback' });

    await expect(service.apply(user, preview.changeSetId, {})).rejects.toMatchObject({ code: 'CONFLICT' });

    expect(r.tasks).toEqual([expect.objectContaining({ id: 'existing-task', goalId: null })]);
    expect(r.ideas).toEqual([expect.objectContaining({ id: 'existing-idea', goalId: null })]);
    expect(r.edges).toHaveLength(0);
  });
  it('deduplicates edges for duplicate proposals within one apply', async () => {
    const r = repos({ goals: [{ id: 'goal-1', user: 'alice', title: 'Запустити застосунок', status: 'active' }] });
    r.analysisService.result = vi.fn(async () => ({
      ...analysis,
      analysis: { ...analysis.analysis, tasks: [analysis.analysis.tasks[0], analysis.analysis.tasks[0]], ideas: [analysis.analysis.ideas[0], analysis.analysis.ideas[0]] },
    }));
    const service = createPlanService(r);
    const preview = await service.preview(user, 'dump-1', { goalId: 'goal-1', idempotencyKey: 'plan-duplicate-proposals' });

    await service.apply(user, preview.changeSetId, {});

    expect(r.tasks).toHaveLength(1);
    expect(r.ideas).toHaveLength(1);
    expect(r.edges).toHaveLength(2);
  });
  it('serializes concurrent applies through a durable Change Set reservation', async () => {
    const r = repos({ goals: [{ id: 'goal-1', user: 'alice', title: 'Запустити застосунок', status: 'active' }] });
    const firstService = createPlanService(r); const secondService = createPlanService(r);
    const preview = await firstService.preview(user, 'dump-1', { goalId: 'goal-1', idempotencyKey: 'plan-concurrent-apply' });

    const results = await Promise.allSettled([
      firstService.apply(user, preview.changeSetId, {}),
      secondService.apply(user, preview.changeSetId, {}),
    ]);

    expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
    expect(r.tasks).toHaveLength(1);
    expect(r.ideas).toHaveLength(1);
    expect(r.edges).toHaveLength(2);
    expect(r.changes).toContainEqual(expect.objectContaining({ mutationKey: `plan-apply:${preview.changeSetId}`, status: 'applied' }));
  });
  it('rejects reuse of an idempotency key with a different goal', async () => {
    const r = repos({ goals: [
      { id: 'goal-1', user: 'alice', title: 'Перша мета', status: 'active' },
      { id: 'goal-2', user: 'alice', title: 'Друга мета', status: 'active' },
    ] });
    const service = createPlanService(r);
    const first = await service.preview(user, 'dump-1', { goalId: 'goal-1', idempotencyKey: 'plan-goal-conflict' });

    await expect(service.preview(user, 'dump-1', { goalId: 'goal-2', idempotencyKey: 'plan-goal-conflict' }))
      .rejects.toMatchObject({ code: 'CONFLICT' });
    expect(r.changes[0].afterJson.tasks[0].goalId).toBe('goal-1');
    expect(first.tasks[0].goalId).toBe('goal-1');
  });
  it.each([
    ['missing canonical dump id', (payload: any) => { delete payload.dumpId; }],
    ['mismatched task dump id', (payload: any) => { payload.tasks[0].sourceDump = 'dump-other'; }],
    ['mismatched idea dump id', (payload: any) => { payload.ideas[0].sourceDump = 'dump-other'; }],
    ['missing proposal goal for a goal-aware plan', (payload: any) => { delete payload.tasks[0].goalId; }],
    ['mismatched proposal goal', (payload: any) => { payload.ideas[0].goalId = 'goal-other'; }],
    ['blank canonical goal id', (payload: any) => { payload.goalId = '   '; }],
    ['overlong proposal goal id', (payload: any) => { payload.tasks[0].goalId = 'g'.repeat(129); }],
  ])('rejects stored payload with %s before any apply write', async (_case, mutate) => {
    const r = repos({ goals: [{ id: 'goal-1', user: 'alice', title: 'Мета', status: 'active' }] });
    const service = createPlanService(r);
    const preview = await service.preview(user, 'dump-1', { goalId: 'goal-1', idempotencyKey: `plan-invalid-${String(_case)}` });
    mutate(r.changes[0].afterJson);
    vi.clearAllMocks();

    await expect(service.apply(user, preview.changeSetId, {})).rejects.toMatchObject({ code: 'INVALID_PLAN' });

    expect(r.taskRepository.create).not.toHaveBeenCalled();
    expect(r.taskRepository.update).not.toHaveBeenCalled();
    expect(r.ideaRepository.create).not.toHaveBeenCalled();
    expect(r.ideaRepository.update).not.toHaveBeenCalled();
    expect(r.goalGraphRepository.edges.create).not.toHaveBeenCalled();
    expect(r.goalGraphRepository.edges.delete).not.toHaveBeenCalled();
    expect(r.changeSetRepository.create).not.toHaveBeenCalled();
    expect(r.changeSetRepository.update).not.toHaveBeenCalled();
    expect(r.dumpRepository.update).not.toHaveBeenCalled();
  });
  it('rejects a stored payload whose exact source draft is not owned before any apply write', async () => {
    const r = repos(); const service = createPlanService(r);
    const preview = await service.preview(user, 'dump-1', { idempotencyKey: 'plan-missing-source-dump' });
    r.changes[0].afterJson.dumpId = 'dump-missing';
    r.changes[0].afterJson.tasks[0].sourceDump = 'dump-missing';
    r.changes[0].afterJson.ideas[0].sourceDump = 'dump-missing';
    vi.clearAllMocks();

    await expect(service.apply(user, preview.changeSetId, {})).rejects.toMatchObject({ code: 'INVALID_PLAN' });

    expect(r.changeSetRepository.create).not.toHaveBeenCalled();
    expect(r.taskRepository.create).not.toHaveBeenCalled();
    expect(r.ideaRepository.create).not.toHaveBeenCalled();
    expect(r.dumpRepository.update).not.toHaveBeenCalled();
  });
  it('reuses and applies a historical payload without top-level identities', async () => {
    const r = repos(); const service = createPlanService(r);
    const preview = await service.preview(user, 'dump-1', { idempotencyKey: 'plan-legacy-no-goal' });
    delete r.changes[0].afterJson.dumpId;
    delete r.changes[0].afterJson.goalId;
    for (const task of r.changes[0].afterJson.tasks) delete task.goalId;
    for (const idea of r.changes[0].afterJson.ideas) delete idea.goalId;

    const reused = await service.preview(user, 'dump-1', { idempotencyKey: 'plan-legacy-no-goal' });
    const applied = await service.apply(user, preview.changeSetId, {});

    expect(reused.changeSetId).toBe(preview.changeSetId);
    expect(applied.tasks).toEqual([expect.objectContaining({ goalId: null })]);
    expect(applied.ideas).toEqual([expect.objectContaining({ goalId: null })]);
    expect(r.edges).toHaveLength(0);
  });
  it.each([
    ['an inconsistent proposal sourceDump', (payload: any) => { payload.ideas[0].sourceDump = 'dump-other'; }],
    ['a missing proposal sourceDump', (payload: any) => { delete payload.tasks[0].sourceDump; }],
  ])('rejects a historical payload with %s before any apply write', async (_case, mutate) => {
    const r = repos(); const service = createPlanService(r);
    const preview = await service.preview(user, 'dump-1', { idempotencyKey: `plan-legacy-invalid-${String(_case)}` });
    delete r.changes[0].afterJson.dumpId;
    delete r.changes[0].afterJson.goalId;
    for (const task of r.changes[0].afterJson.tasks) delete task.goalId;
    for (const idea of r.changes[0].afterJson.ideas) delete idea.goalId;
    mutate(r.changes[0].afterJson);
    vi.clearAllMocks();

    await expect(service.apply(user, preview.changeSetId, {})).rejects.toMatchObject({ code: 'INVALID_PLAN' });

    expect(r.taskRepository.create).not.toHaveBeenCalled();
    expect(r.ideaRepository.create).not.toHaveBeenCalled();
    expect(r.dumpRepository.update).not.toHaveBeenCalled();
  });
  it('stores canonical dump and goal ids in preview Change Set payloads', async () => {
    const r = repos({ goals: [{ id: 'goal-1', user: 'alice', title: 'Мета', status: 'active' }] });
    const service = createPlanService(r);

    await service.preview(user, 'dump-1', { goalId: 'goal-1', idempotencyKey: 'plan-canonical-identities' });

    expect(r.changes[0].afterJson).toMatchObject({
      dumpId: 'dump-1',
      goalId: 'goal-1',
      tasks: [expect.objectContaining({ sourceDump: 'dump-1', goalId: 'goal-1' })],
      ideas: [expect.objectContaining({ sourceDump: 'dump-1', goalId: 'goal-1' })],
    });
  });
});
