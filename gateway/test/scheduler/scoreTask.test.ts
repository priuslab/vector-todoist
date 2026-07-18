import { describe, expect, it } from 'vitest';
import { compareTasks, scoreTask } from '../../src/modules/scheduler/scoreTask.js';
import type { SchedulerTask } from '../../src/modules/scheduler/types.js';

const make = (id: string, patch: Partial<SchedulerTask> = {}): SchedulerTask => ({
  id, title: id, estimatedMinutes: 30, priority: 'medium', energy: 'medium', goalAlignment: 0.5, deadline: null, ...patch,
});

describe('scoreTask', () => {
  it('ranks hard deadlines and urgency before alignment and energy', () => {
    const urgent = make('z', { priority: 'urgent', deadline: '2026-07-18T15:00:00+02:00' });
    const aligned = make('a', { priority: 'high', goalAlignment: 1 });
    expect(compareTasks(urgent, aligned, new Date('2026-07-18T08:00:00+02:00'))).toBeLessThan(0);
    expect(scoreTask(urgent, new Date('2026-07-18T08:00:00+02:00')).priority).toBe(4);
  });

  it('uses task id as a deterministic tie breaker', () => {
    expect(compareTasks(make('a'), make('b'), new Date('2026-07-18T08:00:00Z'))).toBeLessThan(0);
  });
});
