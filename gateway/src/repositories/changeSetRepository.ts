import type { PocketBaseClient, PocketBaseRecord } from '../pocketbase/client.js';
import type { VerifiedUser } from '../auth/verifyPocketBaseToken.js';
import { createOwned, deleteOwned, listOwned, updateOwned, owned, RepositoryError } from './base.js';
export type ChangeSetRecord = PocketBaseRecord & { kind?: string; status?: string; beforeJson?: string; afterJson?: string; undoneAt?: string; taskId?: string; mutationKey?: string };
export type ChangeSetInput = Omit<Partial<ChangeSetRecord>, 'id' | 'user'> & { user?: never };
export interface ChangeSetRepository { create(user: VerifiedUser, input: ChangeSetInput): Promise<ChangeSetRecord>; get(user: VerifiedUser, id: string): Promise<ChangeSetRecord | null>; list(user: VerifiedUser): Promise<ChangeSetRecord[]>; update(user: VerifiedUser, id: string, input: ChangeSetInput): Promise<ChangeSetRecord>; transition(user: VerifiedUser, id: string, from: string, to: string, input?: ChangeSetInput): Promise<ChangeSetRecord>; undo(user: VerifiedUser, id: string): Promise<ChangeSetRecord>; delete(user: VerifiedUser, id: string): Promise<void>; }
export function createChangeSetRepository(client: PocketBaseClient): ChangeSetRepository {
  return {
    create: (user, input) => createOwned<ChangeSetRecord>(client, 'change_sets', user, input),
    get: (user, id) => owned<ChangeSetRecord>(client, 'change_sets', user, id),
    list: (user) => listOwned<ChangeSetRecord>(client, 'change_sets', user),
    update: (user, id, input) => updateOwned<ChangeSetRecord>(client, 'change_sets', user, id, input),
    transition: async (user, id, from, to, input = {}) => {
      const current = await owned<ChangeSetRecord>(client, 'change_sets', user, id);
      if (!current) throw new RepositoryError('NOT_FOUND');
      if (current.status !== from) throw new RepositoryError('INVALID', 'STATUS_CONFLICT');
      return updateOwned<ChangeSetRecord>(client, 'change_sets', user, id, { ...input, status: to });
    },
    undo: (user, id) => updateOwned<ChangeSetRecord>(client, 'change_sets', user, id, { status: 'undone', undoneAt: new Date().toISOString() }),
    delete: (user: VerifiedUser, id: string) => deleteOwned(client, 'change_sets', user, id),
  };
}
