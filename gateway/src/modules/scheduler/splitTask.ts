import type { SchedulerTask } from './types.js';
import { SchedulerValidationError } from './types.js';

export function splitTask(task: SchedulerTask, focusBlockMinutes: number): SchedulerTask[] {
  if (!Number.isInteger(focusBlockMinutes) || focusBlockMinutes <= 0) throw new SchedulerValidationError('focusBlockMinutes must be a positive integer');
  if (!Number.isInteger(task.estimatedMinutes) || task.estimatedMinutes <= 0) throw new SchedulerValidationError(`Invalid duration for task ${task.id}`);
  const count = Math.ceil(task.estimatedMinutes / focusBlockMinutes);
  if (count === 1) return [{ ...task }];
  return Array.from({ length: count }, (_, index) => ({ ...task, id: `${task.id}::${index + 1}`, estimatedMinutes: Math.min(focusBlockMinutes, task.estimatedMinutes - index * focusBlockMinutes) }));
}
