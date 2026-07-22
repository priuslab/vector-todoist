import { describe, expect, it } from 'vitest';
import { isQuietHours, localDate, notificationKey, shouldSendNotification } from '../src/modules/notifications/notificationPolicy.js';

const preferences = { timezone: 'Europe/Warsaw', quietHours: { start: '21:00', end: '08:00' }, remindersEnabled: true, morningPlanEnabled: true, eveningReviewEnabled: true };

describe('Telegram notification policy', () => {
  it('applies quiet hours in the user timezone, including overnight interval', () => {
    expect(isQuietHours(new Date('2026-07-18T20:30:00.000Z'), preferences.quietHours, preferences.timezone)).toBe(true); // 22:30 local
    expect(isQuietHours(new Date('2026-07-18T06:30:00.000Z'), preferences.quietHours, preferences.timezone)).toBe(false); // 08:30 local
    expect(isQuietHours(new Date('2026-07-18T05:30:00.000Z'), preferences.quietHours, preferences.timezone)).toBe(true); // 07:30 local
    expect(isQuietHours(new Date('2026-07-18T12:00:00.000Z'), preferences.quietHours, preferences.timezone)).toBe(false);
  });

  it('uses the local calendar date through DST boundaries', () => {
    expect(localDate(new Date('2026-10-25T00:30:00.000Z'), 'Europe/Warsaw')).toBe('2026-10-25');
    expect(localDate(new Date('2026-10-24T23:30:00.000Z'), 'Europe/Warsaw')).toBe('2026-10-25');
  });

  it('suppresses ordinary reminders but allows critical system messages', () => {
    const at = new Date('2026-07-18T20:30:00.000Z');
    expect(shouldSendNotification({ type: 'task_reminder', recipientId: 'u1', at, preferences })).toEqual({ allowed: false, reason: 'quiet_hours' });
    expect(shouldSendNotification({ type: 'system', recipientId: 'u1', at, preferences })).toEqual({ allowed: true, reason: 'allowed' });
  });

  it('keys task reminders by recipient, task and version, rituals by local date', () => {
    expect(notificationKey({ type: 'task_reminder', recipientId: 'u1', taskId: 't1', taskVersion: 2 })).not.toBe(notificationKey({ type: 'task_reminder', recipientId: 'u1', taskId: 't1', taskVersion: 3 }));
    expect(notificationKey({ type: 'morning_plan', recipientId: 'u1', localDate: '2026-07-18' })).toBe('telegram:u1:morning_plan:2026-07-18');
  });
});
