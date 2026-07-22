import type { PocketBaseClient, PocketBaseRecord } from '../pocketbase/client.js';
import type { VerifiedUser } from '../auth/verifyPocketBaseToken.js';
import { createOwned, deleteOwned, listOwned, owned, updateOwned, RepositoryError } from './base.js';

export type TaskRecord = PocketBaseRecord & { title?: string; status?: string; deadline?: string; estimatedMinutes?: number; version?: number; goalId?: string | null; sourceDump?: string };
export type TaskInput = Omit<Partial<TaskRecord>, 'id' | 'user'> & { user?: never };
export interface TaskRepository {
  create(user: VerifiedUser, input: TaskInput): Promise<TaskRecord>;
  get(user: VerifiedUser, id: string): Promise<TaskRecord | null>;
  list(user: VerifiedUser): Promise<TaskRecord[]>;
  update(user: VerifiedUser, id: string, input: TaskInput): Promise<TaskRecord>;
  updateIfVersion(user: VerifiedUser, id: string, expectedVersion: number, input: TaskInput): Promise<TaskRecord>;
  delete(user: VerifiedUser, id: string): Promise<void>;
}
export function createTaskRepository(client: PocketBaseClient): TaskRepository {
  return {
    create: (user, input) => createOwned<TaskRecord>(client, 'tasks', user, input),
    get: (user, id) => owned<TaskRecord>(client, 'tasks', user, id),
    list: (user) => listOwned<TaskRecord>(client, 'tasks', user),
    update: (user, id, input) => updateOwned<TaskRecord>(client, 'tasks', user, id, input),
    updateIfVersion: async (user, id, expectedVersion, input) => {
      const current = await owned<TaskRecord>(client, 'tasks', user, id);
      if (!current) throw new RepositoryError('NOT_FOUND');
      if (Number(current.version ?? 0) !== expectedVersion) throw new RepositoryError('INVALID', 'VERSION_CONFLICT');
      return updateOwned<TaskRecord>(client, 'tasks', user, id, input);
    },
    delete: (user: VerifiedUser, id: string) => deleteOwned(client, 'tasks', user, id),
  };
}
