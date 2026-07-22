import { describe, expect, it } from 'vitest';
import { createGoalDiscoveryService, loadGoalDiscoveryProtocol, type GoalDiscoveryRepository, type GoalDiscoverySessionRecord } from '../src/modules/goals/goalDiscoveryService.js';

const user = { userId: 'alice', email: 'a@example.com' };
function repo(): GoalDiscoveryRepository {
  const rows: GoalDiscoverySessionRecord[] = [];
  return {
    async create(u, input) { const row = { id: `s-${rows.length + 1}`, user: u.userId, ...input } as GoalDiscoverySessionRecord; rows.push(row); return row; },
    async get(u, id) { return rows.find((row) => row.id === id && row.user === u.userId) ?? null; },
    async update(u, id, input) { const row = rows.find((item) => item.id === id && item.user === u.userId); if (!row) throw new Error('missing'); Object.assign(row, input); return row; },
    async list(u) { return rows.filter((row) => row.user === u.userId); },
  };
}

describe('goal discovery protocol and sessions', () => {
  it('fails closed when the protocol is missing or malformed', async () => {
    expect(loadGoalDiscoveryProtocol(null)).toBeNull();
    const service = createGoalDiscoveryService({ repository: repo(), protocol: null });
    expect(service.enabled).toBe(false);
    await expect(service.start(user)).rejects.toMatchObject({ code: 'DISABLED' });
  });
  it('resumes an owned session, bounds answers, and returns an editable suggestion', async () => {
    const service = createGoalDiscoveryService({ repository: repo(), now: () => '2026-07-19T10:00:00Z', aiClient: { complete: async () => ({ title: 'Запустити подкаст', rationale: 'Це наступний важливий результат.', confidence: 0.8 }) } });
    const started = await service.start(user);
    expect(started.status).toBe('active');
    const resumed = await service.get(user, started.id);
    expect(resumed.id).toBe(started.id);
    const partial = await service.answer(user, started.id, [{ id: 'attention', text: 'Подкаст' }]);
    expect(partial.status).toBe('active');
    await expect(service.answer(user, started.id, [{ id: 'unknown', text: 'x' }])).rejects.toMatchObject({ code: 'INVALID_GOAL_DISCOVERY' });
    const completed = await service.answer(user, started.id, [{ id: 'result', text: 'Запустити перший сезон' }]);
    expect(completed.status).toBe('completed');
    expect(completed.suggestion).toMatchObject({ title: 'Запустити подкаст', editable: true });
    const edited = await service.edit(user, started.id, { title: 'Запустити сезон подкасту', rationale: 'Можу змінити цю чернетку перед створенням мети.' });
    expect(edited.suggestion?.title).toBe('Запустити сезон подкасту');
  });
  it('rejects diagnostic language and enforces ownership', async () => {
    const service = createGoalDiscoveryService({ repository: repo() });
    const started = await service.start(user);
    await expect(service.get({ userId: 'bob', email: 'b@example.com' }, started.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await service.answer(user, started.id, [{ id: 'attention', text: 'План' }, { id: 'result', text: 'Завершити план' }]);
    await expect(service.edit(user, started.id, { title: 'Мій діагноз', rationale: 'медичний висновок' })).rejects.toMatchObject({ code: 'INVALID_GOAL_DISCOVERY' });
  });
});
