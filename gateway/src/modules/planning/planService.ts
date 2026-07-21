import type { VerifiedUser } from '../../auth/verifyPocketBaseToken.js';
import { RepositoryError } from '../../repositories/base.js';
import type { BrainDumpRepository } from '../../repositories/brainDumpRepository.js';
import type { TaskRepository, TaskRecord } from '../../repositories/taskRepository.js';
import type { IdeaRepository } from '../../repositories/ideaRepository.js';
import type { GoalGraphRepository, GraphEdgeRecord } from '../../repositories/goalGraphRepository.js';
import type { ChangeSetRepository, ChangeSetRecord } from '../../repositories/changeSetRepository.js';
import type { AnalysisService } from '../ai/analyzeBrainDump.js';
import { buildDailyPlan } from '../scheduler/buildDailyPlan.js';
import type { SchedulerBusySlot, SchedulerTask, SchedulerProfile } from '../scheduler/types.js';
import { applyBodySchema, applyResponseSchema, inboxResponseSchema, ideaResponseShape, planPreviewBodySchema, planPreviewSchema, taskResponseSchema, todayResponseSchema, type ChangeSetResponse, type PlanPreviewBody, type PlanPreview, type TaskResponse, type IdeaResponse, type DraftResponse } from './planSchemas.js';
import type { BusySlotService } from '../calendar/busySlotService.js';
import type { CalendarEventService } from '../calendar/calendarEventService.js';
import type { AdaptationService } from '../adaptation/adaptationService.js';

export class PlanNotFoundError extends Error { readonly code = 'NOT_FOUND'; }
export class PlanValidationError extends Error { readonly code = 'INVALID_PLAN'; }
export class PlanConflictError extends Error { readonly code = 'CONFLICT'; }

export interface PlanService {
  preview(user: VerifiedUser, dumpId: string, input: unknown): Promise<PlanPreview>;
  apply(user: VerifiedUser, changeSetId: string, input: unknown): Promise<{ changeSet: ChangeSetResponse; tasks: TaskResponse[]; ideas: IdeaResponse[] }>;
  today(user: VerifiedUser, date: string, timezone: string): Promise<{ date: string; timezone: string; tasks: TaskResponse[]; blocks: TaskResponse[]; warnings: unknown[] }>;
  inbox(user: VerifiedUser): Promise<{ ideas: IdeaResponse[]; tasks: TaskResponse[]; drafts: DraftResponse[] }>;
  task(user: VerifiedUser, id: string): Promise<TaskResponse>;
}

const asDate = (value: string | undefined) => value ? new Date(value) : new Date();
const priorityAlignment: Record<string, number> = { urgent: 1, high: .9, medium: .6, low: .3 };
const pick = (record: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.filter((key) => record[key] !== undefined).map((key) => [key, record[key]]));
const publicTask = (task: TaskRecord): TaskResponse => taskResponseSchema.parse(pick(task, ['id', 'title', 'description', 'status', 'priority', 'deadline', 'plannedStart', 'plannedEnd', 'estimatedMinutes', 'actualMinutes', 'energy', 'flexible', 'locked', 'sourceDump', 'goalId', 'rescheduleCount', 'syncStatus', 'calendarEventId']));
const publicIdea = <T extends Record<string, unknown>>(idea: T): IdeaResponse => ideaResponseShape.parse(pick(idea, ['id', 'text', 'summary', 'status', 'sourceDump', 'goalId']));
const publicDraft = (draft: Record<string, unknown>): DraftResponse => ({
  id: String(draft.id),
  text: String(draft.rawText ?? draft.transcript ?? ''),
  ...(typeof draft.status === 'string' ? { status: draft.status } : {}),
  ...(typeof draft.source === 'string' ? { source: draft.source } : {}),
  ...(typeof draft.kind === 'string' ? { kind: draft.kind } : {}),
  ...(typeof draft.created === 'string' ? { created: draft.created } : {}),
});
const publicChangeSet = (changeSet: ChangeSetRecord): ChangeSetResponse => ({ id: changeSet.id, status: String(changeSet.status ?? ''), ...(changeSet.kind ? { kind: changeSet.kind } : {}), ...(typeof changeSet.idempotencyKey === 'string' ? { idempotencyKey: changeSet.idempotencyKey } : {}), ...(changeSet.beforeJson !== undefined ? { beforeJson: changeSet.beforeJson } : {}), ...(changeSet.afterJson !== undefined ? { afterJson: changeSet.afterJson } : {}) });

export function createPlanService(deps: {
  dumpRepository: BrainDumpRepository;
  analysisService: AnalysisService;
  taskRepository: TaskRepository;
  ideaRepository: IdeaRepository;
  changeSetRepository: ChangeSetRepository;
  goalGraphRepository?: GoalGraphRepository;
  calendarService?: BusySlotService;
  calendarEventService?: CalendarEventService;
  adaptationService?: AdaptationService;
}): PlanService {
  const { dumpRepository, analysisService, taskRepository, ideaRepository, changeSetRepository, goalGraphRepository, calendarService, calendarEventService, adaptationService } = deps;

  async function preview(user: VerifiedUser, dumpId: string, input: unknown): Promise<PlanPreview> {
    const dump = await dumpRepository.get(user, dumpId);
    if (!dump || dump.user !== user.userId) throw new PlanNotFoundError();
    const parsed = planPreviewBodySchema.safeParse(input ?? {});
    if (!parsed.success) throw new PlanValidationError();
    const body: PlanPreviewBody = parsed.data;
    const goal = body.goalId && goalGraphRepository ? await goalGraphRepository.goals.get(user, body.goalId) : null;
    if (body.goalId && (!goal || goal.user !== user.userId || goal.status !== 'active')) throw new PlanValidationError();
    const result = await analysisService.result(user, dumpId);
    if (!result || result.status !== 'classified' || result.analysis.questions.length > 0) throw new PlanValidationError();
    const analysis = result.analysis;
    const profile: SchedulerProfile = { ...body.profile, timezone: body.timezone ?? body.profile.timezone };
    const tasks: SchedulerTask[] = analysis.tasks.map((task, index) => ({ id: `proposal-${result.id}-t-${index + 1}`, title: task.title, estimatedMinutes: task.estimatedMinutes, priority: task.priority, energy: task.energy, goalAlignment: priorityAlignment[task.priority] ?? .5, deadline: task.deadline, }));
    let calendarWarning: { code: string; message: string } | undefined;
    let inputBusySlots = body.busySlots;
    if (calendarService && body.calendarDate) {
      const calendar = await calendarService.day(user, body.calendarDate);
      const slots = Array.isArray(calendar.slots) ? calendar.slots : [];
      if (slots.length) inputBusySlots = slots.map((slot: any, index) => ({ id: String(slot.id ?? `calendar-${index}`), title: 'Зайнято', start: String(slot.start), end: String(slot.end), locked: true as const }));
      if (calendar.stale && !body.confirmCalendarConflicts) calendarWarning = { code: 'calendar-stale', message: 'Календар може бути застарілим. Підтвердьте план перед застосуванням.' };
    }
    const busySlots: SchedulerBusySlot[] = inputBusySlots.map((slot) => ({ ...slot, locked: true }));
    let plan;
    try { plan = buildDailyPlan({ tasks, busySlots, profile, now: asDate(body.now), acceptedAdaptations: adaptationService ? await adaptationService.schedulerAdjustments(user) : [] }); } catch { throw new PlanValidationError(); }
    const scheduled = new Map<string, { start: string; end: string }>();
    for (const block of plan.blocks) if (block.taskId && !scheduled.has(block.taskId)) scheduled.set(block.taskId, { start: block.start, end: block.end });
    const proposedTasks = analysis.tasks.map((task, index) => {
      const id = tasks[index].id; const slot = scheduled.get(id);
      return { id, title: task.title, description: task.description, status: slot ? 'scheduled' as const : 'inbox' as const, priority: task.priority, deadline: task.deadline, plannedStart: slot?.start ?? null, plannedEnd: slot?.end ?? null, estimatedMinutes: task.estimatedMinutes, energy: task.energy, flexible: true, locked: false, sourceDump: dumpId, goalId: goal?.id ?? null };
    });
    const ideas = analysis.ideas.map((idea, index) => ({ id: `proposal-${result.id}-i-${index + 1}`, text: idea.text, summary: idea.summary, status: 'backlog' as const, sourceDump: dumpId, goalId: goal?.id ?? null }));
    const idempotencyKey = body.idempotencyKey ?? `plan:${user.userId}:${dumpId}:${result.id}`;
    const existing = (await changeSetRepository.list(user)).find((record) => record.idempotencyKey === idempotencyKey);
    if (existing?.status === 'applied') return { changeSetId: existing.id, tasks: proposedTasks, ideas, blocks: plan.blocks, unscheduledTaskIds: plan.unscheduledTaskIds, warnings: plan.warnings, reasons: plan.reasons };
    let changeSet = existing;
    if (!changeSet) {
      const currentTasks = (await taskRepository.list(user)).filter((task) => task.sourceDump === dumpId);
      const currentIdeas = (await ideaRepository.list(user)).filter((idea) => idea.sourceDump === dumpId);
      try { changeSet = await changeSetRepository.create(user, { kind: 'ai_classification', status: 'pending', beforeJson: { tasks: currentTasks, ideas: currentIdeas }, afterJson: { dumpId, tasks: proposedTasks, ideas, ...(calendarWarning ? { calendarStale: true } : {}) }, idempotencyKey }); }
      catch { changeSet = (await changeSetRepository.list(user)).find((record) => record.idempotencyKey === idempotencyKey); if (!changeSet) throw new RepositoryError('UNAVAILABLE'); }
    }
    return planPreviewSchema.parse({ changeSetId: changeSet.id, tasks: proposedTasks, ideas, blocks: plan.blocks, unscheduledTaskIds: plan.unscheduledTaskIds, warnings: calendarWarning ? [...plan.warnings, calendarWarning] : plan.warnings, reasons: plan.reasons });
  }

  async function apply(user: VerifiedUser, changeSetId: string, input: unknown) {
    const changeSet = await changeSetRepository.get(user, changeSetId);
    if (!changeSet || changeSet.user !== user.userId) throw new PlanNotFoundError();
    const applyInput = applyBodySchema.safeParse(input ?? {});
    if (!applyInput.success || (applyInput.data.idempotencyKey && applyInput.data.idempotencyKey !== changeSet.idempotencyKey)) throw new PlanValidationError();
    if (changeSet.status === 'applied') {
      const payload = (changeSet.afterJson && typeof changeSet.afterJson === 'object') ? changeSet.afterJson as { dumpId?: string; tasks?: Array<Record<string, unknown>>; ideas?: Array<Record<string, unknown>> } : {};
      const appliedTaskIds = new Set((payload as { appliedTaskIds?: string[] }).appliedTaskIds ?? []); const appliedIdeaIds = new Set((payload as { appliedIdeaIds?: string[] }).appliedIdeaIds ?? []);
      if (typeof payload.dumpId === 'string') { try { await dumpRepository.update(user, payload.dumpId, { status: 'applied' }); } catch { /* a repeated idempotent apply retries this final owned-draft update */ } }
      return applyResponseSchema.parse({ changeSet: publicChangeSet(changeSet), tasks: (await taskRepository.list(user)).filter((task) => appliedTaskIds.has(task.id)).map(publicTask), ideas: (await ideaRepository.list(user)).filter((idea) => appliedIdeaIds.has(idea.id)).map(publicIdea) });
    }
    const payload = (changeSet.afterJson && typeof changeSet.afterJson === 'object') ? changeSet.afterJson as { dumpId?: string; tasks?: unknown[]; ideas?: unknown[]; calendarStale?: boolean } : {};
    if (payload.calendarStale === true && applyInput.data.confirmCalendarConflicts !== true) throw new PlanValidationError();
    const proposedTasks = Array.isArray(payload.tasks) ? payload.tasks : [];
    const proposedIdeas = Array.isArray(payload.ideas) ? payload.ideas : [];
    const persistedTasks: TaskRecord[] = []; const persistedIdeas: Awaited<ReturnType<IdeaRepository['list']>> = []; const createdTasks: TaskRecord[] = []; const createdIdeas: Awaited<ReturnType<IdeaRepository['list']>> = []; const persistedEdges: GraphEdgeRecord[] = []; const createdEdges: GraphEdgeRecord[] = [];
    try {
      for (const proposed of proposedTasks) { const value = proposed as Record<string, unknown>; const { id: _id, ...input } = value; const existing = (await taskRepository.list(user)).find((task) => task.id === value.id || (task.sourceDump === value.sourceDump && task.title === value.title)); const task = existing ?? await taskRepository.create(user, input as never); persistedTasks.push(task); if (!existing) createdTasks.push(task); }
      for (const proposed of proposedIdeas) { const value = proposed as Record<string, unknown>; const { id: _id, ...input } = value; const existing = (await ideaRepository.list(user)).find((idea) => idea.id === value.id || (idea.sourceDump === value.sourceDump && idea.text === value.text)); const idea = existing ?? await ideaRepository.create(user, input as never); persistedIdeas.push(idea); if (!existing) createdIdeas.push(idea); }
      if (goalGraphRepository) {
        const existingEdges = await goalGraphRepository.edges.list(user);
        for (const [entityType, entities] of [['task', persistedTasks], ['idea', persistedIdeas]] as const) for (const entity of entities) if (entity.goalId) {
          const duplicate = existingEdges.find((edge) => edge.fromType === entityType && edge.fromId === entity.id && edge.toType === 'goal' && edge.toId === entity.goalId && edge.status === 'confirmed');
          if (duplicate) persistedEdges.push(duplicate);
          else { const edge = await goalGraphRepository.edges.create(user, { fromType: entityType, fromId: entity.id, toType: 'goal', toId: String(entity.goalId), actor: 'ai', status: 'confirmed', confirmedBy: user.userId, confidence: 1, rationale: 'Підтверджено користувачем під час розбору Brain Dump.' }); createdEdges.push(edge); persistedEdges.push(edge); }
        }
      }
      if (calendarEventService) {
        await Promise.all(persistedTasks.filter((task) => Boolean(task.plannedStart && task.plannedEnd)).map(async (task) => {
          try { await calendarEventService.syncTask(user, task.id); } catch { /* local task remains valid with sync_pending and an outbox job */ }
        }));
      }
      const updated = await changeSetRepository.update(user, changeSetId, { status: 'applied', afterJson: { ...payload, appliedTaskIds: persistedTasks.map((task) => task.id), appliedIdeaIds: persistedIdeas.map((idea) => idea.id), appliedEdgeIds: persistedEdges.map((edge) => edge.id) } });
      if (typeof payload.dumpId === 'string') { try { await dumpRepository.update(user, payload.dumpId, { status: 'applied' }); } catch { /* a repeated idempotent apply retries this final owned-draft update */ } }
      return applyResponseSchema.parse({ changeSet: publicChangeSet(updated), tasks: persistedTasks.map(publicTask), ideas: persistedIdeas.map(publicIdea) });
    } catch (error) {
      for (const edge of createdEdges) { try { if (edge.id) await goalGraphRepository?.edges.delete(user, edge.id); } catch { /* retain failed change set for safe retry */ } }
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
    async inbox(user) {
      const drafts = (await dumpRepository.list(user))
        .filter((draft) => String(draft.rawText ?? draft.transcript ?? '').trim().length > 0)
        .sort((left, right) => String(right.created ?? '').localeCompare(String(left.created ?? '')))
        .map(publicDraft);
      return inboxResponseSchema.parse({ ideas: (await ideaRepository.list(user)).filter((idea) => idea.status === 'backlog').map(publicIdea), tasks: (await taskRepository.list(user)).filter((task) => task.status === 'inbox').map(publicTask), drafts });
    },
    async task(user, id) { const record = await taskRepository.get(user, id); if (!record || record.user !== user.userId) throw new PlanNotFoundError(); return publicTask(record); },
  };
}
