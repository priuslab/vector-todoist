export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskEnergy = 'low' | 'medium' | 'high';
export type SchedulerMode = 'balanced' | 'goal_focus';
export type ScheduleReasonCode = 'deadline' | 'priority' | 'energy' | 'busy-conflict' | 'daily-cap' | 'no-viable-slot' | 'split';

export interface SchedulerTask {
  id: string;
  title: string;
  estimatedMinutes: number;
  priority: TaskPriority;
  energy: TaskEnergy;
  goalAlignment: number;
  deadline: string | null;
  locked?: boolean;
  flexible?: boolean;
  status?: string;
  calendarEventId?: string;
  calendarSource?: 'google' | 'app';
  start?: string;
  end?: string;
  category?: string;
}

export interface SchedulerBusySlot { id: string; title: string; start: string; end: string; locked: true; }
export interface SchedulerProfile {
  timezone: string;
  workHours: { start: string; end: string };
  energyPeak: { start: string; end: string };
  focusBlockMinutes: number;
  breakMinutes: number;
  dailyLimitMinutes: number;
}
export type PlannedBlockKind = 'busy' | 'task' | 'break';
export interface PlannedBlock { id: string; kind: PlannedBlockKind; title: string; start: string; end: string; locked: boolean; taskId?: string; }
export interface PlanWarning { code: 'daily-cap' | 'no-viable-slot' | 'deadline-conflict'; message: string; taskId?: string; }
export interface ScheduleReason { code: ScheduleReasonCode; message: string; }
export interface DailyPlanInput { tasks: SchedulerTask[]; busySlots: SchedulerBusySlot[]; profile: SchedulerProfile; now: Date; mode?: SchedulerMode; goalId?: string; acceptedAdaptations?: AcceptedAdaptation[]; }
export interface AcceptedAdaptation { category?: string; energy?: TaskEnergy; multiplier: number; }
export function applyAcceptedAdaptations(task: SchedulerTask, adjustments: AcceptedAdaptation[] = []): SchedulerTask {
  const matching = adjustments.filter((a) => (a.category === undefined || a.category === (task as SchedulerTask & { category?: string }).category) && (a.energy === undefined || a.energy === task.energy));
  if (!matching.length) return task;
  const multiplier = Math.min(1.75, Math.max(.75, matching.reduce((value, item) => value * Math.min(1.75, Math.max(.75, Number(item.multiplier))), 1)));
  return { ...task, estimatedMinutes: Math.max(1, Math.round(task.estimatedMinutes * multiplier)) };
}
export interface DailyPlan { blocks: PlannedBlock[]; unscheduledTaskIds: string[]; warnings: PlanWarning[]; reasons: Record<string, ScheduleReason[]>; }
export class SchedulerValidationError extends Error { constructor(message: string) { super(message); this.name = 'SchedulerValidationError'; } }
