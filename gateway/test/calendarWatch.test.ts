import { describe, expect, it, vi } from 'vitest';
import { createCalendarWatchService } from '../src/integrations/google/calendarWatch.js';

const user = { userId: 'u1', email: 'olena@example.com' };
const connection = { user: 'u1', provider: 'google' as const, status: 'connected' as const, encryptedRefreshToken: 'encrypted' };

function setup() {
  const watches: any[] = [];
  const jobs: any[] = [];
  const repository = { get: vi.fn(async (_user: any, calendarId: string) => watches.find((item) => item.user === _user.userId && item.calendarId === calendarId) ?? null), getByChannel: vi.fn(async (channelId: string) => watches.find((item) => item.channelId === channelId) ?? null), upsert: vi.fn(async (_user: any, input: any) => { const old = watches.find((item) => item.user === _user.userId && item.calendarId === input.calendarId); const { channelToken: _secret, ...safe } = input; const item = { id: old?.id ?? `watch-${watches.length + 1}`, user: _user.userId, ...safe }; if (old) Object.assign(old, item); else watches.push(item); return item; }), update: vi.fn() };
  const jobRepository = { getByIdempotencyKey: vi.fn(async (_user: any, key: string) => jobs.find((item) => item.user === _user.userId && item.idempotencyKey === key) ?? null), create: vi.fn(async (_user: any, input: any) => { const item = { id: `job-${jobs.length + 1}`, user: _user.userId, ...input }; jobs.push(item); return item; }) };
  const provider = { watch: vi.fn().mockResolvedValue({ resourceId: 'resource-1', expiration: '2099-01-01T00:00:00.000Z' }), stop: vi.fn() };
  const service = createCalendarWatchService({ repository, connectionRepository: { get: vi.fn().mockResolvedValue(connection) }, provider, jobRepository, now: () => Date.parse('2026-07-18T00:00:00Z'), randomToken: (bytes) => `token-${bytes}` });
  return { service, repository, jobRepository, provider, watches, jobs };
}

describe('Google Calendar watch channels', () => {
  it('uses random channel credentials, stores ownership, and schedules renewal', async () => {
    const state = setup();
    const watch = await state.service.ensure(user);
    expect(watch).toMatchObject({ user: 'u1', calendarId: 'primary', channelTokenHash: expect.any(String), resourceId: 'resource-1', status: 'active' });
    expect(state.provider.watch).toHaveBeenCalledWith(expect.objectContaining({ calendarId: 'primary', channelId: 'vector-token-18', channelToken: 'token-32' }));
    expect(state.jobs[0]).toMatchObject({ type: 'calendar.watch.renew', payloadJson: { watchId: watch.id } });
  });

  it('renews expired watches and rejects expired or mismatched notifications', async () => {
    const state = setup();
    state.watches.push({ id: 'old', user: 'u1', calendarId: 'primary', channelId: 'old-channel', channelToken: 'old-token', resourceId: 'old-resource', expiration: '2020-01-01T00:00:00Z', status: 'active' });
    const watch = await state.service.ensure(user);
    expect(watch.channelId).toBe('vector-token-18');
    await expect(state.service.validateNotification({ channelId: 'old-channel', channelToken: 'old-token', resourceId: 'old-resource' })).rejects.toThrow();
    await expect(state.service.validateNotification({ channelId: watch.channelId, channelToken: 'token-32', resourceId: watch.resourceId })).resolves.toMatchObject({ id: watch.id, channelId: watch.channelId, resourceId: watch.resourceId });
  });
});
