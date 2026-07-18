import type { VerifiedUser } from '../../auth/verifyPocketBaseToken.js';
import { RepositoryError } from '../../repositories/base.js';
import type { BrainDumpRepository } from '../../repositories/brainDumpRepository.js';
import type { TaskRepository, TaskRecord } from '../../repositories/taskRepository.js';
import type { IdeaRepository } from '../../repositories/ideaRepository.js';
import type { ChangeSetRepository, ChangeSetRecord } from '../../repositories/changeSetRepository.js';
import type { AnalysisService } from '../ai/analyzeBrainDump.js';
import { buildDailyPlan } from '../scheduler/buildDailyPlan.js';
import type { SchedulerBusySlot, SchedulerTask, SchedulerProfile } from '../scheduler/types.js';
import { planPreviewBodySchema, type PlanPreviewBody, type PlanPreview } from './planSchemas.js';

export class PlanNotFoundError extends Error { readonly code = 'NOT_FOUND'; }
export class PlanValidationError extends Error { readonly code = 'INVALID_PLAN'; }
export class PlanConflictError extends Error { readonly code = 'CONFLICT'; }

export interface PlanService {
  preview(user: VerifiedUser, dumpId: string, input: unknown, requestId?: string): Promise<PlanPreview>;
  apply(user: VerifiedUser, changeSetId: string, input: unknown): Promise<{ changeSet: ChangeSetRecord; tasks: TaskRecord[]; ideas: Awaited<ReturnType<IdeaRepository['list']>> }>;
  today(user: VerifiedUser, date: string, timezone: string): Promise<{ date: string; timezone: string; tasks: TaskRecord[]; blocks: TaskRecord[]; warnings: unknown[] }>;
  inbox(user: VerifiedUser): Promise<{ ideas: Awaited<ReturnType<IdeaRepository['list']>>; tasks: TaskRecord[] }>;
  task(user: VerifiedUser, id: string): Promise<TaskRecord>;
}

const asDate = (value: string | undefined) => value ? new Date(value) : new Date();
const priorityAlignment: Record<string, number> = { urgent: 1, high: .9, medium: .6, low: .3 };

export function createPlanService(deps: {
  dumpRepository: BrainDumpRepository;
  analysisService: AnalysisService;
  taskRepository: TaskRepository;
  ideaRepository: IdeaRepository;
  changeSetRepository: ChangeSetRepository;
}): PlanService {
  const { dumpRepository, analysisService, taskRepository, ideaRepository, changeSetRepository } = deps;

  async function preview(user: VerifiedUser, dumpId: string, input: unknown, requestId?: string): Promise<PlanPreview> {
    const dump = await dumpRepository.get(user, dumpId);
    if (!dump || dump.user !== user.userId) throw new PlanNotFoundError();
    const parsed = planPreviewBodySchema.safeParse(input ?? {});
    if (!parsed.success) throw new PlanValidationError();
    const body: PlanPreviewBody = parsed.data;
    const result = await analysisService.result(user, dumpId);
    if (!result || result.status !== 'classified' || result.analysis.questions.length > 0) throw new PlanValidationError();
    const analysis = result.analysis;
    const profile: SchedulerProfile = { ...body.profile, timezone: body.timezone ?? body.profile.timezone };
    const tasks: SchedulerTask[] = analysis.tasks.map((task, index) => ({ id: `proposal-${result.id}-t-${index + 1}`, title: task.title, estimatedMinutes: task.estimatedMinutes, priority: task.priority, energy: task.energy, goalAlignment: priorityAlignment[task.priority] ?? .5, deadline: task.deadline, }));
    const busySlots: SchedulerBusySlot[] = body.busySlots.map((slot) => ({ ...slot, locked: true }));
    let plan;
    try { plan = buildDailyPlan({ tasks, busySlots, profile, now: asDate(body.now) }); } catch { throw new PlanValidationError(); }
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const scheduled = new Map<string, { start: string; end: string }>();
    for (const block of plan.blocks) if (block.taskId && !scheduled.has(block.taskId)) scheduled.set(block.taskId, { start: block.start, end: block.end });
    const proposedTasks = analysis.tasks.map((task, index) => {
      const id = tasks[index].id; const slot = scheduled.get(id);
      return { id, title: task.title, description: task.description, status: 'scheduled' as const, priority: task.priority, deadline: task.deadline, plannedStart: slot?.start ?? null, plannedEnd: slot?.end ?? null, estimatedMinutes: task.estimatedMinutes, energy: task.energy, flexible: true, locked: false, sourceDump: dumpId };
    });
    const ideas = analysis.ideas.map((idea, index) => ({ id: `proposal-${result.id}-i-${index + 1}`, text: idea.text, summary: idea.summary, status: 'backlog' as const, sourceDump: dumpId }));
    const idempotencyKey = body.idempotencyKey ?? requestId ?? `plan:${user.userId}:${dumpId}:${result.id}`;
    const existing = (await changeSetRepository.list(user)).find((record) => record.idempotencyKey === idempotencyKey);
    if (existing?.status === 'applied') return { changeSetId: existing.id, tasks: proposedTasks, ideas, blocks: plan.blocks, unscheduledTaskIds: plan.unscheduledTaskIds, warnings: plan.warnings, reasons: plan.reasons };
    const changeSet = existing ?? await changeSetRepository.create(user, { kind: 'ai_classification', status: 'pending', beforeJson: { tasks: [], ideas: [] }, afterJson: { tasks: proposedTasks, ideas }, idempotencyKey });
    return { changeSetId: changeSet.id, tasks: proposedTasks, ideas, blocks: plan.blocks, unscheduledTaskIds: plan.unscheduledTaskIds, warnings: plan.warnings, reasons: plan.reasons };
  }

  async function apply(user: VerifiedUser, changeSetId: string, input: unknown) {
    const changeSet = await changeSetRepository.get(user, changeSetId);
    if (!changeSet || changeSet.user !== user.userId) throw new PlanNotFoundError();
    if (changeSet.status === 'applied') return { changeSet, tasks: (await taskRepository.list(user)).filter((task) => task.sourceDump && JSON.stringify(changeSet.afterJson ?? '').includes(String(task.sourceDump))), ideas: await ideaRepository.list(user) };
    const payload = (changeSet.afterJson && typeof changeSet.afterJson === 'object') ? changeSet.afterJson as { tasks?: unknown[]; ideas?: unknown[] } : {};
    const proposedTasks = Array.isArray(payload.tasks) ? payload.tasks : [];
    const proposedIdeas = Array.isArray(payload.ideas) ? payload.ideas : [];
    const createdTasks: TaskRecord[] = []; const createdIdeas: Awaited<ReturnType<IdeaRepository['list']>> = [];
    try {
      for (const proposed of proposedTasks) { const value = proposed as Record<string, unknown>; const { id: _id, ...input } = value; const existing = (await taskRepository.list(user)).find((task) => task.id === value.id || (task.sourceDump === value.sourceDump && task.title === value.title)); createdTasks.push(existing ?? await taskRepository.create(user, input as never)); }
      for (const proposed of proposedIdeas) { const value = proposed as Record<string, unknown>; const { id: _id, ...input } = value; const existing = (await ideaRepository.list(user)).find((idea) => idea.id === value.id || (idea.sourceDump === value.sourceDump && idea.text === value.text)); createdIdeas.push(existing ?? await ideaRepository.create(user, input as never)); }
      const updated = await changeSetRepository.update(user, changeSetId, { status: 'applied' });
      return { changeSet: updated, tasks: createdTasks, ideas: createdIdeas };
    } catch (error) {
      for (const task of createdTasks) { try { if (task.id) await taskRepository.delete(user, task.id); } catch { /* best-effort rollback */ } }
      for (const idea of createdIdeas) { try { if (idea.id) await ideaRepository.delete(user, idea.id); } catch { /* best-effort rollback */ } }
      try { await changeSetRepository.update(user, changeSetId, { status: 'failed' }); } catch { /* retain retryable pending state */ }
      if (error instanceof RepositoryError) throw error;
      throw new PlanConflictError();
    }
  }

  async function today(user: VerifiedUser, date: string, timezone: string) {
    const tasks = (await taskRepository.list(user)).filter((task) => String(task.plannedStart ?? '').startsWith(date) && task.status === 'scheduled');
    tasks.sort((a, b) => String(a.plannedStart).localeCompare(String(b.plannedStart)));
    for (let i = 1; i < tasks.length; i++) if (Date.parse(String(tasks[i - 1].plannedEnd)) > Date.parse(String(tasks[i].plannedStart))) throw new PlanConflictError();
    return { date, timezone, tasks, blocks: tasks, warnings: [] };
  }
  return {
    preview,
    apply,
    today,
    async inbox(user) { return { ideas: (await ideaRepository.list(user)).filter((idea) => idea.status === 'backlog'), tasks: (await taskRepository.list(user)).filter((task) => task.status === 'inbox') }; },
    async task(user, id) { const record = await taskRepository.get(user, id); if (!record || record.user !== user.userId) throw new PlanNotFoundError(); return record; },
  };
}
