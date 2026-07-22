import { describe, expect, it, vi } from 'vitest';
import { createGoogleCalendarClient } from '../src/integrations/google/calendarClient.js';
import { createBusySlotService } from '../src/modules/calendar/busySlotService.js';

const connection = { user: 'u1', provider: 'google' as const, status: 'connected' as const, encryptedRefreshToken: 'encrypted' };
const user = { userId: 'u1', email: 'olena@example.com', token: 'pb-token' };

describe('Google calendar busy slots', () => {
  it('decrypts, merges overlaps, ignores declined events, and normalizes all-day events', async () => {
    const refresh = vi.fn().mockResolvedValue({ accessToken: 'access-1' });
    const listEvents = vi.fn().mockResolvedValue([
      { id: 'a', start: { dateTime: '2026-07-18T11:00:00+02:00' }, end: { dateTime: '2026-07-18T11:45:00+02:00' } },
      { id: 'b', start: { dateTime: '2026-07-18T11:30:00+02:00' }, end: { dateTime: '2026-07-18T12:00:00+02:00' } },
      { id: 'declined', status: 'declined', start: { dateTime: '2026-07-18T13:00:00+02:00' }, end: { dateTime: '2026-07-18T14:00:00+02:00' } },
      { id: 'all-day', start: { date: '2026-07-18' }, end: { date: '2026-07-19' } },
    ]);
    const client = createGoogleCalendarClient({ encryptionKey: 'key', decrypt: vi.fn().mockReturnValue('refresh-1'), provider: { refreshAccessToken: refresh, listEvents } });
    const result = await client.listBusyIntervals({ connection, date: '2026-07-18', timezone: 'Europe/Warsaw', workday: { start: '09:00', end: '18:00' } });
    expect(refresh).toHaveBeenCalledOnce();
    expect(listEvents).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'access-1', calendarId: 'primary' }));
    expect(result.intervals).toHaveLength(1);
    expect(result.intervals[0]).toMatchObject({ start: '2026-07-18T07:00:00.000Z', end: '2026-07-18T16:00:00.000Z' });
  });

  it('refreshes at most once after an expired access token', async () => {
    const refresh = vi.fn().mockResolvedValueOnce({ accessToken: 'expired' }).mockResolvedValueOnce({ accessToken: 'fresh' });
    const listEvents = vi.fn().mockRejectedValueOnce(new Error('401')).mockResolvedValueOnce([]);
    const client = createGoogleCalendarClient({ encryptionKey: 'key', decrypt: () => 'refresh', provider: { refreshAccessToken: refresh, listEvents } });
    await client.listBusyIntervals({ connection, date: '2026-07-18', timezone: 'UTC', workday: { start: '09:00', end: '18:00' } });
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(listEvents).toHaveBeenCalledTimes(2);
  });

  it('uses event.start.timeZone when Google omits an offset and merges multiple calendars', async () => {
    const listEvents = vi.fn(async ({ calendarId }: { calendarId: string }) => [{ id: calendarId, start: { dateTime: '2026-07-18T11:00:00', timeZone: 'Europe/Warsaw' }, end: { dateTime: '2026-07-18T12:00:00', timeZone: 'Europe/Warsaw' } }]);
    const client = createGoogleCalendarClient({ encryptionKey: 'key', calendarIds: ['primary', 'work'], decrypt: () => 'refresh', provider: { refreshAccessToken: vi.fn().mockResolvedValue({ accessToken: 'access' }), listEvents } });
    const result = await client.listBusyIntervals({ connection, date: '2026-07-18', timezone: 'UTC', workday: { start: '09:00', end: '18:00' } });
    expect(listEvents).toHaveBeenCalledTimes(2);
    expect(result.intervals).toEqual([{ id: 'primary-0', start: '2026-07-18T09:00:00.000Z', end: '2026-07-18T10:00:00.000Z', locked: true }]);
  });
});

describe('calendar stale sync', () => {
  it('preserves last successful slots and marks them stale on provider failure', async () => {
    const repo = {
      list: vi.fn().mockResolvedValue([{ id: 'busy', start: '2026-07-18T09:00:00Z', end: '2026-07-18T10:00:00Z', locked: true, syncedAt: '2026-07-17T10:00:00Z' }]),
      metadata: vi.fn().mockResolvedValue({ date: '2026-07-18', syncedAt: '2026-07-17T10:00:00Z', stale: false }),
      replace: vi.fn(), markStale: vi.fn().mockResolvedValue({ date: '2026-07-18', syncedAt: '2026-07-17T10:00:00Z', stale: true }),
    };
    const service = createBusySlotService({ connectionRepository: { get: vi.fn().mockResolvedValue(connection) }, busySlotRepository: repo, googleCalendarClient: { listBusyIntervals: vi.fn().mockRejectedValue(new Error('offline')) } });
    const result = await service.sync(user, '2026-07-18', { timezone: 'UTC' });
    expect(result.stale).toBe(true);
    expect(result.slots).toHaveLength(1);
    expect(result.warning).toContain('останню успішну');
    expect(repo.markStale).toHaveBeenCalledOnce();
  });

  it('preserves metadata when a successful sync has zero busy slots', async () => {
    const repo = {
      list: vi.fn().mockResolvedValue([]),
      metadata: vi.fn().mockResolvedValue({ date: '2026-07-18', syncedAt: '2026-07-18T08:00:00Z', stale: false }),
      replace: vi.fn().mockResolvedValue([]), markStale: vi.fn().mockResolvedValue({ date: '2026-07-18', syncedAt: '2026-07-18T08:00:00Z', stale: true }),
    };
    const client = { listBusyIntervals: vi.fn().mockResolvedValue({ intervals: [], syncedAt: '2026-07-18T08:00:00Z' }) };
    const service = createBusySlotService({ connectionRepository: { get: vi.fn().mockResolvedValue(connection) }, busySlotRepository: repo, googleCalendarClient: client });
    const result = await service.sync(user, '2026-07-18', { timezone: 'UTC' });
    expect(result.slots).toEqual([]);
    expect(result.stale).toBe(false);
    expect(result.syncedAt).toBe('2026-07-18T08:00:00Z');
  });

  it('treats a day with no sync metadata as stale and unknown', async () => {
    const service = createBusySlotService({ connectionRepository: { get: vi.fn().mockResolvedValue(null) }, busySlotRepository: { list: vi.fn().mockResolvedValue([]), metadata: vi.fn().mockResolvedValue(null), replace: vi.fn(), markStale: vi.fn() }, googleCalendarClient: { listBusyIntervals: vi.fn() } });
    const result = await service.day(user, '2026-07-18');
    expect(result.stale).toBe(true);
    expect(result.syncedAt).toBeNull();
    expect(result.warning).toContain('ще не синхронізовано');
  });
});
