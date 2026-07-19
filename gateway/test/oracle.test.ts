import { describe, expect, it, vi } from 'vitest';
import { createOracleService } from '../src/modules/oracle/oracleService.js';
import { buildApp } from '../src/app.js';
import type { GoalGraphRepository } from '../src/repositories/goalGraphRepository.js';

const alice = { userId: 'alice', email: 'alice@test' };
const bob = { userId: 'bob', email: 'bob@test' };
function setup() {
  const rows: Record<string, any[]> = {
    goals: [{ id: 'g1', user: 'alice', title: 'Запустити подкаст', status: 'active', deadline: '2026-09-30T00:00:00+02:00' }],
    projects: [{ id: 'p1', user: 'alice', title: 'Пілотний епізод', status: 'active', goalId: 'g1' }],
    ideas: [{ id: 'i1', user: 'alice', text: 'Синдром самозванця', status: 'backlog', goalId: null }],
    edges: [
      { id: 'e-proposed', user: 'alice', fromType: 'idea', fromId: 'i1', toType: 'project', toId: 'p1', actor: 'ai', status: 'proposed' },
      { id: 'e-confirmed', user: 'alice', fromType: 'project', fromId: 'p1', toType: 'goal', toId: 'g1', actor: 'user', status: 'confirmed' },
    ],
  };
  const repo = Object.fromEntries(['goals', 'projects', 'ideas', 'edges'].map((name) => [name, { list: vi.fn(async (u: any) => rows[name].filter((r) => r.user === u.userId)), get: vi.fn(async (u: any, id: string) => rows[name].find((r) => r.user === u.userId && r.id === id) ?? null) }])) as unknown as GoalGraphRepository;
  const tasks = [{ id: 't1', user: 'alice', title: 'Підготувати структуру', status: 'completed' }, { id: 't2', user: 'bob', title: 'Чуже', status: 'inbox' }];
  const taskRepository = { list: vi.fn(async (u: any) => tasks.filter((t) => t.user === u.userId)) } as any;
  return { rows, repository: repo, service: createOracleService({ repository: repo, taskRepository }) };
}

describe('Oracle alignment and deterministic paths', () => {
  it('keeps completed nodes visible and muted; deadline does not change score', async () => {
    const s = setup(); const graph = await s.service.graph(alice);
    expect(graph.nodes.find((n) => n.id === 't1')).toMatchObject({ completed: true, muted: true });
    const withDeadline = graph.nodes.find((n) => n.id === 'g1')!.alignmentScore;
    s.rows.goals[0].deadline = null; const withoutDeadline = (await s.service.graph(alice)).nodes.find((n) => n.id === 'g1')!.alignmentScore;
    expect(withDeadline).toBe(withoutDeadline);
  });
  it('prefers a confirmed user link over an AI proposal and returns stable shortest path', async () => {
    const s = setup(); const result = await s.service.path(alice, { fromType: 'idea', fromId: 'i1', goalId: 'g1' });
    expect(result.found).toBe(true); expect(result.nodeIds).toEqual(['i1', 'p1', 'g1']); expect(result.score).toBe(0.5);
    s.rows.edges.push({ id: 'e-direct', user: 'alice', fromType: 'idea', fromId: 'i1', toType: 'goal', toId: 'g1', actor: 'ai', status: 'confirmed' });
    const direct = await s.service.path(alice, { fromType: 'idea', fromId: 'i1', goalId: 'g1' });
    expect(direct.nodeIds).toEqual(['i1', 'g1']); expect(direct.score).toBe(0.85);
  });
  it('guards cycles and explains missing paths without fabricating edges', async () => {
    const s = setup(); s.rows.edges.push({ id: 'cycle', user: 'alice', fromType: 'project', fromId: 'p1', toType: 'idea', toId: 'i1', actor: 'user', status: 'confirmed' });
    const missing = await s.service.path(alice, { fromType: 'task', fromId: 'unknown', goalId: 'g1' });
    expect(missing.found).toBe(false); expect(missing.edgeIds).toEqual([]); expect(missing.explanation).toContain('Не знайшов');
    const insight = await s.service.insight(alice, { fromType: 'idea', fromId: 'i1', goalId: 'g1' }); expect(insight.explanation).toBeTruthy();
    const crossUser = await s.service.path(bob, { fromType: 'idea', fromId: 'i1', goalId: 'g1' }); expect(crossUser.found).toBe(false);
  });
  it('isolates another user and validates strict authenticated oracle routes', async () => {
    const s = setup(); const config = { nodeEnv: 'test' as const, host: '127.0.0.1', port: 8787, publicWebOrigin: 'https://app.vector.test', pocketbaseUrl: 'http://pb.test', trustProxy: false, enableGoogleIntegration: false, enableTelegramIntegration: false, enableStripeIntegration: false };
    const app = await buildApp({ config, services: { authVerifier: { verify: vi.fn(async (auth?: string) => auth ? alice : Promise.reject(new Error('unauthorized'))) }, goalGraphRepository: s.repository, oracleService: s.service } });
    const graph = await app.inject({ method: 'GET', url: '/api/v1/oracle/graph', headers: { authorization: 'Bearer token' } }); expect(graph.statusCode).toBe(200);
    expect(graph.json().nodes.some((n: any) => n.id === 't2')).toBe(false);
    const invalid = await app.inject({ method: 'GET', url: '/api/v1/oracle/path?fromType=bad&fromId=i1&goalId=g1', headers: { authorization: 'Bearer token' } }); expect(invalid.statusCode).toBe(422); await app.close(); void bob;
  });
});
