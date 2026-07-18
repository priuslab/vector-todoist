import { describe, expect, it } from 'vitest';
import { buildDailyPlan } from '../../src/modules/scheduler/buildDailyPlan.js';
import type { SchedulerBusySlot, SchedulerProfile, SchedulerTask } from '../../src/modules/scheduler/types.js';

const profile: SchedulerProfile = {
  timezone: 'Europe/Warsaw', workHours: { start: '09:00', end: '18:00' },
  energyPeak: { start: '09:30', end: '12:30' }, focusBlockMinutes: 60,
  breakMinutes: 10, dailyLimitMinutes: 180,
};
const now = new Date('2026-07-18T08:00:00+02:00');
const task = (id: string, patch: Partial<SchedulerTask> = {}): SchedulerTask => ({
  id, title: id, estimatedMinutes: 30, priority: 'medium', energy: 'medium', goalAlignment: 0.5, deadline: null, ...patch,
});
const busy: SchedulerBusySlot[] = [{ id: 'meeting', title: 'Командний синк', start: '2026-07-18T11:00:00+02:00', end: '2026-07-18T11:45:00+02:00', locked: true }];

describe('buildDailyPlan', () => {
  it('preserves locked busy slots and places urgent work first', () => {
    const result = buildDailyPlan({ tasks: [task('normal'), task('urgent', { priority: 'urgent', estimatedMinutes: 45 })], busySlots: busy, profile, now });
    expect(result.blocks.find((block) => block.id === 'meeting')).toMatchObject({ kind: 'busy', locked: true, start: busy[0].start, end: busy[0].end });
    expect(result.reasons.meeting.some((reason) => reason.code === 'busy-conflict')).toBe(true);
    expect(result.blocks.find((block) => block.kind === 'task')?.taskId).toBe('urgent');
  });

  it('fits high energy work in peak, splits long tasks, and inserts a break', () => {
    const result = buildDailyPlan({ tasks: [task('focus', { energy: 'high', estimatedMinutes: 90 })], busySlots: [], profile, now });
    const blocks = result.blocks.filter((block) => block.kind === 'task');
    expect(blocks.map((block) => block.id)).toEqual(['focus::1', 'focus::2']);
    expect(blocks[0].start).toBe('2026-07-18T09:30:00+02:00');
    expect(result.blocks.some((block) => block.kind === 'break')).toBe(true);
  });

  it('reports cap overflow and never overlaps blocks', () => {
    const result = buildDailyPlan({ tasks: [task('a', { estimatedMinutes: 120 }), task('b', { estimatedMinutes: 120 })], busySlots: [], profile: { ...profile, dailyLimitMinutes: 120 }, now });
    expect(result.unscheduledTaskIds).toContain('b');
    expect(result.warnings.some((warning) => warning.code === 'daily-cap')).toBe(true);
    const intervals = result.blocks.map((b) => [Date.parse(b.start), Date.parse(b.end)]).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < intervals.length; i += 1) expect(intervals[i][0]).toBeGreaterThanOrEqual(intervals[i - 1][1]);
  });

  it('is deterministic and does not mutate inputs', () => {
    const tasks = [task('b'), task('a')];
    const before = JSON.stringify(tasks);
    const one = buildDailyPlan({ tasks, busySlots: [], profile, now });
    const two = buildDailyPlan({ tasks, busySlots: [], profile, now });
    expect(JSON.stringify(one)).toBe(JSON.stringify(two));
    expect(JSON.stringify(tasks)).toBe(before);
  });

  it('rejects malformed intervals and profiles', () => {
    expect(() => buildDailyPlan({ tasks: [task('bad')], busySlots: [{ ...busy[0], end: busy[0].start }], profile, now })).toThrowError(/interval/i);
    expect(() => buildDailyPlan({ tasks: [], busySlots: [], profile: { ...profile, workHours: { start: '18:00', end: '09:00' } }, now })).toThrowError(/workHours/i);
    expect(() => buildDailyPlan({ tasks: [], busySlots: [busy[0], { ...busy[0], id: 'overlap', start: '2026-07-18T11:30:00+02:00', end: '2026-07-18T12:00:00+02:00' }], profile, now })).toThrowError(/overlap/i);
  });

  it('does not schedule in the past when planning starts midday', () => {
    const result = buildDailyPlan({ tasks: [task('later')], busySlots: [], profile, now: new Date('2026-07-18T14:07:00+02:00') });
    expect(result.blocks.find((block) => block.kind === 'task')?.start).toBe('2026-07-18T14:15:00+02:00');
  });

  it('requires configured breaks between split chunks', () => {
    const result = buildDailyPlan({ tasks: [task('tight', { estimatedMinutes: 90 })], busySlots: [], profile: { ...profile, workHours: { start: '09:00', end: '10:30' } }, now });
    expect(result.unscheduledTaskIds).toEqual(['tight']);
    expect(result.reasons.tight.some((reason) => reason.code === 'no-viable-slot')).toBe(true);
  });
});
