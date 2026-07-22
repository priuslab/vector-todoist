import type { SchedulerMode, SchedulerTask, TaskPriority } from './types.js';

const priority: Record<TaskPriority, number> = { low: 1, medium: 2, high: 3, urgent: 4 };
export interface TaskScore { hasDeadline: number; deadline: number; priority: number; alignment: number; focus: number; id: string; }
export function scoreTask(task: SchedulerTask, now: Date, mode: SchedulerMode = 'balanced', goalId?: string): TaskScore {
  const deadline = task.deadline ? Date.parse(task.deadline) : Number.POSITIVE_INFINITY;
  const focus = mode === 'goal_focus' ? (goalId && (task as SchedulerTask & { goalId?: string }).goalId === goalId ? 1 : task.goalAlignment) : 0;
  return { hasDeadline: Number.isFinite(deadline) ? 1 : 0, deadline, priority: priority[task.priority], alignment: task.goalAlignment, focus, id: task.id };
}
export function compareTasks(a: SchedulerTask, b: SchedulerTask, now: Date, mode: SchedulerMode = 'balanced', goalId?: string): number {
  const left = scoreTask(a, now, mode, goalId); const right = scoreTask(b, now, mode, goalId);
  if (mode === 'goal_focus' && left.focus !== right.focus) return right.focus - left.focus;
  if (left.hasDeadline !== right.hasDeadline) return right.hasDeadline - left.hasDeadline;
  if (left.deadline !== right.deadline) return left.deadline - right.deadline;
  if (left.priority !== right.priority) return right.priority - left.priority;
  if (left.alignment !== right.alignment) return right.alignment - left.alignment;
  return left.id.localeCompare(right.id);
}
