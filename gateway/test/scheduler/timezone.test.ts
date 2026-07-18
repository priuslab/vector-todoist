import { describe, expect, it } from 'vitest';
import { buildDailyPlan } from '../../src/modules/scheduler/buildDailyPlan.js';
import type { SchedulerProfile, SchedulerTask } from '../../src/modules/scheduler/types.js';

const task: SchedulerTask = { id: 'dst', title: 'DST', estimatedMinutes: 60, priority: 'high', energy: 'high', goalAlignment: 1, deadline: null };
const profile: SchedulerProfile = { timezone: 'Europe/Warsaw', workHours: { start: '09:00', end: '18:00' }, energyPeak: { start: '09:00', end: '12:00' }, focusBlockMinutes: 90, breakMinutes: 10, dailyLimitMinutes: 120 };

describe('scheduler timezone handling', () => {
  it('preserves absolute duration across a DST transition', () => {
    const result = buildDailyPlan({ tasks: [task], busySlots: [], profile, now: new Date('2026-10-25T07:00:00Z') });
    const block = result.blocks.find((item) => item.kind === 'task');
    expect(block).toBeDefined();
    expect(Date.parse(block!.end) - Date.parse(block!.start)).toBe(60 * 60 * 1000);
  });
});
