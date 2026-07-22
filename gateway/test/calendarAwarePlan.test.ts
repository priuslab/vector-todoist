import { expect, it, vi } from 'vitest';
import { createPlanService } from '../src/modules/planning/planService.js';

const user = { userId: 'alice', email: 'alice@example.test' };
const repos = () => ({
  dumpRepository: { get: vi.fn(async () => ({ id: 'dump', user: 'alice', rawText: 'думки' })) },
  analysisService: { result: vi.fn(async () => ({ id: 'session', status: 'classified', analysis: { summary: 'ok', confidence: 1, questions: [], context: [], tasks: [{ title: 'Задача', description: '', priority: 'high', estimatedMinutes: 30, deadline: null, energy: 'high', confidence: 1 }], ideas: [] } })) },
  taskRepository: { list: vi.fn(async () => []) },
  ideaRepository: { list: vi.fn(async () => []) },
  changeSetRepository: (() => { let row: any; return { list: vi.fn(async () => row ? [row] : []), create: vi.fn(async (_u: any, input: any) => (row = { id: 'change', user: 'alice', ...input })), get: vi.fn(async () => row), update: vi.fn(async (_u: any, _id: string, input: any) => (row = { ...row, ...input })) }; })(),
});

it('injects calendar busy slots and warns before applying a stale calendar plan', async () => {
  const service = createPlanService({ ...repos(), calendarService: { day: vi.fn(async () => ({ date: '2026-07-18', slots: [{ id: 'meeting', start: '2026-07-18T11:00:00+02:00', end: '2026-07-18T11:45:00+02:00' }], syncedAt: '2026-07-17T10:00:00Z', stale: true, warning: 'stale' })) } as any });
  const preview = await service.preview(user, 'dump', { calendarDate: '2026-07-18', now: '2026-07-18T08:00:00+02:00', idempotencyKey: 'calendar-plan-1' });
  expect(preview.blocks.some((block) => block.kind === 'busy' && block.locked)).toBe(true);
  expect(preview.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'calendar-stale' })]));
  await expect(service.apply(user, preview.changeSetId, {})).rejects.toBeDefined();
});
