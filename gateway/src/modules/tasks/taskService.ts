import type { VerifiedUser } from '../../auth/verifyPocketBaseToken.js';
import { RepositoryError } from '../../repositories/base.js';
import type { ChangeSetRecord, ChangeSetRepository } from '../../repositories/changeSetRepository.js';
import type { TaskRecord, TaskRepository } from '../../repositories/taskRepository.js';
import { changeSetResponseSchema, taskPatchSchema, taskResponseSchema, type TaskPatch } from './taskSchemas.js';

export class TaskNotFoundError extends Error { readonly code = 'NOT_FOUND'; }
export class TaskValidationError extends Error { readonly code = 'INVALID_TASK'; }
export class TaskConflictError extends Error { readonly code = 'CONFLICT'; }

const publicTask = (task: TaskRecord) => taskResponseSchema.parse(Object.fromEntries([
  'id', 'title', 'description', 'status', 'priority', 'deadline', 'plannedStart', 'plannedEnd', 'estimatedMinutes',
  'actualMinutes', 'energy', 'flexible', 'locked', 'sourceDump', 'rescheduleCount', 'completedAt', 'version',
  'syncStatus', 'calendarEventId',
].filter((key) => task[key] !== undefined).map((key) => [key, task[key]])));
const versionOf = (task: TaskRecord): string | number | undefined => task.version as string | number | undefined;
const matchesVersion = (task: TaskRecord, expected: string | number | undefined) => expected === undefined || String(versionOf(task) ?? task.updated ?? '') === String(expected);
const nextVersion = (task: TaskRecord) => (Number(task.version) || 0) + 1;
const idempotency = (user: VerifiedUser, taskId: string, key: string | undefined, operation: string, version?: string | number) => key ?? `task:${operation}:${user.userId}:${taskId}:v${version ?? 0}`;
const snapshot = (task: TaskRecord) => ({ ...task });

export interface TaskMutationResult { task: ReturnType<typeof publicTask>; changeSet: ReturnType<typeof changeSetResponseSchema.parse>; }
export interface TaskService {
  get(user: VerifiedUser, id: string): Promise<ReturnType<typeof publicTask>>;
  update(user: VerifiedUser, id: string, input: unknown): Promise<TaskMutationResult>;
  complete(user: VerifiedUser, id: string, input: unknown): Promise<TaskMutationResult>;
}

export function createTaskService(deps: { taskRepository: TaskRepository; changeSetRepository: ChangeSetRepository }): TaskService {
  const { taskRepository, changeSetRepository } = deps;
  const locks = new Map<string, Promise<unknown>>();
  async function withLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = locks.get(key) ?? Promise.resolve();
    let release!: () => void; const current = new Promise<void>((resolve) => { release = resolve; });
    const queued = previous.then(() => current);
    locks.set(key, queued);
    await previous;
    try { return await operation(); } finally { release(); if (locks.get(key) === queued) locks.delete(key); }
  }
  async function owned(user: VerifiedUser, id: string) {
    const task = await taskRepository.get(user, id);
    if (!task || task.user !== user.userId) throw new TaskNotFoundError();
    return task;
  }
  async function mutate(user: VerifiedUser, id: string, patch: TaskPatch, operation: 'update' | 'complete', key?: string, expectedVersion?: string | number): Promise<TaskMutationResult> {
    const task = await owned(user, id);
    if (!matchesVersion(task, expectedVersion)) throw new TaskConflictError();
    const idem = idempotency(user, id, key, operation, versionOf(task) ?? 0);
    const existing = (await changeSetRepository.list(user)).find((change) => change.idempotencyKey === idem);
    if (existing?.status === 'applied' && existing.afterJson && typeof existing.afterJson === 'object') {
      const after = existing.afterJson as TaskRecord;
      return { task: publicTask(after), changeSet: changeSetResponseSchema.parse({ id: existing.id, kind: existing.kind ?? 'manual', status: existing.status, taskId: id }) };
    }
    const before = snapshot(task);
    const { expectedVersion: _expectedVersion, idempotencyKey: _idempotencyKey, ...editablePatch } = patch as TaskPatch & { expectedVersion?: unknown; idempotencyKey?: unknown };
    const changes: Record<string, unknown> = operation === 'complete'
      ? { status: 'completed', completedAt: new Date().toISOString(), version: nextVersion(task) }
      : { ...editablePatch, version: nextVersion(task) };
    const afterRecord = { ...task, ...changes } as TaskRecord;
    const mutationKey = `${id}:v${versionOf(task) ?? 0}`;
    let changeSet: ChangeSetRecord;
    try { changeSet = await changeSetRepository.create(user, { kind: 'manual', status: 'pending', beforeJson: before, afterJson: afterRecord, idempotencyKey: idem, taskId: id, mutationKey }); }
    catch (error) {
      const raced = (await changeSetRepository.list(user)).find((change) => change.idempotencyKey === idem || change.mutationKey === mutationKey);
      if (!raced) throw error;
      if (raced.status === 'applied' && raced.afterJson && typeof raced.afterJson === 'object') return { task: publicTask(raced.afterJson as TaskRecord), changeSet: changeSetResponseSchema.parse({ id: raced.id, kind: raced.kind ?? 'manual', status: raced.status, taskId: id }) };
      throw new TaskConflictError();
    }
    let updated: TaskRecord;
    try {
      const expectedNumber = expectedVersion === undefined ? undefined : Number(expectedVersion);
      updated = expectedNumber !== undefined && Number.isInteger(expectedNumber) && taskRepository.updateIfVersion
        ? await taskRepository.updateIfVersion(user, id, expectedNumber, changes)
        : await taskRepository.update(user, id, changes);
    } catch (error) {
      if (error instanceof RepositoryError && error.code === 'NOT_FOUND') throw new TaskNotFoundError();
      if (error instanceof RepositoryError && error.code === 'INVALID') throw new TaskConflictError();
      throw error;
    }
    const applied = await changeSetRepository.update(user, changeSet.id, { status: 'applied', afterJson: updated });
    return { task: publicTask(updated ?? afterRecord), changeSet: changeSetResponseSchema.parse({ id: applied.id, kind: applied.kind ?? 'manual', status: applied.status ?? 'applied', taskId: id }) };
  }
  return {
    get: async (user, id) => publicTask(await owned(user, id)),
    update: async (user, id, input) => {
      const parsed = taskPatchSchema.safeParse(input ?? {});
      if (!parsed.success) throw new TaskValidationError();
      const current = await owned(user, id);
      if (current.locked && (parsed.data.plannedStart !== undefined || parsed.data.plannedEnd !== undefined)) throw new TaskValidationError();
      if (parsed.data.plannedStart && parsed.data.plannedEnd && Date.parse(parsed.data.plannedStart) >= Date.parse(parsed.data.plannedEnd)) throw new TaskValidationError();
      return withLock(`${user.userId}:${id}`, () => mutate(user, id, parsed.data, 'update', parsed.data.idempotencyKey, parsed.data.expectedVersion));
    },
    complete: async (user, id, input) => {
      const parsed = (await import('./taskSchemas.js')).completeTaskSchema.safeParse(input ?? {});
      if (!parsed.success) throw new TaskValidationError();
      const task = await owned(user, id);
      const idem = idempotency(user, id, parsed.data.idempotencyKey, 'complete', versionOf(task) ?? 0);
      const existing = (await changeSetRepository.list(user)).find((change) => change.idempotencyKey === idem);
      if (existing?.status === 'applied') return { task: publicTask(task), changeSet: changeSetResponseSchema.parse({ id: existing.id, kind: existing.kind ?? 'manual', status: existing.status, taskId: id }) };
      if (task.status === 'completed') return { task: publicTask(task), changeSet: changeSetResponseSchema.parse({ id: `completed:${id}`, kind: 'manual', status: 'applied', taskId: id }) };
      return withLock(`${user.userId}:${id}`, () => mutate(user, id, {}, 'complete', parsed.data.idempotencyKey, parsed.data.expectedVersion));
    },
  };
}
