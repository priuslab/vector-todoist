import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PocketBaseClient, PocketBaseRecord } from '../../pocketbase/client.js';
import type { VerifiedUser } from '../../auth/verifyPocketBaseToken.js';

export type TelegramPairingRecord = PocketBaseRecord & { user: string; tokenHash: string; expiresAt: string; consumedAt?: string; chatId?: string };
export type TelegramConnectionRecord = PocketBaseRecord & { user: string; chatId: string; username?: string; status: 'connected' | 'disabled'; connectedAt: string };
export interface TelegramPairingRepository {
  createPairing(user: VerifiedUser, input: Omit<TelegramPairingRecord, 'id' | 'user'>): Promise<TelegramPairingRecord>;
  findPairingByHash(tokenHash: string): Promise<TelegramPairingRecord | null>;
  consumePairing(id: string, chatId: string): Promise<TelegramPairingRecord | null>;
  getConnectionByUser(user: VerifiedUser): Promise<TelegramConnectionRecord | null>;
  getConnectionByChat(chatId: string): Promise<TelegramConnectionRecord | null>;
  upsertConnection(user: VerifiedUser, input: Omit<TelegramConnectionRecord, 'id' | 'user'>): Promise<TelegramConnectionRecord>;
  deleteConnection(user: VerifiedUser): Promise<void>;
}

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const safeToken = () => randomBytes(32).toString('base64url');

export function createTelegramPairingService(deps: { repository: TelegramPairingRepository; botUsername: string; now?: () => number; randomToken?: () => string; ttlMs?: number }) {
  const now = deps.now ?? (() => Date.now());
  const random = deps.randomToken ?? safeToken;
  const ttlMs = Math.min(Math.max(Math.floor(deps.ttlMs ?? 10 * 60_000), 60_000), 24 * 60 * 60_000);
  return {
    async createPairLink(user: VerifiedUser) {
      const token = random();
      const expiresAt = new Date(now() + ttlMs).toISOString();
      await deps.repository.createPairing(user, { tokenHash: hash(token), expiresAt });
      return { token, expiresAt, deepLink: `https://t.me/${deps.botUsername.replace(/^@/, '')}?start=pair_${token}` };
    },
  async consumePairToken(token: string, chatId: string, username?: string) {
      if (!token) return null;
      const encoded = token.startsWith('pair_') ? token.slice(5) : token;
      if (!/^[A-Za-z0-9_-]{8,200}$/.test(encoded)) return null;
      const row = await deps.repository.findPairingByHash(hash(encoded));
      if (!row || Date.parse(row.expiresAt) <= now() || row.consumedAt) return null;
      const consumed = await deps.repository.consumePairing(row.id, chatId);
      if (!consumed) return null;
      const user = { userId: consumed.user, email: '' };
      await deps.repository.upsertConnection(user, { chatId, username, status: 'connected', connectedAt: new Date(now()).toISOString() });
      return consumed;
    },
    async status(user: VerifiedUser) { const connection = await deps.repository.getConnectionByUser(user); return connection ? { status: connection.status, chatId: connection.chatId } : { status: 'disconnected' as const }; },
    disconnect(user: VerifiedUser) { return deps.repository.deleteConnection(user); },
    async findByChat(chatId: string) { return deps.repository.getConnectionByChat(chatId); },
  };
}

export type TelegramPairingService = ReturnType<typeof createTelegramPairingService>;

export async function telegramRoutes(app: FastifyInstance, service: TelegramPairingService, options: { webhookSecret?: string; onUpdate?: (update: unknown) => Promise<void> } = {}): Promise<void> {
  app.post('/api/v1/integrations/telegram/pair-link', { preHandler: (request, reply) => app.requireUser(request, reply) }, async (request: FastifyRequest, reply: FastifyReply) => reply.send(await service.createPairLink(request.user)));
  app.get('/api/v1/integrations/telegram/status', { preHandler: (request, reply) => app.requireUser(request, reply) }, async (request: FastifyRequest, reply: FastifyReply) => reply.send(await service.status(request.user)));
  app.delete('/api/v1/integrations/telegram', { preHandler: (request, reply) => app.requireUser(request, reply) }, async (request: FastifyRequest, reply: FastifyReply) => { await service.disconnect(request.user); return reply.code(204).send(); });
  app.post('/webhooks/telegram', async (request: FastifyRequest, reply: FastifyReply) => {
    const supplied = String(request.headers['x-telegram-bot-api-secret-token'] ?? '');
    const expected = options.webhookSecret?.trim();
    if (!expected || supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return reply.code(401).send({ error: 'UNAUTHORIZED_WEBHOOK' });
    if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body) || typeof (request.body as { update_id?: unknown }).update_id !== 'number') return reply.code(400).send({ error: 'INVALID_TELEGRAM_UPDATE' });
    try { await options.onUpdate?.(request.body); } catch { return reply.code(503).send({ error: 'TELEGRAM_PROCESSING_RETRY' }); }
    return reply.code(200).send({ ok: true });
  });
}

export function createTelegramPairingRepository(client: PocketBaseClient): TelegramPairingRepository {
  const esc = (value: string) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
  return {
    async createPairing(user, input) { return client.create<TelegramPairingRecord>('telegram_pairings', { ...input, user: user.userId }); },
    async findPairingByHash(tokenHash) { const rows = await client.list<TelegramPairingRecord>('telegram_pairings', `tokenHash = '${esc(tokenHash)}'`); return rows.find((row) => row.tokenHash === tokenHash && !row.consumedAt) ?? null; },
    async consumePairing(id, chatId) { const rows = await client.list<TelegramPairingRecord>('telegram_pairings', `id = '${esc(id)}'`); const row = rows[0]; if (!row || row.consumedAt) return null; try { await client.create('telegram_pairing_claims', { pairingId: id, chatId, claimedAt: new Date().toISOString() }); } catch { return null; } return client.update<TelegramPairingRecord>('telegram_pairings', id, { consumedAt: new Date().toISOString(), chatId }); },
    async getConnectionByUser(user) { const rows = await client.list<TelegramConnectionRecord>('telegram_connections', `user = '${esc(user.userId)}'`); return rows.find((row) => row.user === user.userId && row.status === 'connected') ?? null; },
    async getConnectionByChat(chatId) { const rows = await client.list<TelegramConnectionRecord>('telegram_connections', `chatId = '${esc(chatId)}'`); return rows.find((row) => row.chatId === chatId && row.status === 'connected') ?? null; },
    async upsertConnection(user, input) { const existing = await this.getConnectionByUser(user); return existing ? client.update<TelegramConnectionRecord>('telegram_connections', existing.id, { ...input, user: user.userId }) : client.create<TelegramConnectionRecord>('telegram_connections', { ...input, user: user.userId }); },
    async deleteConnection(user) { const existing = await this.getConnectionByUser(user); if (existing) await client.update('telegram_connections', existing.id, { status: 'disabled' }); },
  };
}
