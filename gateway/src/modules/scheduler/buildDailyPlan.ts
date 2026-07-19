import { compareTasks } from './scoreTask.js';
import { explainTask } from './explainPlan.js';
import { splitTask } from './splitTask.js';
import type { DailyPlan, DailyPlanInput, PlannedBlock, ScheduleReason, SchedulerBusySlot, SchedulerProfile, SchedulerTask } from './types.js';
import { SchedulerValidationError } from './types.js';

const minute = 60_000;
function validClock(value: string): boolean { return /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
function parseInterval(start: string, end: string, label: string): [number, number] {
  const a = Date.parse(start), b = Date.parse(end);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) throw new SchedulerValidationError(`Invalid interval: ${label}`);
  return [a, b];
}
function partsAt(date: Date, timezone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  return Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));
}
function atLocalDay(date: Date, clock: string, timezone: string): number {
  const p = partsAt(date, timezone); const [hour, minutePart] = clock.split(':').map(Number);
  const guessed = Date.UTC(p.year, p.month - 1, p.day, hour, minutePart);
  const probe = new Date(guessed);
  const q = partsAt(probe, timezone);
  const asUtc = Date.UTC(q.year, q.month - 1, q.day, q.hour, q.minute);
  return guessed + (guessed - asUtc);
}
function isoWithOffset(timestamp: number, timezone: string): string {
  const d = new Date(timestamp); const p = partsAt(d, timezone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  const offset = Math.round((asUtc - timestamp) / minute); const sign = offset >= 0 ? '+' : '-'; const abs = Math.abs(offset);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${two(p.month)}-${two(p.day)}T${two(p.hour)}:${two(p.minute)}:00${sign}${two(Math.floor(abs / 60))}:${two(abs % 60)}`;
}
function energyFits(task: SchedulerTask, start: number, profile: SchedulerProfile): boolean {
  const peakStart = atLocalDay(new Date(start), profile.energyPeak.start, profile.timezone); const peakEnd = atLocalDay(new Date(start), profile.energyPeak.end, profile.timezone);
  const inPeak = start >= peakStart && start < peakEnd;
  return task.energy === 'high' ? inPeak : task.energy !== 'low' || !inPeak;
}
function overlaps(start: number, end: number, occupied: Array<[number, number]>): boolean { return occupied.some(([a, b]) => start < b && end > a); }

export function buildDailyPlan(input: DailyPlanInput): DailyPlan {
  const { tasks, busySlots, profile, now, mode = 'balanced', goalId } = input;
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new SchedulerValidationError('now is required and must be a valid Date');
  if (!validClock(profile.workHours.start) || !validClock(profile.workHours.end) || profile.workHours.start >= profile.workHours.end) throw new SchedulerValidationError('Invalid workHours profile');
  if (!validClock(profile.energyPeak.start) || !validClock(profile.energyPeak.end) || profile.energyPeak.start >= profile.energyPeak.end) throw new SchedulerValidationError('Invalid energyPeak profile');
  for (const value of [profile.focusBlockMinutes, profile.breakMinutes, profile.dailyLimitMinutes]) if (!Number.isInteger(value) || value < 0) throw new SchedulerValidationError('Invalid profile values');
  try { new Intl.DateTimeFormat('en-GB', { timeZone: profile.timezone }).format(now); } catch { throw new SchedulerValidationError('Invalid timezone'); }
  const workStart = atLocalDay(now, profile.workHours.start, profile.timezone); const workEnd = atLocalDay(now, profile.workHours.end, profile.timezone);
  const planningStart = Math.max(workStart, Math.ceil(now.getTime() / (15 * minute)) * 15 * minute);
  const blocks: PlannedBlock[] = []; const occupied: Array<[number, number]> = []; const reasons: Record<string, ScheduleReason[]> = {}; const unscheduledTaskIds: string[] = []; const warnings: DailyPlan['warnings'] = [];
  for (const slot of busySlots) { const [start, end] = parseInterval(slot.start, slot.end, slot.id); if (overlaps(start, end, occupied)) throw new SchedulerValidationError(`Overlapping busy interval: ${slot.id}`); blocks.push({ id: slot.id, kind: 'busy', title: slot.title, start: slot.start, end: slot.end, locked: true }); occupied.push([start, end]); reasons[slot.id] = [{ code: 'busy-conflict', message: 'Зайнятий слот збережено без змін' }]; }
  for (const task of tasks) {
    const startTime = task.start ? Date.parse(task.start) : NaN;
    const endTime = task.end ? Date.parse(task.end) : NaN;
    const past = Number.isFinite(endTime) && endTime <= now.getTime();
    const active = Number.isFinite(startTime) && Number.isFinite(endTime) && startTime < now.getTime() && endTime > now.getTime();
    const immutable = task.locked || task.flexible === false || task.status === 'completed' || task.calendarSource === 'google' || (task.calendarEventId && task.calendarSource !== 'app') || past || active;
    if (!immutable) continue;
    // Completed items may have no remaining interval; preserve them without putting them back into Today.
    if (!task.start || !task.end) { reasons[task.id] = [{ code: 'busy-conflict', message: task.status === 'completed' ? 'Завершена задача збережена без змін' : 'Блок збережено без змін' }]; continue; }
    const [start, end] = parseInterval(task.start, task.end, task.id); if (overlaps(start, end, occupied)) throw new SchedulerValidationError(`Immutable task overlaps another interval: ${task.id}`); blocks.push({ id: task.id, kind: 'task', taskId: task.id, title: task.title, start: task.start, end: task.end, locked: true }); occupied.push([start, end]); reasons[task.id] = [{ code: 'busy-conflict', message: task.status === 'completed' ? 'Завершена задача збережена без змін' : active ? 'Активний блок збережено без змін' : past ? 'Минулий блок збережено без змін' : 'Заблокована задача збережена без змін' }];
  }
  const flexible = tasks.filter((task) => !(task.locked || task.flexible === false || task.status === 'completed' || task.calendarSource === 'google' || (task.calendarEventId && task.calendarSource !== 'app') || Boolean(task.end && Date.parse(task.end) <= now.getTime()) || Boolean(task.start && task.end && Date.parse(task.start) < now.getTime() && Date.parse(task.end) > now.getTime()))).slice().sort((a, b) => compareTasks(a, b, now, mode, goalId)); let usedMinutes = 0;
  for (const task of flexible) {
    if (!Number.isInteger(task.estimatedMinutes) || task.estimatedMinutes <= 0 || !Number.isFinite(task.goalAlignment) || task.goalAlignment < 0 || task.goalAlignment > 1) throw new SchedulerValidationError(`Invalid task: ${task.id}`);
    if (task.deadline !== null && (!Number.isFinite(Date.parse(task.deadline)))) throw new SchedulerValidationError(`Invalid deadline for task ${task.id}`);
    if (usedMinutes + task.estimatedMinutes > profile.dailyLimitMinutes) { unscheduledTaskIds.push(task.id); reasons[task.id] = [{ code: 'daily-cap', message: 'Денний ліміт навантаження вже вичерпано' }]; warnings.push({ code: 'daily-cap', message: `Задача «${task.title}» залишена поза планом через денний ліміт`, taskId: task.id }); continue; }
    const chunks = splitTask(task, profile.focusBlockMinutes); let failed = false; const taskReasons = explainTask(task, chunks.length > 1, task.energy === 'high');
    const pendingBlocks: PlannedBlock[] = []; const pendingIntervals: Array<[number, number]> = [];
    for (const chunk of chunks) {
      const duration = chunk.estimatedMinutes * minute; let chosen: number | undefined;
      for (let start = planningStart; start + duration <= workEnd; start += 15 * minute) {
        const end = start + duration; if (overlaps(start, end, occupied) || overlaps(start, end, pendingIntervals)) continue; if (task.deadline && end > Date.parse(task.deadline)) continue;
        if (chosen === undefined || (energyFits(task, start, profile) ? 0 : 1) < (energyFits(task, chosen, profile) ? 0 : 1)) chosen = start;
      }
      if (chosen === undefined) { failed = true; break; }
      const end = chosen + duration; pendingBlocks.push({ id: chunk.id, kind: 'task', taskId: task.id, title: chunk.title, start: isoWithOffset(chosen, profile.timezone), end: isoWithOffset(end, profile.timezone), locked: false }); pendingIntervals.push([chosen, end]);
      if (chunk !== chunks[chunks.length - 1] && profile.breakMinutes > 0) { const breakEnd = end + profile.breakMinutes * minute; if (breakEnd > workEnd || overlaps(end, breakEnd, occupied) || overlaps(end, breakEnd, pendingIntervals)) { failed = true; break; } pendingBlocks.push({ id: `${chunk.id}::break`, kind: 'break', title: 'Перерва', start: isoWithOffset(end, profile.timezone), end: isoWithOffset(breakEnd, profile.timezone), locked: false }); pendingIntervals.push([end, breakEnd]); }
    }
    if (failed) { unscheduledTaskIds.push(task.id); const code = task.deadline ? 'deadline' : 'no-viable-slot'; const unscheduledReasons: ScheduleReason[] = [{ code, message: task.deadline ? 'До дедлайну не знайшлося реалістичного слоту' : 'Не знайшлося вільного слоту' }]; if (busySlots.length > 0) unscheduledReasons.push({ code: 'busy-conflict', message: 'Зайняті слоти обмежили доступний час' }); reasons[task.id] = unscheduledReasons; warnings.push({ code: task.deadline ? 'deadline-conflict' : 'no-viable-slot', message: `Задача «${task.title}» потребує нового місця в плані`, taskId: task.id }); }
    else { blocks.push(...pendingBlocks); occupied.push(...pendingIntervals); usedMinutes += task.estimatedMinutes; if (busySlots.length > 0) taskReasons.push({ code: 'busy-conflict', message: 'Вільний час підібрано навколо зайнятих слотів' }); reasons[task.id] = taskReasons; }
  }
  blocks.sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || a.id.localeCompare(b.id));
  return { blocks, unscheduledTaskIds, warnings, reasons };
}
