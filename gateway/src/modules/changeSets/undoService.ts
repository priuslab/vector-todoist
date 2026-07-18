import type { VerifiedUser } from '../../auth/verifyPocketBaseToken.js';
import { RepositoryError } from '../../repositories/base.js';
import type { ChangeSetRecord, ChangeSetRepository } from '../../repositories/changeSetRepository.js';
import type { TaskRepository } from '../../repositories/taskRepository.js';
import type { JobRepository } from '../jobs/jobRepository.js';
import { changeSetResponseSchema, taskResponseSchema, undoChangeSetSchema } from '../tasks/taskSchemas.js';

export class UndoNotFoundError extends Error { readonly code = 'NOT_FOUND'; }
export class UndoConflictError extends Error { readonly code = 'CONFLICT'; }

const publicTask = (task: Record<string, unknown>) => taskResponseSchema.parse(Object.fromEntries(['id', 'title', 'description', 'status', 'priority', 'deadline', 'plannedStart', 'plannedEnd', 'estimatedMinutes', 'actualMinutes', 'energy', 'flexible', 'locked', 'sourceDump', 'rescheduleCount', 'completedAt', 'version'].filter((key) => task[key] !== undefined).map((key) => [key, task[key]])));
const beforeTasksFrom = (change: ChangeSetRecord): Array<Record<string, unknown> & { id: string }> => {
  const before = change.beforeJson && typeof change.beforeJson === 'object' ? change.beforeJson as Record<string, unknown> : {};
  const tasks = Array.isArray(before.tasks) ? before.tasks : [];
  return tasks.filter((task): task is Record<string, unknown> & { id: string } => Boolean(task && typeof task === 'object' && typeof (task as Record<string, unknown>).id === 'string'));
};
const afterTasksFrom = (change: ChangeSetRecord): Array<Record<string, unknown> & { id: string }> => {
  const after = change.afterJson && typeof change.afterJson === 'object' ? change.afterJson as Record<string, unknown> : {};
  const raw = Array.isArray(after.tasks) ? after.tasks : Array.isArray(after.changes) ? after.changes.map((item) => (item as Record<string, unknown>).after) : [];
  return raw.filter((task): task is Record<string, unknown> & { id: string } => Boolean(task && typeof task === 'object' && typeof (task as Record<string, unknown>).id === 'string'));
};
export interface UndoService { undo(user: VerifiedUser, id: string, input?: unknown): Promise<{ task?: ReturnType<typeof publicTask>; tasks?: Array<ReturnType<typeof publicTask>>; changeSet: ReturnType<typeof changeSetResponseSchema.parse> }>; }

export function createUndoService(deps: { changeSetRepository: ChangeSetRepository; taskRepository: TaskRepository; jobRepository?: Pick<JobRepository, 'getByIdempotencyKey' | 'create'> }): UndoService {
  const { changeSetRepository, taskRepository, jobRepository } = deps;
  return {
    async undo(user, id, input = {}) {
      const parsedInput = undoChangeSetSchema.safeParse(input ?? {});
      if (!parsedInput.success) throw new UndoConflictError();
      const change = await changeSetRepository.get(user, id);
      if (!change || change.user !== user.userId) throw new UndoNotFoundError();
      const taskId = typeof change.taskId === 'string' ? change.taskId : undefined;
      if (change.status === 'undone') {
        const batch = beforeTasksFrom(change);
        if (batch.length > 0) {
          const tasks = (await Promise.all(batch.map((item) => taskRepository.get(user, item.id)))).filter(Boolean).map((task) => publicTask(task!));
          return { tasks, task: tasks[0], changeSet: changeSetResponseSchema.parse({ id: change.id, kind: change.kind ?? 'reschedule', status: 'undone' }) };
        }
        const task = taskId ? await taskRepository.get(user, taskId) : null;
        return { task: task ? publicTask(task) : undefined, changeSet: changeSetResponseSchema.parse({ id: change.id, kind: change.kind ?? 'manual', status: 'undone', taskId }) };
      }
      const beforeTasks = beforeTasksFrom(change);
      if (beforeTasks.length > 0) {
        const afterTasks = afterTasksFrom(change);
        const reservationKey = `undo:${id}`;
        try { await changeSetRepository.create(user, { kind: 'manual', status: 'pending', beforeJson: { taskId: '__batch__' }, afterJson: { taskId: '__batch__' }, idempotencyKey: reservationKey, taskId: '__batch__', mutationKey: reservationKey }); }
        catch { const reservations = await changeSetRepository.list(user); if (reservations.some((item) => item.mutationKey === reservationKey && item.id !== id)) throw new UndoConflictError(); }
        const restored: Array<ReturnType<typeof publicTask>> = [];
        const currentBefore = new Map<string, Record<string, unknown>>();
        try {
          // Preflight every record before mutating any row; a stale member aborts the whole batch.
          for (const before of beforeTasks) {
            const current = await taskRepository.get(user, before.id);
            if (!current) throw new UndoNotFoundError();
            const after = afterTasks.find((item) => item.id === before.id);
            if (after?.version !== undefined && String(current.version ?? '') !== String(after.version)) throw new UndoConflictError();
            currentBefore.set(before.id, { ...current });
          }
          for (const before of beforeTasks) {
            const current = currentBefore.get(before.id)!;
            const { id: _id, user: _user, collectionName: _collection, created: _created, updated: _updated, ...restore } = before as Record<string, unknown>;
            const patch = { ...restore, version: (Number(current.version) || 0) + 1 };
            const task = taskRepository.updateIfVersion ? await taskRepository.updateIfVersion(user, before.id, Number(current.version ?? 0), patch) : await taskRepository.update(user, before.id, patch);
            restored.push(publicTask(task));
            if (jobRepository && before.calendarEventId && before.syncStatus === 'synced') {
              const key = `calendar:undo:${id}:${before.id}`;
              if (!await jobRepository.getByIdempotencyKey(user, key)) await jobRepository.create(user, { type: 'calendar.update', idempotencyKey: key, payloadJson: { taskId: before.id, changeSetId: id }, status: 'pending', attempts: 0, nextRunAt: new Date().toISOString() });
            }
          }
          const updated = changeSetRepository.transition ? await changeSetRepository.transition(user, id, String(change.status ?? 'applied'), 'undone', { undoneAt: new Date().toISOString() }) : await changeSetRepository.update(user, id, { status: 'undone', undoneAt: new Date().toISOString() });
          return { tasks: restored, task: restored[0], changeSet: changeSetResponseSchema.parse({ id: updated.id, kind: updated.kind ?? 'reschedule', status: 'undone' }) };
        } catch (error) {
          // Compensate already-restored rows so an injected mid-batch failure cannot leave a partial Undo.
          for (const [taskId, current] of currentBefore) {
            if (!restored.some((task) => task.id === taskId)) continue;
            try {
              const { id: _id, user: _user, collectionName: _collection, created: _created, updated: _updated, ...rollback } = current;
              await taskRepository.update(user, taskId, { ...rollback, version: (Number(current.version) || 0) + 2 });
            } catch { /* retain applied Change Set; caller can retry safely */ }
          }
          if (error instanceof UndoConflictError || error instanceof UndoNotFoundError) throw error; throw new UndoConflictError();
        }
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
