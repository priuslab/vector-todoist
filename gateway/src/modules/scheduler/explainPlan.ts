import type { ScheduleReason, SchedulerTask } from './types.js';
export function explainTask(task: SchedulerTask, split: boolean, energyFit: boolean): ScheduleReason[] {
  const reasons: ScheduleReason[] = [{ code: 'priority', message: `Пріоритет: ${task.priority}` }];
  if (task.deadline) reasons.push({ code: 'deadline', message: 'Є дедлайн, тому задача має вищий порядок' });
  if (task.goalAlignment > 0) reasons.push({ code: 'priority', message: 'Задача підтримує головну мету' });
  if (energyFit) reasons.push({ code: 'energy', message: 'Час підібрано під рівень енергії' });
  if (split) reasons.push({ code: 'split', message: 'Задачу розбито на коротші фокус-блоки' });
  return reasons;
}
export function explainPlan(task: SchedulerTask, split = false, energyFit = false): ScheduleReason[] {
  return explainTask(task, split, energyFit);
}
