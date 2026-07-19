import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { calendarWebhookRoutes } from '../src/modules/calendar/calendarWebhookRoutes.js';

const watch = { id: 'watch-1', user: 'u1', calendarId: 'primary', channelId: 'channel-1', channelToken: 'secret-token', resourceId: 'resource-1', expiration: '2099-01-01T00:00:00.000Z', status: 'active' as const };

async function setup() {
  const app = Fastify();
  const validateNotification = vi.fn(async (input: { channelId?: string; channelToken?: string; resourceId?: string }) => {
    if (input.channelId !== watch.channelId || input.channelToken !== watch.channelToken || input.resourceId !== watch.resourceId) throw new Error('invalid');
    return watch;
  });
  const jobs: any[] = [];
  const jobRepository = { getByIdempotencyKey: vi.fn(async (_user: any, key: string) => jobs.find((job) => job.idempotencyKey === key) ?? null), create: vi.fn(async (_user: any, input: any) => { const job = { id: `job-${jobs.length + 1}`, user: 'u1', ...input }; jobs.push(job); return job; }) };
  await calendarWebhookRoutes(app, { watchService: { validateNotification }, jobRepository });
  return { app, validateNotification, jobRepository, jobs };
}

describe('Google Calendar webhook', () => {
  it('validates persisted channel/resource and queues an owned reconciliation job', async () => {
    const state = await setup();
    const response = await state.app.inject({ method: 'POST', url: '/webhooks/google/calendar', headers: { 'x-goog-channel-id': watch.channelId, 'x-goog-channel-token': watch.channelToken, 'x-goog-resource-id': watch.resourceId, 'x-goog-resource-state': 'exists', 'x-goog-message-number': '1' } });
    expect(response.statusCode).toBe(204);
    expect(state.jobRepository.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }), expect.objectContaining({ type: 'calendar.reconcile', payloadJson: expect.objectContaining({ userId: 'u1', calendarId: 'primary' }) }));
    expect(state.jobs).toHaveLength(1);
  });

  it('acknowledges duplicate notification identity without creating another job', async () => {
    const state = await setup();
    const headers = { 'x-goog-channel-id': watch.channelId, 'x-goog-channel-token': watch.channelToken, 'x-goog-resource-id': watch.resourceId, 'x-goog-resource-state': 'exists', 'x-goog-message-number': '2' };
    expect((await state.app.inject({ method: 'POST', url: '/webhooks/google/calendar', headers })).statusCode).toBe(204);
    expect((await state.app.inject({ method: 'POST', url: '/webhooks/google/calendar', headers })).statusCode).toBe(204);
    expect(state.jobRepository.create).toHaveBeenCalledOnce();
  });

  it('rejects malformed or unpaired notifications and never trusts body user ids', async () => {
    const state = await setup();
    expect((await state.app.inject({ method: 'POST', url: '/webhooks/google/calendar', payload: { userId: 'attacker' }, headers: { 'x-goog-channel-id': 'bad', 'x-goog-channel-token': 'bad', 'x-goog-resource-id': 'bad', 'x-goog-resource-state': 'exists', 'x-goog-message-number': '3' } })).statusCode).toBe(400);
    expect(state.jobRepository.create).not.toHaveBeenCalled();
    expect((await state.app.inject({ method: 'POST', url: '/webhooks/google/calendar', headers: { 'x-goog-channel-id': watch.channelId } })).statusCode).toBe(400);
  });
});
