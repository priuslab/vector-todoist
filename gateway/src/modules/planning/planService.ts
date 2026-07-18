import type { VerifiedUser } from '../../auth/verifyPocketBaseToken.js';
import { RepositoryError } from '../../repositories/base.js';
import type { BrainDumpRepository } from '../../repositories/brainDumpRepository.js';
import type { TaskRepository, TaskRecord } from '../../repositories/taskRepository.js';
import type { IdeaRepository } from '../../repositories/ideaRepository.js';
import type { ChangeSetRepository, ChangeSetRecord } from '../../repositories/changeSetRepository.js';
import type { AnalysisService } from '../ai/analyzeBrainDump.js';
import { buildDailyPlan } from '../scheduler/buildDailyPlan.js';
import type { SchedulerBusySlot, SchedulerTask, SchedulerProfile } from '../scheduler/types.js';
import { applyBodySchema, applyResponseSchema, inboxResponseSchema, ideaResponseShape, planPreviewBodySchema, planPreviewSchema, taskResponseSchema, todayResponseSchema, type ChangeSetResponse, type PlanPreviewBody, type PlanPreview, type TaskResponse, type IdeaResponse } from './planSchemas.js';

export class PlanNotFoundError extends Error { readonly code = 'NOT_FOUND'; }
export class PlanValidationError extends Error { readonly code = 'INVALID_PLAN'; }
export class PlanConflictError extends Error { readonly code = 'CONFLICT'; }

export interface PlanService {
  preview(user: VerifiedUser, dumpId: string, input: unknown): Promise<PlanPreview>;
  apply(user: VerifiedUser, changeSetId: string, input: unknown): Promise<{ changeSet: ChangeSetResponse; tasks: TaskResponse[]; ideas: IdeaResponse[] }>;
  today(user: VerifiedUser, date: string, timezone: string): Promise<{ date: string; timezone: string; tasks: TaskResponse[]; blocks: TaskResponse[]; warnings: unknown[] }>;
  inbox(user: VerifiedUser): Promise<{ ideas: IdeaResponse[]; tasks: TaskResponse[] }>;
  task(user: VerifiedUser, id: string): Promise<TaskResponse>;
}

const asDate = (value: string | undefined) => value ? new Date(value) : new Date();
const priorityAlignment: Record<string, number> = { urgent: 1, high: .9, medium: .6, low: .3 };
const publicTask = (task: TaskRecord): TaskResponse => taskResponseSchema.parse(Object.fromEntries(Object.entries(task).filter(([key]) => key !== 'user')));
const publicIdea = <T extends Record<string, unknown>>(idea: T): IdeaResponse => ideaResponseShape.parse(Object.fromEntries(Object.entries(idea).filter(([key]) => key !== 'user')));

export function createPlanService(deps: {
  dumpRepository: BrainDumpRepository;
  analysisService: AnalysisService;
  taskRepository: TaskRepository;
  ideaRepository: IdeaRepository;
  changeSetRepository: ChangeSetRepository;
}): PlanService {
  const { dumpRepository, analysisService, taskRepository, ideaRepository, changeSetRepository } = deps;

  async function preview(user: VerifiedUser, dumpId: string, input: unknown): Promise<PlanPreview> {
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
    const scheduled = new Map<string, { start: string; end: string }>();
    for (const block of plan.blocks) if (block.taskId && !scheduled.has(block.taskId)) scheduled.set(block.taskId, { start: block.start, end: block.end });
    const proposedTasks = analysis.tasks.map((task, index) => {
      const id = tasks[index].id; const slot = scheduled.get(id);
      return { id, title: task.title, description: task.description, status: 'scheduled' as const, priority: task.priority, deadline: task.deadline, plannedStart: slot?.start ?? null, plannedEnd: slot?.end ?? null, estimatedMinutes: task.estimatedMinutes, energy: task.energy, flexible: true, locked: false, sourceDump: dumpId };
    });
    const ideas = analysis.ideas.map((idea, index) => ({ id: `proposal-${result.id}-i-${index + 1}`, text: idea.text, summary: idea.summary, status: 'backlog' as const, sourceDump: dumpId }));
    const idempotencyKey = body.idempotencyKey ?? `plan:${user.userId}:${dumpId}:${result.id}`;
    const existing = (await changeSetRepository.list(user)).find((record) => record.idempotencyKey === idempotencyKey);
    if (existing?.status === 'applied') return { changeSetId: existing.id, tasks: proposedTasks, ideas, blocks: plan.blocks, unscheduledTaskIds: plan.unscheduledTaskIds, warnings: plan.warnings, reasons: plan.reasons };
    let changeSet = existing;
    if (!changeSet) {
      const currentTasks = (await taskRepository.list(user)).filter((task) => task.sourceDump === dumpId);
      const currentIdeas = (await ideaRepository.list(user)).filter((idea) => idea.sourceDump === dumpId);
      try { changeSet = await changeSetRepository.create(user, { kind: 'ai_classification', status: 'pending', beforeJson: { tasks: currentTasks, ideas: currentIdeas }, afterJson: { tasks: proposedTasks, ideas }, idempotencyKey }); }
      catch { changeSet = (await changeSetRepository.list(user)).find((record) => record.idempotencyKey === idempotencyKey); if (!changeSet) throw new RepositoryError('UNAVAILABLE'); }
    }
    return planPreviewSchema.parse({ changeSetId: changeSet.id, tasks: proposedTasks, ideas, blocks: plan.blocks, unscheduledTaskIds: plan.unscheduledTaskIds, warnings: plan.warnings, reasons: plan.reasons });
  }

  async function apply(user: VerifiedUser, changeSetId: string, input: unknown) {
    const changeSet = await changeSetRepository.get(user, changeSetId);
    if (!changeSet || changeSet.user !== user.userId) throw new PlanNotFoundError();
    const applyInput = applyBodySchema.safeParse(input ?? {});
    if (!applyInput.success || (applyInput.data.idempotencyKey && applyInput.data.idempotencyKey !== changeSet.idempotencyKey)) throw new PlanValidationError();
    if (changeSet.status === 'applied') {
      const payload = (changeSet.afterJson && typeof changeSet.afterJson === 'object') ? changeSet.afterJson as { tasks?: Array<Record<string, unknown>>; ideas?: Array<Record<string, unknown>> } : {};
      const appliedTaskIds = new Set((payload as { appliedTaskIds?: string[] }).appliedTaskIds ?? []); const appliedIdeaIds = new Set((payload as { appliedIdeaIds?: string[] }).appliedIdeaIds ?? []);
      return applyResponseSchema.parse({ changeSet, tasks: (await taskRepository.list(user)).filter((task) => appliedTaskIds.has(task.id)).map(publicTask), ideas: (await ideaRepository.list(user)).filter((idea) => appliedIdeaIds.has(idea.id)).map(publicIdea) });
    }
    const payload = (changeSet.afterJson && typeof changeSet.afterJson === 'object') ? changeSet.afterJson as { tasks?: unknown[]; ideas?: unknown[] } : {};
    const proposedTasks = Array.isArray(payload.tasks) ? payload.tasks : [];
    const proposedIdeas = Array.isArray(payload.ideas) ? payload.ideas : [];
    const createdTasks: TaskRecord[] = []; const createdIdeas: Awaited<ReturnType<IdeaRepository['list']>> = [];
    try {
      for (const proposed of proposedTasks) { const value = proposed as Record<string, unknown>; const { id: _id, ...input } = value; const existing = (await taskRepository.list(user)).find((task) => task.id === value.id || (task.sourceDump === value.sourceDump && task.title === value.title)); createdTasks.push(existing ?? await taskRepository.create(user, input as never)); }
      for (const proposed of proposedIdeas) { const value = proposed as Record<string, unknown>; const { id: _id, ...input } = value; const existing = (await ideaRepository.list(user)).find((idea) => idea.id === value.id || (idea.sourceDump === value.sourceDump && idea.text === value.text)); createdIdeas.push(existing ?? await ideaRepository.create(user, input as never)); }
      const updated = await changeSetRepository.update(user, changeSetId, { status: 'applied', afterJson: { ...payload, appliedTaskIds: createdTasks.map((task) => task.id), appliedIdeaIds: createdIdeas.map((idea) => idea.id) } });
      return applyResponseSchema.parse({ changeSet: updated, tasks: createdTasks.map(publicTask), ideas: createdIdeas.map(publicIdea) });
    } catch (error) {
      for (const task of createdTasks) { try { if (task.id) await taskRepository.delete(user, task.id); } catch { try { if (task.id) await taskRepository.update(user, task.id, { status: 'cancelled' }); } catch { /* explicit failed change set remains retryable */ } } }
      for (const idea of createdIdeas) { try { if (idea.id) await ideaRepository.delete(user, idea.id); } catch { try { if (idea.id) await ideaRepository.update(user, idea.id, { status: 'archived' }); } catch { /* explicit failed change set remains retryable */ } } }
      try { await changeSetRepository.update(user, changeSetId, { status: 'failed' }); } catch { /* retain retryable pending state */ }
      if (error instanceof RepositoryError) throw error;
      throw new PlanConflictError();
    }
  }

  async function today(user: VerifiedUser, date: string, timezone: string) {
    const tasks = (await taskRepository.list(user)).filter((task) => String(task.plannedStart ?? '').startsWith(date) && task.status === 'scheduled');
    tasks.sort((a, b) => String(a.plannedStart).localeCompare(String(b.plannedStart)));
    for (let i = 1; i < tasks.length; i++) if (Date.parse(String(tasks[i - 1].plannedEnd)) > Date.parse(String(tasks[i].plannedStart))) throw new PlanConflictError();
    return todayResponseSchema.parse({ date, timezone, tasks: tasks.map(publicTask), blocks: tasks.map(publicTask), warnings: [] });
  }
  return {
    preview,
    apply,
    today,
    async inbox(user) { return inboxResponseSchema.parse({ ideas: (await ideaRepository.list(user)).filter((idea) => idea.status === 'backlog').map(publicIdea), tasks: (await taskRepository.list(user)).filter((task) => task.status === 'inbox').map(publicTask) }); },
    async task(user, id) { const record = await taskRepository.get(user, id); if (!record || record.user !== user.userId) throw new PlanNotFoundError(); return publicTask(record); },
  };
}
