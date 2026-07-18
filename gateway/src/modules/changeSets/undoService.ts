import type { VerifiedUser } from '../../auth/verifyPocketBaseToken.js';
import { RepositoryError } from '../../repositories/base.js';
import type { ChangeSetRecord, ChangeSetRepository } from '../../repositories/changeSetRepository.js';
import type { TaskRepository } from '../../repositories/taskRepository.js';
import { changeSetResponseSchema, taskResponseSchema, undoChangeSetSchema } from '../tasks/taskSchemas.js';

export class UndoNotFoundError extends Error { readonly code = 'NOT_FOUND'; }
export class UndoConflictError extends Error { readonly code = 'CONFLICT'; }

const publicTask = (task: Record<string, unknown>) => taskResponseSchema.parse(Object.fromEntries(['id', 'title', 'description', 'status', 'priority', 'deadline', 'plannedStart', 'plannedEnd', 'estimatedMinutes', 'actualMinutes', 'energy', 'flexible', 'locked', 'sourceDump', 'rescheduleCount', 'completedAt', 'version'].filter((key) => task[key] !== undefined).map((key) => [key, task[key]])));
export interface UndoService { undo(user: VerifiedUser, id: string, input?: unknown): Promise<{ task?: ReturnType<typeof publicTask>; changeSet: ReturnType<typeof changeSetResponseSchema.parse> }>; }

export function createUndoService(deps: { changeSetRepository: ChangeSetRepository; taskRepository: TaskRepository }): UndoService {
  const { changeSetRepository, taskRepository } = deps;
  return {
    async undo(user, id, input = {}) {
      const parsedInput = undoChangeSetSchema.safeParse(input ?? {});
      if (!parsedInput.success) throw new UndoConflictError();
      const change = await changeSetRepository.get(user, id);
      if (!change || change.user !== user.userId) throw new UndoNotFoundError();
      const taskId = typeof change.taskId === 'string' ? change.taskId : undefined;
      if (change.status === 'undone') {
        const task = taskId ? await taskRepository.get(user, taskId) : null;
        return { task: task ? publicTask(task) : undefined, changeSet: changeSetResponseSchema.parse({ id: change.id, kind: change.kind ?? 'manual', status: 'undone', taskId }) };
      }
      if (!taskId) throw new UndoConflictError();
      const before = change.beforeJson && typeof change.beforeJson === 'object' ? change.beforeJson as Record<string, unknown> : null;
      if (!before) throw new UndoConflictError();
      const current = await taskRepository.get(user, taskId);
      if (!current) throw new UndoNotFoundError();
      const after = change.afterJson && typeof change.afterJson === 'object' ? change.afterJson as Record<string, unknown> : null;
      if (after?.version !== undefined && String(current.version ?? '') !== String(after.version)) throw new UndoConflictError();
      const reservationKey = `undo:${id}`;
      try {
        await changeSetRepository.create(user, { kind: 'manual', status: 'pending', beforeJson: { taskId }, afterJson: { taskId }, idempotencyKey: reservationKey, taskId, mutationKey: reservationKey });
      } catch {
        const reservations = await changeSetRepository.list(user);
        if (reservations.some((item) => item.mutationKey === reservationKey && item.id !== id)) throw new UndoConflictError();
      }
      const { id: _id, user: _user, collectionName: _collection, created: _created, updated: _updated, ...restore } = before;
      let task;
      try { task = await taskRepository.update(user, taskId, { ...restore, version: (Number(current.version) || 0) + 1 }); }
      catch (error) { if (error instanceof RepositoryError && error.code === 'NOT_FOUND') throw new UndoNotFoundError(); throw error; }
      let updated;
      try { updated = changeSetRepository.transition ? await changeSetRepository.transition(user, id, String(change.status ?? 'applied'), 'undone', { undoneAt: new Date().toISOString() }) : await changeSetRepository.update(user, id, { status: 'undone', undoneAt: new Date().toISOString() }); }
      catch (error) {
        const latest = await changeSetRepository.get(user, id);
        if (latest?.status === 'undone') return { task: publicTask(task), changeSet: changeSetResponseSchema.parse({ id: latest.id, kind: latest.kind ?? 'manual', status: 'undone', taskId }) };
        throw new UndoConflictError();
      }
      return { task: publicTask(task), changeSet: changeSetResponseSchema.parse({ id: updated.id, kind: updated.kind ?? 'manual', status: 'undone', taskId }) };
    },
  };
}
