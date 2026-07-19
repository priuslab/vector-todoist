import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { createTelegramPairingService, telegramRoutes } from '../src/integrations/telegram/pairingService.js';

const user = { userId: 'user-1', email: 'olena@example.com' };

function setup() {
  const records: any[] = [];
  const repository = {
    createPairing: vi.fn(async (_user: any, input: any) => { const row = { id: `pair-${records.length + 1}`, user: _user.userId, ...input }; records.push(row); return row; }),
    findPairingByHash: vi.fn(async (hash: string) => records.find((row) => row.tokenHash === hash && !row.consumedAt) ?? null),
    consumePairing: vi.fn(async (id: string, chatId: string) => { const row = records.find((item) => item.id === id); if (!row || row.consumedAt) return null; row.consumedAt = new Date().toISOString(); row.chatId = chatId; return row; }),
    getConnectionByUser: vi.fn(async (_user: any) => records.find((row) => row.type === 'connection' && row.user === _user.userId) ?? null),
    getConnectionByChat: vi.fn(async (chatId: string) => records.find((row) => row.type === 'connection' && row.chatId === chatId) ?? null),
    upsertConnection: vi.fn(async (_user: any, input: any) => { const row = { id: 'conn-1', type: 'connection', user: _user.userId, ...input }; records.push(row); return row; }),
    deleteConnection: vi.fn(async (_user: any) => { for (const row of records.filter((item) => item.type === 'connection' && item.user === _user.userId)) records.splice(records.indexOf(row), 1); }),
  };
  const service = createTelegramPairingService({ repository, botUsername: 'vector_test_bot', now: () => 1_700_000_000_000, randomToken: () => 'safe-token', ttlMs: 60_000 });
  return { service, repository, records };
}

describe('Telegram pairing', () => {
  it('creates a single-use expiring deep link and stores only a hash', async () => {
    const state = setup();
    const result = await state.service.createPairLink(user);
    expect(result.deepLink).toBe('https://t.me/vector_test_bot?start=pair_safe-token');
    expect(state.records[0].tokenHash).not.toContain('safe-token');
    expect(state.records[0].rawToken).toBeUndefined();
  });

  it('consumes a token once and rejects expired or replayed tokens', async () => {
    const state = setup();
    const link = await state.service.createPairLink(user);
    expect((await state.service.consumePairToken(link.token, 'chat-1'))?.user).toBe('user-1');
    expect(await state.service.consumePairToken(link.token, 'chat-2')).toBeNull();
  });

  it('allows only one concurrent consumer to claim a pairing token', async () => {
    const state = setup();
    const link = await state.service.createPairLink(user);
    const results = await Promise.all([state.service.consumePairToken(link.token, 'chat-1'), state.service.consumePairToken(link.token, 'chat-2')]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('protects routes with auth and configured webhook secret', async () => {
    const state = setup();
    const app = Fastify();
    app.decorate('requireUser', async (request: any) => { request.user = user; });
    await telegramRoutes(app, state.service, { webhookSecret: 'webhook-secret' });
    expect((await app.inject({ method: 'POST', url: '/api/v1/integrations/telegram/pair-link' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/webhooks/telegram', payload: {} })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/webhooks/telegram', headers: { 'x-telegram-bot-api-secret-token': 'webhook-secret' }, payload: {} })).statusCode).toBe(400);
  });
});
