import { z } from 'zod';
import type { VerifiedUser } from '../../auth/verifyPocketBaseToken.js';
import { RepositoryError } from '../../repositories/base.js';
import type { ChangeSetRepository } from '../../repositories/changeSetRepository.js';
import type { TaskRecord, TaskRepository } from '../../repositories/taskRepository.js';
import type { JobRepository } from '../jobs/jobRepository.js';
import { buildDailyPlan } from '../scheduler/buildDailyPlan.js';
import type { SchedulerBusySlot, SchedulerProfile, SchedulerTask } from '../scheduler/types.js';

export class RescheduleNotFoundError extends Error { readonly code = 'NOT_FOUND'; }
export class RescheduleValidationError extends Error { readonly code = 'INVALID_RESCHEDULE'; }
export class RescheduleConflictError extends Error { readonly code = 'CONFLICT'; }

const iso = z.string().datetime({ offset: true });
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const profileSchema = z.object({
  timezone: z.string().min(1).max(80).default('Europe/Warsaw'),
  workHours: z.object({ start: clock, end: clock }).default({ start: '09:00', end: '18:00' }),
  energyPeak: z.object({ start: clock, end: clock }).default({ start: '09:30', end: '12:30' }),
  focusBlockMinutes: z.number().int().min(5).max(480).default(50),
  breakMinutes: z.number().int().min(0).max(120).default(10),
  dailyLimitMinutes: z.number().int().min(0).max(1440).default(360),
}).default({});
const busySlotSchema = z.object({ id: z.string().min(1).max(160), title: z.string().min(1).max(500), start: iso, end: iso, locked: z.literal(true).optional() }).strict();
export const rescheduleBodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  timezone: z.string().min(1).max(80).optional(),
  now: iso.optional(),
  profile: profileSchema,
  busySlots: z.array(busySlotSchema).max(100).default([]),
  idempotencyKey: z.string().trim().min(8).max(255).optional(),
}).strict();
export type RescheduleInput = z.infer<typeof rescheduleBodySchema>;

type TaskSnapshot = { id: string; title?: string; status?: string; plannedStart?: string | null; plannedEnd?: string | null; version?: string | number; rescheduleCount?: number; syncStatus?: string; calendarEventId?: string | null };
export type RescheduleChange = { taskId: string; title: string; changed: boolean; before: TaskSnapshot; after: TaskSnapshot; reason: string };
export type ReschedulePreview = { changes: RescheduleChange[]; unscheduledTaskIds: string[]; warnings: string[]; reasons: Record<string, string[]> };
export type RescheduleResult = ReschedulePreview & { changeSet: { id: string; status: string; kind: string }; undoId: string };
const snapshotSchema = z.object({ id: z.string(), title: z.string().optional(), status: z.string().optional(), plannedStart: iso.nullable().optional(), plannedEnd: iso.nullable().optional(), version: z.union([z.string(), z.number()]).optional(), rescheduleCount: z.number().int().min(0).optional(), syncStatus: z.string().optional(), calendarEventId: z.string().optional() }).strict();
const changeSchema = z.object({ taskId: z.string(), title: z.string(), changed: z.boolean(), before: snapshotSchema, after: snapshotSchema, reason: z.string() }).strict();
export const reschedulePreviewSchema = z.object({ changes: z.array(changeSchema), unscheduledTaskIds: z.array(z.string()), warnings: z.array(z.string()), reasons: z.record(z.string(), z.array(z.string())) }).strict();
export const rescheduleResponseSchema = reschedulePreviewSchema.extend({ changeSet: z.object({ id: z.string(), status: z.string(), kind: z.string() }).strict(), undoId: z.string() }).strict();

const userOwns = (task: TaskRecord, user: VerifiedUser) => task.user === user.userId;
const dateInZone = (value: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  const p = Object.fromEntries(parts.filter((item) => item.type !== 'literal').map((item) => [item.type, item.value]));
  return `${p.year}-${p.month}-${p.day}`;
};
const snapshot = (task: TaskRecord): TaskSnapshot => ({ id: task.id, title: typeof task.title === 'string' ? task.title : undefined, status: typeof task.status === 'string' ? task.status : undefined, plannedStart: typeof task.plannedStart === 'string' ? task.plannedStart : null, plannedEnd: typeof task.plannedEnd === 'string' ? task.plannedEnd : null, version: typeof task.version === 'string' || typeof task.version === 'number' ? task.version : undefined, rescheduleCount: Number(task.rescheduleCount ?? 0), ...(typeof task.syncStatus === 'string' ? { syncStatus: task.syncStatus } : {}), ...(typeof task.calendarEventId === 'string' ? { calendarEventId: task.calendarEventId } : {}) });
const publicChangeSet = (record: { id: string; status?: string; kind?: string }) => ({ id: record.id, status: String(record.status ?? ''), kind: String(record.kind ?? 'reschedule') });

function normalizeInput(input: unknown): RescheduleInput {
  const parsed = rescheduleBodySchema.safeParse(input ?? {});
  if (!parsed.success) throw new RescheduleValidationError();
  return parsed.data;
}

export interface RescheduleService {
  preview(user: VerifiedUser, input: unknown): Promise<ReschedulePreview>;
  apply(user: VerifiedUser, input: unknown): Promise<RescheduleResult>;
}

export function createRescheduleService(deps: {
  taskRepository: TaskRepository;
  changeSetRepository: ChangeSetRepository;
  jobRepository?: Pick<JobRepository, 'getByIdempotencyKey' | 'create'>;
}): RescheduleService {
  const { taskRepository, changeSetRepository, jobRepository } = deps;
  const locks = new Map<string, Promise<void>>();

  async function calculate(user: VerifiedUser, input: RescheduleInput): Promise<ReschedulePreview & { taskRecords: TaskRecord[] }> {
    const now = input.now ? new Date(input.now) : new Date();
    const timezone = input.timezone ?? input.profile.timezone;
    const targetDate = input.date ?? dateInZone(now, timezone);
    const all = (await taskRepository.list(user)).filter((task) => userOwns(task, user));
    const changes: RescheduleChange[] = [];
    const reasons: Record<string, string[]> = {};
    const immutable: TaskRecord[] = [];
    const candidates: TaskRecord[] = [];
    const isGoogle = (task: TaskRecord) => task.source === 'google' || task.calendarSource === 'google' || (task.calendarEventId && task.syncStatus !== 'synced');
    for (const task of all) {
      const before = snapshot(task);
      const startMs = task.plannedStart ? Date.parse(String(task.plannedStart)) : NaN;
      const endMs = task.plannedEnd ? Date.parse(String(task.plannedEnd)) : NaN;
      const started = Number.isFinite(endMs) && endMs <= now.getTime();
      const active = Number.isFinite(startMs) && Number.isFinite(endMs) && startMs < now.getTime() && endMs > now.getTime();
      const onDate = task.plannedStart ? dateInZone(new Date(String(task.plannedStart)), timezone) === targetDate : false;
      const lockedReason = task.status === 'completed' ? 'Завершена задача залишається без змін' : active ? 'Активний блок залишається без змін' : started ? 'Минулий блок залишається без змін' : task.locked ? 'Заблокована задача залишається без змін' : isGoogle(task) ? 'Подія Google Calendar залишається без змін' : !task.flexible ? 'Негнучка задача залишається без змін' : '';
      if (lockedReason || !onDate || !task.plannedStart || !task.plannedEnd) {
        if (lockedReason) reasons[task.id] = [lockedReason];
        changes.push({ taskId: task.id, title: String(task.title ?? 'Задача'), changed: false, before, after: before, reason: lockedReason || 'Задача не належить до поточного дня' });
        if (lockedReason && task.plannedStart && task.plannedEnd && Date.parse(String(task.plannedStart)) >= now.getTime()) immutable.push(task);
        continue;
      }
      candidates.push(task);
    }
    const profile: SchedulerProfile = {
      timezone,
      workHours: input.profile.workHours,
      energyPeak: input.profile.energyPeak,
      focusBlockMinutes: input.profile.focusBlockMinutes,
      breakMinutes: input.profile.breakMinutes,
      dailyLimitMinutes: input.profile.dailyLimitMinutes,
    };
    const busySlots: SchedulerBusySlot[] = [...input.busySlots.map((slot) => ({ ...slot, locked: true as const })), ...immutable.map((task) => ({ id: task.id, title: String(task.title ?? 'Зайнято'), start: String(task.plannedStart), end: String(task.plannedEnd), locked: true as const }))];
    const schedulerTasks: SchedulerTask[] = candidates.map((task) => ({ id: task.id, title: String(task.title ?? 'Задача'), estimatedMinutes: Number(task.estimatedMinutes ?? 0), priority: (task.priority ?? 'medium') as SchedulerTask['priority'], energy: (task.energy ?? 'medium') as SchedulerTask['energy'], goalAlignment: Number(task.goalAlignment ?? .5), deadline: task.deadline ? String(task.deadline) : null, flexible: true }));
    let plan;
    try { plan = buildDailyPlan({ tasks: schedulerTasks, busySlots, profile, now }); } catch { throw new RescheduleValidationError(); }
    const slots = new Map<string, { start: string; end: string }>();
    for (const block of plan.blocks) if (block.kind === 'task' && block.taskId && !slots.has(block.taskId)) slots.set(block.taskId, { start: block.start, end: block.end });
    const unscheduled = new Set(plan.unscheduledTaskIds);
    for (const task of candidates) {
      const before = snapshot(task); const slot = slots.get(task.id); const changed = !slot || slot.start !== task.plannedStart || slot.end !== task.plannedEnd;
      const after: TaskSnapshot = { ...before, plannedStart: slot?.start ?? null, plannedEnd: slot?.end ?? null, status: slot ? 'scheduled' : 'needs_reschedule', syncStatus: slot ? (typeof task.syncStatus === 'string' ? task.syncStatus : 'unscheduled') : 'unscheduled', rescheduleCount: Number(task.rescheduleCount ?? 0) + (changed ? 1 : 0) };
      const reason = changed ? (slot ? 'Знайдено новий вільний слот' : 'Не знайшлося реалістичного слоту') : 'Час уже відповідає плану';
      if (changed) reasons[task.id] = [reason];
      changes.push({ taskId: task.id, title: String(task.title ?? 'Задача'), changed, before, after, reason });
    }
    const warnings = [...plan.warnings.map((warning) => warning.message)];
    if (unscheduled.size) warnings.push(`${unscheduled.size} задач потребують нового місця в плані.`);
    return { changes, unscheduledTaskIds: [...unscheduled], warnings, reasons, taskRecords: all };
  }

  const applyInner = async (user: VerifiedUser, rawInput: unknown): Promise<RescheduleResult> => {
      const input = normalizeInput(rawInput);
      const idempotencyKey = input.idempotencyKey ?? `reschedule:${user.userId}:${input.date ?? 'today'}:${input.now ?? ''}`;
      const existing = (await changeSetRepository.list(user)).find((record) => record.idempotencyKey === idempotencyKey);
      if (existing?.status === 'applied') {
        const payload = existing.afterJson && typeof existing.afterJson === 'object' ? existing.afterJson as { changes?: RescheduleChange[]; unscheduledTaskIds?: string[]; warnings?: string[]; reasons?: Record<string, string[]> } : {};
        return rescheduleResponseSchema.parse({ changes: payload.changes ?? [], unscheduledTaskIds: payload.unscheduledTaskIds ?? [], warnings: payload.warnings ?? [], reasons: payload.reasons ?? {}, changeSet: publicChangeSet(existing), undoId: existing.id });
      }
      if (existing?.status === 'pending') throw new RescheduleConflictError();
      const calculated = await calculate(user, input);
      const changed = calculated.changes.filter((change) => change.changed);
      let reservation = existing;
      if (!reservation) {
        try { reservation = await changeSetRepository.create(user, { kind: 'reschedule', status: 'pending', idempotencyKey, beforeJson: { tasks: changed.map((change) => ({ ...change.before })) }, afterJson: { changes: calculated.changes, unscheduledTaskIds: calculated.unscheduledTaskIds, warnings: calculated.warnings, reasons: calculated.reasons } }); }
        catch { reservation = (await changeSetRepository.list(user)).find((record) => record.idempotencyKey === idempotencyKey); if (!reservation) throw new RepositoryError('UNAVAILABLE'); }
      }
      if (!reservation) throw new RepositoryError('UNAVAILABLE');
      const updated: RescheduleChange[] = [];
      try {
        for (const change of changed) {
          const task = calculated.taskRecords.find((item) => item.id === change.taskId);
          if (!task) throw new RescheduleNotFoundError();
          const patch = { plannedStart: change.after.plannedStart, plannedEnd: change.after.plannedEnd, status: change.after.status, syncStatus: change.after.syncStatus, rescheduleCount: change.after.rescheduleCount, version: (Number(task.version) || 0) + 1 };
          const value = taskRepository.updateIfVersion ? await taskRepository.updateIfVersion(user, task.id, Number(task.version ?? 0), patch) : await taskRepository.update(user, task.id, patch);
          updated.push({ ...change, after: snapshot(value) });
          if (jobRepository && task.calendarEventId && task.syncStatus === 'synced') {
            const key = `calendar:reschedule:${reservation.id}:${task.id}`;
            if (!await jobRepository.getByIdempotencyKey(user, key)) await jobRepository.create(user, { type: 'calendar.update', idempotencyKey: key, payloadJson: { taskId: task.id, changeSetId: reservation.id }, status: 'pending', attempts: 0, nextRunAt: new Date().toISOString() });
          }
        }
        const applied = await changeSetRepository.update(user, reservation.id, { status: 'applied', afterJson: { changes: calculated.changes.map((item) => updated.find((value) => value.taskId === item.taskId) ?? item), unscheduledTaskIds: calculated.unscheduledTaskIds, warnings: calculated.warnings, reasons: calculated.reasons } });
        const { taskRecords: _taskRecords, ...publicCalculated } = calculated;
        return rescheduleResponseSchema.parse({ ...publicCalculated, changes: calculated.changes.map((item) => updated.find((value) => value.taskId === item.taskId) ?? item), changeSet: publicChangeSet(applied), undoId: applied.id });
      } catch (error) {
        try { await changeSetRepository.update(user, reservation.id, { status: 'failed' }); } catch { /* keep reservation for diagnosis */ }
        if (error instanceof RescheduleNotFoundError) throw error;
        if (error instanceof RepositoryError && error.code === 'INVALID') throw new RescheduleConflictError();
        throw error;
      }
  };
  const apply = async (user: VerifiedUser, rawInput: unknown): Promise<RescheduleResult> => {
    const input = normalizeInput(rawInput);
    const key = input.idempotencyKey ?? `reschedule:${user.userId}:${input.date ?? 'today'}:${input.now ?? ''}`;
    const previous = locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    const queued = previous.then(() => current);
    locks.set(key, queued);
    await previous;
    try { return await applyInner(user, input); }
    finally { release(); if (locks.get(key) === queued) locks.delete(key); }
  };
  return {
    async preview(user, rawInput) {
      const input = normalizeInput(rawInput);
      const { taskRecords: _taskRecords, ...result } = await calculate(user, input);
      return reschedulePreviewSchema.parse(result);
    },
    apply,
  };
}
