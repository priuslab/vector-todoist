import type { SchedulerTask, TaskPriority } from './types.js';

const priority: Record<TaskPriority, number> = { low: 1, medium: 2, high: 3, urgent: 4 };
export interface TaskScore { hasDeadline: number; deadline: number; priority: number; alignment: number; id: string; }
export function scoreTask(task: SchedulerTask, now: Date): TaskScore {
  const deadline = task.deadline ? Date.parse(task.deadline) : Number.POSITIVE_INFINITY;
  return { hasDeadline: Number.isFinite(deadline) ? 1 : 0, deadline, priority: priority[task.priority], alignment: task.goalAlignment, id: task.id };
}
export function compareTasks(a: SchedulerTask, b: SchedulerTask, now: Date): number {
  const left = scoreTask(a, now); const right = scoreTask(b, now);
  if (left.hasDeadline !== right.hasDeadline) return right.hasDeadline - left.hasDeadline;
  if (left.deadline !== right.deadline) return left.deadline - right.deadline;
  if (left.priority !== right.priority) return right.priority - left.priority;
  if (left.alignment !== right.alignment) return right.alignment - left.alignment;
  return left.id.localeCompare(right.id);
}
