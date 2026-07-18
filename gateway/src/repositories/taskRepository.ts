import type { PocketBaseClient, PocketBaseRecord } from '../pocketbase/client.js';
import type { VerifiedUser } from '../auth/verifyPocketBaseToken.js';
import { createOwned, deleteOwned, listOwned, owned, updateOwned } from './base.js';

export type TaskRecord = PocketBaseRecord & { title?: string; status?: string; deadline?: string; estimatedMinutes?: number };
export type TaskInput = Omit<Partial<TaskRecord>, 'id' | 'user'> & { user?: never };
export interface TaskRepository {
  create(user: VerifiedUser, input: TaskInput): Promise<TaskRecord>;
  get(user: VerifiedUser, id: string): Promise<TaskRecord | null>;
  list(user: VerifiedUser): Promise<TaskRecord[]>;
  update(user: VerifiedUser, id: string, input: TaskInput): Promise<TaskRecord>;
  delete(user: VerifiedUser, id: string): Promise<void>;
}
export function createTaskRepository(client: PocketBaseClient): TaskRepository {
  return {
    create: (user, input) => createOwned<TaskRecord>(client, 'tasks', user, input),
    get: (user, id) => owned<TaskRecord>(client, 'tasks', user, id),
    list: (user) => listOwned<TaskRecord>(client, 'tasks', user),
    update: (user, id, input) => updateOwned<TaskRecord>(client, 'tasks', user, id, input),
    delete: (user: VerifiedUser, id: string) => deleteOwned(client, 'tasks', user, id),
  };
}
