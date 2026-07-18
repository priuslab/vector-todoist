export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskEnergy = 'low' | 'medium' | 'high';
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
  start?: string;
  end?: string;
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
export interface DailyPlanInput { tasks: SchedulerTask[]; busySlots: SchedulerBusySlot[]; profile: SchedulerProfile; now: Date; }
export interface DailyPlan { blocks: PlannedBlock[]; unscheduledTaskIds: string[]; warnings: PlanWarning[]; reasons: Record<string, ScheduleReason[]>; }
export class SchedulerValidationError extends Error { constructor(message: string) { super(message); this.name = 'SchedulerValidationError'; } }
