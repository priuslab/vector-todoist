import type { VerifiedUser } from '../../auth/verifyPocketBaseToken.js';
import { RepositoryError } from '../../repositories/base.js';
import type { ChangeSetRepository } from '../../repositories/changeSetRepository.js';
import type { TaskRepository } from '../../repositories/taskRepository.js';
import type { GoalGraphRepository, GoalRecord, ProjectRecord, IdeaRecord, GraphEdgeRecord } from '../../repositories/goalGraphRepository.js';
import { edgeCreateSchema, edgePatchSchema, goalCreateSchema, goalPatchSchema, ideaCreateSchema, ideaPatchSchema, projectCreateSchema, projectPatchSchema, convertApplySchema, convertPreviewSchema } from './goalSchemas.js';

export class GoalNotFoundError extends Error { readonly code = 'NOT_FOUND'; }
export class GoalValidationError extends Error { readonly code = 'INVALID_GOAL'; }
export class GoalEntitlementError extends Error { readonly code = 'ENTITLEMENT_REQUIRED'; }
export class GoalConflictError extends Error { readonly code = 'CONFLICT'; }

export interface GoalService {
  goals: { list(u: VerifiedUser): Promise<GoalRecord[]>; get(u: VerifiedUser, id: string): Promise<GoalRecord>; create(u: VerifiedUser, input: unknown): Promise<GoalRecord>; update(u: VerifiedUser, id: string, input: unknown): Promise<GoalRecord>; delete(u: VerifiedUser, id: string): Promise<void> };
  projects: { list(u: VerifiedUser): Promise<ProjectRecord[]>; get(u: VerifiedUser, id: string): Promise<ProjectRecord>; create(u: VerifiedUser, input: unknown): Promise<ProjectRecord>; update(u: VerifiedUser, id: string, input: unknown): Promise<ProjectRecord>; delete(u: VerifiedUser, id: string): Promise<void> };
  ideas: { list(u: VerifiedUser): Promise<IdeaRecord[]>; get(u: VerifiedUser, id: string): Promise<IdeaRecord>; create(u: VerifiedUser, input: unknown): Promise<IdeaRecord>; update(u: VerifiedUser, id: string, input: unknown): Promise<IdeaRecord> };
  graph: { list(u: VerifiedUser): Promise<GraphEdgeRecord[]>; create(u: VerifiedUser, input: unknown): Promise<GraphEdgeRecord>; update(u: VerifiedUser, id: string, input: unknown): Promise<GraphEdgeRecord>; delete(u: VerifiedUser, id: string): Promise<void> };
  conversion: { preview(u: VerifiedUser, ideaId: string, input: unknown): Promise<Record<string, unknown>>; apply(u: VerifiedUser, ideaId: string, input: unknown): Promise<Record<string, unknown>>; undo(u: VerifiedUser, changeSetId: string): Promise<Record<string, unknown>> };
}

const owned = <T extends { user?: string }>(user: VerifiedUser, record: T | null): T => { if (!record || record.user !== user.userId) throw new GoalNotFoundError(); return record; };
const strip = (record: Record<string, unknown>) => { const { collectionName: _c, created: _cr, updated: _u, user: _user, ...safe } = record; return safe; };
const isPro = (deps: { entitlement?: (u: VerifiedUser) => Promise<boolean> | boolean }, u: VerifiedUser) => Promise.resolve(deps.entitlement?.(u) ?? false);

export function createGoalService(deps: { repository: GoalGraphRepository; changeSetRepository: ChangeSetRepository; taskRepository?: TaskRepository; entitlement?: (u: VerifiedUser) => Promise<boolean> | boolean; now?: () => string }): GoalService {
  const { repository: r, changeSetRepository: changes, taskRepository, now = () => new Date().toISOString() } = deps;
  const getGoal = async (u: VerifiedUser, id: string) => owned(u, await r.goals.get(u, id));
  const getProject = async (u: VerifiedUser, id: string) => owned(u, await r.projects.get(u, id));
  const getIdea = async (u: VerifiedUser, id: string) => owned(u, await r.ideas.get(u, id));
  async function previewConversion(u: VerifiedUser, ideaId: string, input: unknown) { const idea = await getIdea(u, ideaId); if (idea.status === 'converted') throw new GoalConflictError(); const parsed = convertPreviewSchema.safeParse(input ?? {}); if (!parsed.success) throw new GoalValidationError(); const projectTitle = parsed.data.projectTitle ?? idea.summary ?? idea.text ?? 'Новий проєкт'; const taskTitles = parsed.data.taskTitles ?? ['Уточнити наступний крок', 'Підготувати перший результат']; if (parsed.data.goalId) await getGoal(u, parsed.data.goalId); return { idea: strip(idea), project: { title: projectTitle, goalId: parsed.data.goalId ?? idea.goalId ?? null, status: 'active' }, tasks: taskTitles.map((title, index) => ({ title, status: 'inbox', priority: index === 0 ? 'high' : 'medium', estimatedMinutes: 25 })), requiresConfirmation: true }; }
  return {
    goals: {
      list: (u) => r.goals.list(u),
      get: getGoal,
      async create(u, input) { const parsed = goalCreateSchema.safeParse(input ?? {}); if (!parsed.success) throw new GoalValidationError(); const current = (await r.goals.list(u)).filter((g) => g.status !== 'archived' && g.status !== 'completed'); if (current.length > 0 && !(await isPro(deps, u))) throw new GoalEntitlementError(); return r.goals.create(u, { ...parsed.data, status: 'active', progress: 0 }); },
      async update(u, id, input) { const parsed = goalPatchSchema.safeParse(input ?? {}); if (!parsed.success) throw new GoalValidationError(); return r.goals.update(u, (await getGoal(u, id)).id, parsed.data); },
      async delete(u, id) { await getGoal(u, id); return r.goals.delete(u, id); },
    },
    projects: {
      list: (u) => r.projects.list(u), get: getProject,
      async create(u, input) { const parsed = projectCreateSchema.safeParse(input ?? {}); if (!parsed.success) throw new GoalValidationError(); if (parsed.data.goalId) await getGoal(u, parsed.data.goalId); return r.projects.create(u, { ...parsed.data, status: parsed.data.status ?? 'active' }); },
      async update(u, id, input) { const parsed = projectPatchSchema.safeParse(input ?? {}); if (!parsed.success) throw new GoalValidationError(); if (parsed.data.goalId) await getGoal(u, parsed.data.goalId); await getProject(u, id); return r.projects.update(u, id, parsed.data); },
      async delete(u, id) { await getProject(u, id); return r.projects.delete(u, id); },
    },
    ideas: {
      list: (u) => r.ideas.list(u), get: getIdea,
      async create(u, input) { const parsed = ideaCreateSchema.safeParse(input ?? {}); if (!parsed.success) throw new GoalValidationError(); if (parsed.data.goalId) await getGoal(u, parsed.data.goalId); if (parsed.data.projectId) await getProject(u, parsed.data.projectId); return r.ideas.create(u, { ...parsed.data, status: parsed.data.status ?? 'backlog' }); },
      async update(u, id, input) { const parsed = ideaPatchSchema.safeParse(input ?? {}); if (!parsed.success) throw new GoalValidationError(); if (parsed.data.goalId) await getGoal(u, parsed.data.goalId); if (parsed.data.projectId) await getProject(u, parsed.data.projectId); await getIdea(u, id); return r.ideas.update(u, id, parsed.data); },
    },
    graph: {
      list: (u) => r.edges.list(u),
      async create(u, input) { const parsed = edgeCreateSchema.safeParse(input ?? {}); if (!parsed.success) throw new GoalValidationError(); if (parsed.data.actor === 'ai' && parsed.data.status === 'confirmed') throw new GoalValidationError(); return r.edges.create(u, parsed.data); },
      async update(u, id, input) { const parsed = edgePatchSchema.safeParse(input ?? {}); if (!parsed.success) throw new GoalValidationError(); const current = owned(u, await r.edges.get(u, id)); if (parsed.data.actor === 'ai' && parsed.data.status === 'confirmed') throw new GoalValidationError(); return r.edges.update(u, current.id, parsed.data); },
      async delete(u, id) { const current = owned(u, await r.edges.get(u, id)); return r.edges.delete(u, current.id); },
    },
    conversion: {
      preview: previewConversion,
      async apply(u, ideaId, input) {
        const parsed = convertApplySchema.safeParse(input ?? {}); if (!parsed.success) throw new GoalValidationError(); const idea = await getIdea(u, ideaId); if (idea.status === 'converted') { const prior = (await changes.list(u)).find((c) => c.kind === 'idea_conversion' && c.taskId === ideaId && c.status === 'applied'); if (prior) return { changeSet: prior, idea }; throw new GoalConflictError(); }
        const key = parsed.data.idempotencyKey ?? `idea-convert:${u.userId}:${ideaId}`; const existing = (await changes.list(u)).find((c) => c.idempotencyKey === key); if (existing?.status === 'applied') return { changeSet: existing, idea: await getIdea(u, ideaId) };
        const { confirm: _confirm, idempotencyKey: _key, ...conversionInput } = parsed.data; const preview = await previewConversion(u, ideaId, conversionInput); const before = { idea: strip(idea) }; const created: { project?: ProjectRecord; tasks: unknown[] } = { tasks: [] };
        try {
          created.project = await r.projects.create(u, preview.project as Record<string, unknown>);
          if (taskRepository) for (const task of preview.tasks as Array<Record<string, unknown>>) created.tasks.push(await taskRepository.create(u, { ...task, projectId: created.project.id, sourceIdea: ideaId }));
          const updatedIdea = await r.ideas.update(u, ideaId, { status: 'converted', projectId: created.project.id });
          const change = existing ?? await changes.create(u, { kind: 'idea_conversion', status: 'pending', idempotencyKey: key, taskId: ideaId, beforeJson: before, afterJson: { idea: strip(updatedIdea), project: strip(created.project), tasks: created.tasks } });
          const applied = await changes.update(u, change.id, { status: 'applied', afterJson: { idea: strip(updatedIdea), project: strip(created.project), tasks: created.tasks } });
          return { changeSet: applied, idea: updatedIdea, project: created.project, tasks: created.tasks };
        } catch (error) {
          if (created.project) { try { await r.projects.delete(u, created.project.id); } catch { /* retain retryable change */ } }
          throw error instanceof RepositoryError ? error : new GoalConflictError();
        }
      },
      async undo(u, changeSetId) {
        const change = await changes.get(u, changeSetId); if (!change || change.user !== u.userId || change.kind !== 'idea_conversion') throw new GoalNotFoundError(); if (change.status === 'undone') return { changeSet: change };
        const before = change.beforeJson && typeof change.beforeJson === 'object' ? change.beforeJson as { idea?: IdeaRecord } : {}; const after = change.afterJson && typeof change.afterJson === 'object' ? change.afterJson as { idea?: IdeaRecord; project?: ProjectRecord; tasks?: Array<{ id: string }> } : {};
        if (after.project?.id) { try { await r.projects.delete(u, after.project.id); } catch { /* already removed */ } }
        if (taskRepository && after.tasks) for (const task of after.tasks) { try { await taskRepository.delete(u, task.id); } catch { /* idempotent undo */ } }
        if (before.idea) await r.ideas.update(u, before.idea.id, strip(before.idea));
        const updated = changes.transition ? await changes.transition(u, change.id, String(change.status ?? 'applied'), 'undone', { undoneAt: now() }) : await changes.update(u, change.id, { status: 'undone', undoneAt: now() });
        return { changeSet: updated, idea: before.idea };
      },
    },
  };
}
