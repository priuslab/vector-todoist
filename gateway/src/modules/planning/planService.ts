import type { VerifiedUser } from '../../auth/verifyPocketBaseToken.js';
import { RepositoryError } from '../../repositories/base.js';
import type { BrainDumpRepository } from '../../repositories/brainDumpRepository.js';
import type { TaskRepository, TaskRecord } from '../../repositories/taskRepository.js';
import type { IdeaRepository, IdeaRecord } from '../../repositories/ideaRepository.js';
import type { GoalGraphRepository, GraphEdgeRecord } from '../../repositories/goalGraphRepository.js';
import type { ChangeSetRepository, ChangeSetRecord } from '../../repositories/changeSetRepository.js';
import type { AnalysisService } from '../ai/analyzeBrainDump.js';
import { buildDailyPlan } from '../scheduler/buildDailyPlan.js';
import type { SchedulerBusySlot, SchedulerTask, SchedulerProfile } from '../scheduler/types.js';
import { applyBodySchema, applyResponseSchema, inboxResponseSchema, ideaResponseShape, normalizeLegacyPlanChangeSetPayload, planChangeSetPayloadSchema, planPreviewBodySchema, planPreviewSchema, taskResponseSchema, todayResponseSchema, type ChangeSetResponse, type PlanChangeSetPayload, type PlanPreviewBody, type PlanPreview, type TaskResponse, type IdeaResponse, type DraftResponse } from './planSchemas.js';
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
const parsePayload = (value: unknown): PlanChangeSetPayload => {
  const parsed = planChangeSetPayloadSchema.safeParse(normalizeLegacyPlanChangeSetPayload(value));
  if (!parsed.success) throw new PlanValidationError();
  return parsed.data;
};

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
  const applyLocks = new Map<string, Promise<unknown>>();
  async function withApplyLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = applyLocks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    const queued = previous.then(() => current);
    applyLocks.set(key, queued);
    await previous;
    try { return await operation(); } finally { release(); if (applyLocks.get(key) === queued) applyLocks.delete(key); }
  }

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
    const idempotencyKey = body.idempotencyKey ?? `plan:${user.userId}:${dumpId}:${result.id}`;
    const existing = (await changeSetRepository.list(user)).find((record) => record.idempotencyKey === idempotencyKey);
    if (existing) {
      const storedPayload = parsePayload(existing.afterJson);
      if (storedPayload.dumpId !== dumpId || storedPayload.goalId !== (body.goalId ?? null)) throw new PlanConflictError();
      if (storedPayload.preview) return planPreviewSchema.parse({ changeSetId: existing.id, tasks: storedPayload.tasks, ideas: storedPayload.ideas, ...storedPayload.preview });
      // Legacy pending Change Sets did not persist the scheduler output. Re-running
      // the scheduler here could display a proposal that conflicts with the
      // already-persisted task and idea proposals, so callers must start fresh.
      throw new PlanConflictError();
    }
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
    let changeSet: ChangeSetRecord | undefined = existing;
    if (!changeSet) {
      const currentTasks = (await taskRepository.list(user)).filter((task) => task.sourceDump === dumpId);
      const currentIdeas = (await ideaRepository.list(user)).filter((idea) => idea.sourceDump === dumpId);
      const preview = { blocks: plan.blocks, unscheduledTaskIds: plan.unscheduledTaskIds, warnings: calendarWarning ? [...plan.warnings, calendarWarning] : plan.warnings, reasons: plan.reasons };
      try { changeSet = await changeSetRepository.create(user, { kind: 'ai_classification', status: 'pending', beforeJson: { tasks: currentTasks, ideas: currentIdeas }, afterJson: { dumpId, goalId: goal?.id ?? null, tasks: proposedTasks, ideas, preview, ...(calendarWarning ? { calendarStale: true } : {}) }, idempotencyKey }); }
      catch { changeSet = (await changeSetRepository.list(user)).find((record) => record.idempotencyKey === idempotencyKey); if (!changeSet) throw new RepositoryError('UNAVAILABLE'); }
    }
    const storedPayload = parsePayload(changeSet.afterJson);
    if (storedPayload.dumpId !== dumpId || storedPayload.goalId !== (body.goalId ?? null)) throw new PlanConflictError();
    if (storedPayload.preview) return planPreviewSchema.parse({ changeSetId: changeSet.id, tasks: storedPayload.tasks, ideas: storedPayload.ideas, ...storedPayload.preview });
    throw new PlanConflictError();
  }

  async function appliedResult(user: VerifiedUser, changeSet: ChangeSetRecord, payload: PlanChangeSetPayload) {
    const appliedTaskIds = new Set(payload.appliedTaskIds ?? []);
    const appliedIdeaIds = new Set(payload.appliedIdeaIds ?? []);
    if (typeof payload.dumpId === 'string') { try { await dumpRepository.update(user, payload.dumpId, { status: 'applied' }); } catch { /* a repeated idempotent apply retries this final owned-draft update */ } }
    return applyResponseSchema.parse({ changeSet: publicChangeSet(changeSet), tasks: (await taskRepository.list(user)).filter((task) => appliedTaskIds.has(task.id)).map(publicTask), ideas: (await ideaRepository.list(user)).filter((idea) => appliedIdeaIds.has(idea.id)).map(publicIdea) });
  }
  async function waitForConcurrentApply(user: VerifiedUser, changeSetId: string) {
    const deadline = Date.now() + 2_000;
    do {
      const latest = await changeSetRepository.get(user, changeSetId);
      if (latest?.status === 'applied') return appliedResult(user, latest, parsePayload(latest.afterJson));
      if (!latest || latest.status === 'failed') break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    } while (Date.now() < deadline);
    throw new PlanConflictError();
  }

  async function applyOnce(user: VerifiedUser, changeSetId: string, input: unknown) {
    const changeSet = await changeSetRepository.get(user, changeSetId);
    if (!changeSet || changeSet.user !== user.userId) throw new PlanNotFoundError();
    const applyInput = applyBodySchema.safeParse(input ?? {});
    if (!applyInput.success || (applyInput.data.idempotencyKey && applyInput.data.idempotencyKey !== changeSet.idempotencyKey)) throw new PlanValidationError();
    const payload = parsePayload(changeSet.afterJson);
    const sourceDump = await dumpRepository.get(user, payload.dumpId);
    if (!sourceDump || sourceDump.id !== payload.dumpId || sourceDump.user !== user.userId) throw new PlanValidationError();
    if (changeSet.status === 'applied') return appliedResult(user, changeSet, payload);
    if (payload.calendarStale === true && applyInput.data.confirmCalendarConflicts !== true) throw new PlanValidationError();
    if (payload.goalId) {
      const goal = goalGraphRepository ? await goalGraphRepository.goals.get(user, payload.goalId) : null;
      if (!goal || goal.user !== user.userId || goal.status !== 'active') throw new PlanValidationError();
    }
    const reservationKey = `plan-apply:${changeSetId}`;
    const previousReservation = (await changeSetRepository.list(user)).find((record) => record.idempotencyKey === reservationKey || record.mutationKey === reservationKey);
    if (previousReservation?.status === 'failed') {
      try { await changeSetRepository.delete(user, previousReservation.id); } catch { throw new PlanConflictError(); }
    } else if (previousReservation) return waitForConcurrentApply(user, changeSetId);
    let reservation: ChangeSetRecord;
    try {
      reservation = await changeSetRepository.create(user, { kind: 'ai_classification', status: 'pending', beforeJson: { changeSetId }, afterJson: { changeSetId }, idempotencyKey: reservationKey, mutationKey: reservationKey });
    } catch {
      return waitForConcurrentApply(user, changeSetId);
    }
    const persistedTasks: TaskRecord[] = []; const persistedIdeas: IdeaRecord[] = []; const createdTasks: TaskRecord[] = []; const createdIdeas: IdeaRecord[] = []; const updatedTasks: Array<{ before: TaskRecord }> = []; const updatedIdeas: Array<{ before: IdeaRecord }> = []; const persistedEdges: GraphEdgeRecord[] = []; const createdEdges: GraphEdgeRecord[] = []; const removedEdges: GraphEdgeRecord[] = [];
    try {
      for (const proposed of payload.tasks) { const { id: _id, ...recordInput } = proposed; const existing = (await taskRepository.list(user)).find((task) => task.id === proposed.id || (task.sourceDump === proposed.sourceDump && task.title === proposed.title)); const before = existing ? { ...existing } : null; const task = existing ? await taskRepository.update(user, existing.id, recordInput) : await taskRepository.create(user, recordInput); persistedTasks.push(task); if (before) updatedTasks.push({ before }); else createdTasks.push(task); }
      for (const proposed of payload.ideas) { const { id: _id, ...recordInput } = proposed; const existing = (await ideaRepository.list(user)).find((idea) => idea.id === proposed.id || (idea.sourceDump === proposed.sourceDump && idea.text === proposed.text)); const before = existing ? { ...existing } : null; const idea = existing ? await ideaRepository.update(user, existing.id, recordInput) : await ideaRepository.create(user, recordInput); persistedIdeas.push(idea); if (before) updatedIdeas.push({ before }); else createdIdeas.push(idea); }
      if (goalGraphRepository) {
        const existingEdges = await goalGraphRepository.edges.list(user);
        const persistedEdgeIds = new Set<string>();
        for (const [entityType, records] of [['task', persistedTasks], ['idea', persistedIdeas]] as const) for (const entity of new Map(records.map((record) => [record.id, record])).values()) {
          const confirmedGoalEdges = existingEdges
            .filter((edge) => edge.fromType === entityType && edge.fromId === entity.id && edge.toType === 'goal' && edge.status === 'confirmed')
            .sort((left, right) => left.id.localeCompare(right.id));
          let canonicalEdge = entity.goalId ? confirmedGoalEdges.find((edge) => edge.toId === entity.goalId) : undefined;
          if (entity.goalId && !canonicalEdge) {
            canonicalEdge = await goalGraphRepository.edges.create(user, { fromType: entityType, fromId: entity.id, toType: 'goal', toId: String(entity.goalId), actor: 'ai', status: 'confirmed', confirmedBy: user.userId, confidence: 1, rationale: 'Підтверджено користувачем під час розбору Brain Dump.' });
            createdEdges.push(canonicalEdge);
          }
          if (canonicalEdge && !persistedEdgeIds.has(canonicalEdge.id)) { persistedEdges.push(canonicalEdge); persistedEdgeIds.add(canonicalEdge.id); }
          for (const obsoleteEdge of confirmedGoalEdges) if (obsoleteEdge.id !== canonicalEdge?.id) {
            await goalGraphRepository.edges.delete(user, obsoleteEdge.id);
            removedEdges.push(obsoleteEdge);
          }
        }
      }
      if (calendarEventService) {
        await Promise.all(persistedTasks.filter((task) => Boolean(task.plannedStart && task.plannedEnd)).map(async (task) => {
          try { await calendarEventService.syncTask(user, task.id); } catch { /* local task remains valid with sync_pending and an outbox job */ }
        }));
      }
      const updated = await changeSetRepository.update(user, changeSetId, { status: 'applied', afterJson: { ...payload, appliedTaskIds: [...new Set(persistedTasks.map((task) => task.id))], appliedIdeaIds: [...new Set(persistedIdeas.map((idea) => idea.id))], appliedEdgeIds: [...new Set(persistedEdges.map((edge) => edge.id))] } });
      try { await changeSetRepository.update(user, reservation.id, { status: 'applied' }); } catch { /* the applied source Change Set remains the idempotency authority */ }
      if (typeof payload.dumpId === 'string') { try { await dumpRepository.update(user, payload.dumpId, { status: 'applied' }); } catch { /* a repeated idempotent apply retries this final owned-draft update */ } }
      return applyResponseSchema.parse({ changeSet: publicChangeSet(updated), tasks: [...new Map(persistedTasks.map((task) => [task.id, task])).values()].map(publicTask), ideas: [...new Map(persistedIdeas.map((idea) => [idea.id, idea])).values()].map(publicIdea) });
    } catch (error) {
      for (const edge of createdEdges) { try { if (edge.id) await goalGraphRepository?.edges.delete(user, edge.id); } catch { /* retain failed change set for safe retry */ } }
      for (const edge of removedEdges) { try { await goalGraphRepository?.edges.create(user, pick(edge, ['fromType', 'fromId', 'toType', 'toId', 'actor', 'status', 'confirmedBy', 'confidence', 'rationale'])); } catch { /* retain failed change set for diagnosis */ } }
      for (const task of createdTasks) { try { if (task.id) await taskRepository.delete(user, task.id); } catch { try { if (task.id) await taskRepository.update(user, task.id, { status: 'cancelled' }); } catch { /* explicit failed change set remains retryable */ } } }
      for (const idea of createdIdeas) { try { if (idea.id) await ideaRepository.delete(user, idea.id); } catch { try { if (idea.id) await ideaRepository.update(user, idea.id, { status: 'archived' }); } catch { /* explicit failed change set remains retryable */ } } }
      for (const { before } of updatedTasks.reverse()) { try { await taskRepository.update(user, before.id, pick(before, ['title', 'description', 'status', 'priority', 'deadline', 'plannedStart', 'plannedEnd', 'estimatedMinutes', 'actualMinutes', 'energy', 'flexible', 'locked', 'sourceDump', 'goalId', 'rescheduleCount', 'version'])); } catch { /* explicit failed change set retains the snapshot for diagnosis */ } }
      for (const { before } of updatedIdeas.reverse()) { try { await ideaRepository.update(user, before.id, pick(before, ['text', 'summary', 'status', 'sourceDump', 'goalId', 'projectId'])); } catch { /* explicit failed change set retains the snapshot for diagnosis */ } }
      try { await changeSetRepository.update(user, changeSetId, { status: 'failed' }); } catch { /* retain retryable pending state */ }
      try { await changeSetRepository.update(user, reservation.id, { status: 'failed' }); } catch { /* preserve the durable reservation when status cannot be recorded */ }
      if (error instanceof RepositoryError) throw error;
      throw new PlanConflictError();
    }
  }

  const apply = (user: VerifiedUser, changeSetId: string, input: unknown) => withApplyLock(`${user.userId}:${changeSetId}`, () => applyOnce(user, changeSetId, input));

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
