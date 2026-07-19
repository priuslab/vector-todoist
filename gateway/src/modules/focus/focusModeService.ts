import { z } from 'zod';
import type { VerifiedUser } from '../../auth/verifyPocketBaseToken.js';
import { RepositoryError } from '../../repositories/base.js';
import type { ChangeSetRecord, ChangeSetRepository } from '../../repositories/changeSetRepository.js';
import type { TaskRecord, TaskRepository } from '../../repositories/taskRepository.js';
import { buildDailyPlan } from '../scheduler/buildDailyPlan.js';
import type { SchedulerBusySlot, SchedulerMode, SchedulerProfile, SchedulerTask } from '../scheduler/types.js';

export type FocusMode = 'balanced' | 'goal_focus';
export class FocusValidationError extends Error { readonly code = 'INVALID_FOCUS'; }
export class FocusNotFoundError extends Error { readonly code = 'NOT_FOUND'; }
export class FocusConflictError extends Error { readonly code = 'CONFLICT'; }

const iso = z.string().datetime({ offset: true });
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const profileSchema = z.object({
  timezone: z.string().min(1).max(80).default('Europe/Warsaw'),
  workHours: z.object({ start: clock, end: clock }).default({ start: '09:00', end: '18:00' }),
  energyPeak: z.object({ start: clock, end: clock }).default({ start: '09:30', end: '12:30' }),
  focusBlockMinutes: z.number().int().min(5).max(480).default(50),
  breakMinutes: z.number().int().min(0).max(120).default(10),
  dailyLimitMinutes: z.number().int().min(0).max(1_440).default(360),
}).default({});
const busySlotSchema = z.object({ id: z.string().min(1).max(160), title: z.string().min(1).max(500), start: iso, end: iso, locked: z.literal(true).optional() }).strict();
const inputSchema = z.object({
  mode: z.enum(['balanced', 'goal_focus']).default('balanced'),
  goalId: z.string().trim().min(1).max(128).optional(),
  timezone: z.string().min(1).max(80).optional(),
  now: iso.optional(),
  profile: profileSchema,
  busySlots: z.array(busySlotSchema).max(100).default([]),
  idempotencyKey: z.string().trim().min(8).max(255).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.mode === 'goal_focus' && !value.goalId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['goalId'], message: 'goalId is required' });
});
export type FocusInput = z.infer<typeof inputSchema>;

export type FocusDeferred = { taskId: string; title: string; reason: string };
export type FocusTaskSnapshot = { id: string; title?: string; status?: string; plannedStart?: string | null; plannedEnd?: string | null; version?: string | number; flexible?: boolean; locked?: boolean; deadline?: string | null; goalId?: string | null; goalAlignment?: number };
export type FocusPreview = { mode: FocusMode; goalId?: string; deferred: FocusDeferred[]; warnings: string[]; tasks: FocusTaskSnapshot[]; plan: ReturnType<typeof buildDailyPlan> };
export type FocusResult = FocusPreview & { changeSet: { id: string; status: string; kind: string }; undoId: string };

const snapshot = (task: TaskRecord): FocusTaskSnapshot => ({ id: task.id, title: typeof task.title === 'string' ? task.title : undefined, status: typeof task.status === 'string' ? task.status : undefined, plannedStart: typeof task.plannedStart === 'string' ? task.plannedStart : null, plannedEnd: typeof task.plannedEnd === 'string' ? task.plannedEnd : null, version: typeof task.version === 'number' || typeof task.version === 'string' ? task.version : undefined, flexible: typeof task.flexible === 'boolean' ? task.flexible : undefined, locked: typeof task.locked === 'boolean' ? task.locked : undefined, deadline: typeof task.deadline === 'string' ? task.deadline : null, goalId: typeof task.goalId === 'string' ? task.goalId : null, goalAlignment: typeof task.goalAlignment === 'number' ? task.goalAlignment : undefined });
const publicChange = (record: ChangeSetRecord) => ({ id: record.id, status: String(record.status ?? ''), kind: String(record.kind ?? 'focus_mode') });
const owned = (task: TaskRecord, user: VerifiedUser) => task.user === user.userId;

function normalize(raw: unknown): FocusInput {
  const parsed = inputSchema.safeParse(raw ?? {});
  if (!parsed.success) throw new FocusValidationError();
  return parsed.data;
}
function isImmutable(task: TaskRecord, now: Date): string | undefined {
  const start = task.plannedStart ? Date.parse(String(task.plannedStart)) : NaN;
  const end = task.plannedEnd ? Date.parse(String(task.plannedEnd)) : NaN;
  if (task.status === 'completed') return 'Завершена задача залишається у плані';
  if (task.locked || task.flexible === false) return 'Заблокована задача залишається у плані';
  if (task.calendarSource === 'google' || (task.calendarEventId && task.calendarSource !== 'app')) return 'Подія Google Calendar залишається без змін';
  if (Number.isFinite(start) && Number.isFinite(end) && start < now.getTime() && end > now.getTime()) return 'Активний блок залишається без змін';
  if (Number.isFinite(end) && end <= now.getTime()) return 'Минулий блок залишається без змін';
  return undefined;
}
function isHardDeadline(task: TaskRecord, now: Date): boolean {
  if (!task.deadline) return false;
  const deadline = Date.parse(String(task.deadline));
  return Number.isFinite(deadline) && deadline <= now.getTime() + 48 * 60 * 60 * 1000;
}

export interface FocusModeService { preview(user: VerifiedUser, input: unknown): Promise<FocusPreview>; apply(user: VerifiedUser, input: unknown): Promise<FocusResult>; }
export function createFocusModeService(deps: { taskRepository: TaskRepository; changeSetRepository: ChangeSetRepository; now?: () => Date }): FocusModeService {
  const { taskRepository, changeSetRepository, now: clockNow = () => new Date() } = deps;
  const locks = new Map<string, Promise<void>>();
  async function calculate(user: VerifiedUser, input: FocusInput): Promise<FocusPreview & { records: TaskRecord[]; before: FocusTaskSnapshot[]; after: FocusTaskSnapshot[] }> {
    const current = input.now ? new Date(input.now) : clockNow();
    const tasks = (await taskRepository.list(user)).filter((task) => owned(task, user));
    const deferred: FocusDeferred[] = [];
    const warnings: string[] = [];
    const before = tasks.map(snapshot);
    const after = before.map((item) => ({ ...item }));
    if (input.mode === 'goal_focus') {
      if (!input.goalId) throw new FocusValidationError();
      tasks.forEach((task, index) => {
        const immutable = isImmutable(task, current);
        const related = task.goalId === input.goalId || Number(task.goalAlignment ?? 0) >= 0.5;
        if (!immutable && !related && !isHardDeadline(task, current) && task.status !== 'cancelled') {
          deferred.push({ taskId: task.id, title: String(task.title ?? 'Задача'), reason: 'Не пов’язана з обраною метою — повернеться в Balanced' });
          after[index] = { ...after[index], plannedStart: null, plannedEnd: null, status: 'needs_reschedule' };
        } else if (isHardDeadline(task, current) && !immutable && !related) warnings.push(`Дедлайн «${String(task.title ?? 'Задача')}» залишається видимим, навіть якщо він не пов’язаний з метою`);
      });
    }
    const schedulerTasks: SchedulerTask[] = tasks.filter((task, index) => !deferred.some((item) => item.taskId === task.id) && task.status !== 'cancelled').map((task) => ({ id: task.id, title: String(task.title ?? 'Задача'), estimatedMinutes: Number(task.estimatedMinutes ?? 25), priority: (task.priority ?? 'medium') as SchedulerTask['priority'], energy: (task.energy ?? 'medium') as SchedulerTask['energy'], goalAlignment: Number(task.goalAlignment ?? 0.5), deadline: task.deadline ? String(task.deadline) : null, flexible: task.flexible !== false, locked: Boolean(task.locked), status: task.status, calendarEventId: typeof task.calendarEventId === 'string' ? task.calendarEventId : undefined, calendarSource: task.calendarSource === 'google' ? 'google' : task.calendarSource === 'app' ? 'app' : undefined, start: task.plannedStart ? String(task.plannedStart) : undefined, end: task.plannedEnd ? String(task.plannedEnd) : undefined, ...(typeof task.goalId === 'string' ? { goalId: task.goalId } : {}) } as SchedulerTask));
    const profile: SchedulerProfile = { ...input.profile, timezone: input.timezone ?? input.profile.timezone };
    let plan;
    try { plan = buildDailyPlan({ tasks: schedulerTasks, busySlots: input.busySlots.map((slot) => ({ ...slot, locked: true as const })), profile, now: current, mode: input.mode as SchedulerMode, goalId: input.goalId }); } catch { throw new FocusValidationError(); }
    if (plan.warnings.length > 0) warnings.push(...plan.warnings.map((warning) => warning.message));
    return { mode: input.mode, ...(input.goalId ? { goalId: input.goalId } : {}), deferred, warnings, tasks: after, plan, records: tasks, before, after };
  }
  async function applyInner(user: VerifiedUser, input: FocusInput): Promise<FocusResult> {
    const key = input.idempotencyKey ?? `focus:${user.userId}:${input.mode}:${input.goalId ?? 'none'}`;
    const existing = (await changeSetRepository.list(user)).find((record) => record.idempotencyKey === key);
    if (existing?.status === 'applied') return resultFrom(existing);
    if (existing?.status === 'pending') throw new FocusConflictError();
    const calculated = await calculate(user, input);
    let change = existing;
    if (!change) {
      try { change = await changeSetRepository.create(user, { kind: 'focus_mode', status: 'pending', idempotencyKey: key, beforeJson: { mode: 'balanced', tasks: calculated.before }, afterJson: { mode: calculated.mode, goalId: calculated.goalId, tasks: calculated.after, deferred: calculated.deferred, warnings: calculated.warnings } }); }
      catch { const raced = (await changeSetRepository.list(user)).find((record) => record.idempotencyKey === key); if (raced?.status === 'applied') return resultFrom(raced); if (raced) throw new FocusConflictError(); throw new RepositoryError('UNAVAILABLE'); }
    }
    if (!change) throw new RepositoryError('UNAVAILABLE');
    const changed = calculated.after.filter((item, index) => JSON.stringify(item) !== JSON.stringify(calculated.before[index]));
    try {
      for (const item of changed) {
        const current = calculated.records.find((task) => task.id === item.id);
        if (!current) throw new FocusNotFoundError();
        const patch = { plannedStart: item.plannedStart, plannedEnd: item.plannedEnd, status: item.status, version: (Number(current.version) || 0) + 1 };
        if (taskRepository.updateIfVersion) await taskRepository.updateIfVersion(user, item.id, Number(current.version ?? 0), patch);
        else await taskRepository.update(user, item.id, patch);
      }
      const applied = await changeSetRepository.update(user, change.id, { status: 'applied', afterJson: { mode: calculated.mode, goalId: calculated.goalId, tasks: calculated.after, deferred: calculated.deferred, warnings: calculated.warnings } });
      return resultFrom(applied, calculated);
    } catch (error) {
      try { await changeSetRepository.update(user, change.id, { status: 'failed' }); } catch { /* keep reservation */ }
      if (error instanceof FocusNotFoundError) throw error;
      if (error instanceof RepositoryError && error.code === 'INVALID') throw new FocusConflictError();
      throw error;
    }
  }
  function resultFrom(change: ChangeSetRecord, calculated?: FocusPreview & { records: TaskRecord[]; before: FocusTaskSnapshot[]; after: FocusTaskSnapshot[] }): FocusResult {
    const payload = change.afterJson && typeof change.afterJson === 'object' ? change.afterJson as Record<string, any> : {};
    const preview = calculated ?? { mode: payload.mode === 'goal_focus' ? 'goal_focus' : 'balanced', ...(typeof payload.goalId === 'string' ? { goalId: payload.goalId } : {}), deferred: Array.isArray(payload.deferred) ? payload.deferred : [], warnings: Array.isArray(payload.warnings) ? payload.warnings : [], tasks: Array.isArray(payload.tasks) ? payload.tasks : [], plan: { blocks: [], unscheduledTaskIds: [], warnings: [], reasons: {} } };
    return { ...preview, changeSet: publicChange(change), undoId: change.id } as FocusResult;
  }
  const apply = async (user: VerifiedUser, raw: unknown) => {
    const input = normalize(raw); const key = `${user.userId}:${input.idempotencyKey ?? `focus:${input.mode}:${input.goalId ?? 'none'}`}`; const prior = locks.get(key) ?? Promise.resolve(); let release!: () => void; const current = new Promise<void>((resolve) => { release = resolve; }); const queued = prior.then(() => current); locks.set(key, queued); await prior; try { return await applyInner(user, input); } finally { release(); if (locks.get(key) === queued) locks.delete(key); }
  };
  return { async preview(user, raw) { const calculated = await calculate(user, normalize(raw)); const { records: _records, before: _before, after: _after, ...result } = calculated; return result; }, apply };
}
