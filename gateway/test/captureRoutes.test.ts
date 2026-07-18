import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { BrainDumpRepository } from '../src/repositories/brainDumpRepository.js';
import type { VerifiedUser } from '../src/auth/verifyPocketBaseToken.js';

const config = {
  nodeEnv: 'test' as const,
  host: '127.0.0.1', port: 8787, publicWebOrigin: 'https://app.vector.test',
  pocketbaseUrl: 'http://127.0.0.1:8090', trustProxy: false,
  enableGoogleIntegration: false, enableTelegramIntegration: false, enableStripeIntegration: false,
};
const alice: VerifiedUser = { userId: 'alice', email: 'alice@example.test' };
const bob: VerifiedUser = { userId: 'bob', email: 'bob@example.test' };

function repository() {
  let next = 0;
  const records: Array<Record<string, unknown>> = [];
  const create = vi.fn(async (user: VerifiedUser, input: Record<string, unknown>) => {
    const record = { id: `dump-${++next}`, user: user.userId, ...input };
    records.push(record);
    return record;
  });
  return {
    create,
    findByIdempotencyKey: vi.fn(async (user: VerifiedUser, key: string) => records.find((item) => item.user === user.userId && item.idempotencyKey === key) ?? null),
  } as unknown as BrainDumpRepository;
}

async function appFor(user = alice, dumpRepository = repository()) {
  const app = await buildApp({
    config,
    services: {
      authVerifier: { verify: vi.fn(async () => user) },
      brainDumpRepository: dumpRepository,
    },
  });
  return { app, dumpRepository };
}

describe('POST /api/v1/brain-dumps', () => {
  it('requires verified authentication', async () => {
    const app = await buildApp({ config, services: { authVerifier: { verify: vi.fn(async () => { throw new Error('no'); }) }, brainDumpRepository: repository() } });
    const response = await app.inject({ method: 'POST', url: '/api/v1/brain-dumps', payload: { kind: 'text', text: 'думка', timezone: 'Europe/Warsaw' } });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('validates kind, timezone, and bounded non-empty text', async () => {
    const { app } = await appFor();
    const empty = await app.inject({ method: 'POST', url: '/api/v1/brain-dumps', headers: { authorization: 'Bearer token' }, payload: { kind: 'voice', text: ' ', timezone: 'bad' } });
    expect(empty.statusCode).toBe(400);
    const tooLong = await app.inject({ method: 'POST', url: '/api/v1/brain-dumps', headers: { authorization: 'Bearer token' }, payload: { kind: 'text', text: 'x'.repeat(20_001), timezone: 'Europe/Warsaw' } });
    expect(tooLong.statusCode).toBe(400);
    await app.close();
  });

  it('normalizes text, sets source and owner server-side, and returns only safe draft fields', async () => {
    const { app, dumpRepository } = await appFor();
    const response = await app.inject({ method: 'POST', url: '/api/v1/brain-dumps', headers: { authorization: 'Bearer token', 'idempotency-key': 'k1' }, payload: { kind: 'text', text: '  Привіт\r\n  світ   \n\n  ще думка  ', timezone: 'Europe/Warsaw', source: 'telegram', user: 'attacker' } });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ id: 'dump-1', status: 'draft', rawText: 'Привіт\nсвіт\n\nще думка' });
    expect(dumpRepository.create).toHaveBeenCalledWith(alice, { kind: 'text', rawText: 'Привіт\nсвіт\n\nще думка', timezone: 'Europe/Warsaw', idempotencyKey: 'k1', source: 'web', status: 'received' });
    await app.close();
  });

  it('returns the same draft for an equivalent duplicate key but isolates users', async () => {
    const dumpRepository = repository();
    const { app } = await appFor(alice, dumpRepository);
    const request = { method: 'POST' as const, url: '/api/v1/brain-dumps', headers: { authorization: 'Bearer token', 'idempotency-key': 'same' }, payload: { kind: 'text', text: 'думка', timezone: 'Europe/Warsaw' } };
    const first = await app.inject(request); const duplicate = await app.inject(request);
    expect(first.statusCode).toBe(201); expect(duplicate.statusCode).toBe(201); expect(duplicate.json()).toEqual(first.json());
    expect(dumpRepository.create).toHaveBeenCalledTimes(1);
    await app.close();

    const other = await appFor(bob, dumpRepository);
    const crossUser = await other.app.inject(request);
    expect(crossUser.statusCode).toBe(201);
    expect(dumpRepository.create).toHaveBeenCalledTimes(2);
    await other.app.close();
  });

  it('rejects reusing a key for a different request and maps repository failures safely', async () => {
    const dumpRepository = repository();
    const { app } = await appFor(alice, dumpRepository);
    const base = { method: 'POST' as const, url: '/api/v1/brain-dumps', headers: { authorization: 'Bearer token', 'idempotency-key': 'same' }, payload: { kind: 'text', text: 'перше', timezone: 'Europe/Warsaw' } };
    await app.inject(base);
    const conflict = await app.inject({ ...base, payload: { ...base.payload, text: 'інше' } });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.body).not.toContain('перше');
    dumpRepository.create = vi.fn(async () => { throw new Error('PocketBase secret'); });
    const failed = await app.inject({ ...base, headers: { ...base.headers, 'idempotency-key': 'new' } });
    expect(failed.statusCode).toBe(503);
    expect(failed.body).not.toContain('PocketBase');
    await app.close();
  });

  it('recovers a concurrent unique-key winner by rereading the durable record', async () => {
    const winner = { id: 'winner', user: alice.userId, kind: 'text', rawText: 'одночасно', timezone: 'Europe/Warsaw', idempotencyKey: 'race' };
    const dumpRepository = {
      create: vi.fn(async () => { throw new Error('unique index'); }),
      findByIdempotencyKey: vi.fn(async () => winner),
    } as unknown as BrainDumpRepository;
    const { app } = await appFor(alice, dumpRepository);
    const response = await app.inject({ method: 'POST', url: '/api/v1/brain-dumps', headers: { authorization: 'Bearer token', 'idempotency-key': 'race' }, payload: { kind: 'text', text: 'одночасно', timezone: 'Europe/Warsaw' } });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ id: 'winner', status: 'draft', rawText: 'одночасно' });
    await app.close();
  });
});
