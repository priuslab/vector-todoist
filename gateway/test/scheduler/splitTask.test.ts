import { describe, expect, it } from 'vitest';
import { splitTask } from '../../src/modules/scheduler/splitTask.js';
import type { SchedulerTask } from '../../src/modules/scheduler/types.js';

const task: SchedulerTask = {
  id: 'deep-work', title: 'Підготувати епізод', estimatedMinutes: 95,
  priority: 'high', energy: 'high', goalAlignment: 1, deadline: null,
};

describe('splitTask', () => {
  it('splits long work into stable, bounded chunks without mutating input', () => {
    const result = splitTask(task, 45);
    expect(result.map((item) => [item.id, item.estimatedMinutes])).toEqual([
      ['deep-work::1', 45], ['deep-work::2', 45], ['deep-work::3', 5],
    ]);
    expect(task.estimatedMinutes).toBe(95);
  });

  it('rejects invalid focus block values', () => {
    expect(() => splitTask(task, 0)).toThrowError(/focusBlockMinutes/i);
  });
});
