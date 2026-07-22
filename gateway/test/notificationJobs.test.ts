import { describe, expect, it, vi } from 'vitest';
import { createMemoryNotificationClaimStore, createPocketBaseNotificationClaimStore, createTelegramNotificationJobHandler } from '../src/modules/notifications/notificationJobs.js';

const job = (payload: Record<string, unknown>) => ({ id: 'job-1', type: 'telegram.notification.task_reminder', idempotencyKey: 'key', payloadJson: { preferences: { timezone: 'Europe/Warsaw', quietHours: { start: '21:00', end: '08:00' } }, ...payload }, status: 'processing', attempts: 0 });

describe('Telegram notification jobs', () => {
  it('sends a supportive reminder once when two workers race', async () => {
    const telegram = { sendMessage: vi.fn().mockResolvedValue(undefined) };
    const claims = createMemoryNotificationClaimStore();
    const handler = createTelegramNotificationJobHandler({ telegram, claims, now: () => new Date('2026-07-18T12:00:00.000Z') });
    await Promise.all([handler(job({ type: 'task_reminder', recipientId: 'u1', chatId: 'c1', timezone: 'Europe/Warsaw', taskId: 't1', taskVersion: 1, title: 'Підготувати епізод' }) as never), handler(job({ type: 'task_reminder', recipientId: 'u1', chatId: 'c1', timezone: 'Europe/Warsaw', taskId: 't1', taskVersion: 1, title: 'Підготувати епізод' }) as never)]);
    expect(telegram.sendMessage).toHaveBeenCalledOnce();
    expect(telegram.sendMessage.mock.calls[0][1]).toContain('Підготувати епізод');
  });

  it('includes Undo in a reschedule summary and releases a claim after transient failure', async () => {
    const sendMessage = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    const claims = createMemoryNotificationClaimStore();
    const handler = createTelegramNotificationJobHandler({ telegram: { sendMessage }, claims, now: () => new Date('2026-07-18T12:00:00.000Z') });
    const payload = { type: 'reschedule', recipientId: 'u1', chatId: 'c1', timezone: 'Europe/Warsaw', count: 5, changeSetId: 'change-1', date: '2026-07-18' };
    await expect(handler(job(payload) as never)).rejects.toThrow('offline');
    await handler(job(payload) as never);
    expect(sendMessage.mock.calls[1][2].inlineKeyboard[0][1]).toEqual({ text: 'Undo', callbackData: 'undo:change-1' });
  });

  it('quiet hours and disabled rituals produce a safe no-op', async () => {
    const sendMessage = vi.fn();
    const handler = createTelegramNotificationJobHandler({ telegram: { sendMessage }, claims: createMemoryNotificationClaimStore(), now: () => new Date('2026-07-18T20:30:00.000Z') });
    await handler(job({ type: 'morning_plan', recipientId: 'u1', chatId: 'c1', timezone: 'Europe/Warsaw', preferences: { timezone: 'Europe/Warsaw', quietHours: { start: '21:00', end: '08:00' }, morningPlanEnabled: false } }) as never);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('uses a durable unique PocketBase claim across worker processes', async () => {
    const records: any[] = [];
    const client: any = {
      async create(_collection: string, data: any) { if (records.some((row) => row.notificationKey === data.notificationKey)) throw new Error('unique'); const row = { id: `c${records.length + 1}`, ...data }; records.push(row); return row; },
      async list(_collection: string, _filter: string) { return records; },
      async delete(_collection: string, id: string) { const index = records.findIndex((row) => row.id === id); if (index >= 0) records.splice(index, 1); },
    };
    const first = createPocketBaseNotificationClaimStore(client);
    const second = createPocketBaseNotificationClaimStore(client);
    expect(await Promise.all([first.claim('telegram:u1:morning_plan:2026-07-18'), second.claim('telegram:u1:morning_plan:2026-07-18')])).toEqual([true, false]);
    await first.release?.('telegram:u1:morning_plan:2026-07-18');
    expect(await second.claim('telegram:u1:morning_plan:2026-07-18')).toBe(true);
  });
});
