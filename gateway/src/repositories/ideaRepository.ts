import type { PocketBaseClient, PocketBaseRecord } from '../pocketbase/client.js';
import type { VerifiedUser } from '../auth/verifyPocketBaseToken.js';
import { createOwned, deleteOwned, listOwned, updateOwned, owned } from './base.js';
export type IdeaRecord = PocketBaseRecord & { text?: string; summary?: string; status?: string };
export type IdeaInput = Omit<Partial<IdeaRecord>, 'id' | 'user'> & { user?: never };
export interface IdeaRepository { create(user: VerifiedUser, input: IdeaInput): Promise<IdeaRecord>; get(user: VerifiedUser, id: string): Promise<IdeaRecord | null>; list(user: VerifiedUser): Promise<IdeaRecord[]>; update(user: VerifiedUser, id: string, input: IdeaInput): Promise<IdeaRecord>; delete(user: VerifiedUser, id: string): Promise<void>; }
export function createIdeaRepository(client: PocketBaseClient): IdeaRepository {
  return {
    create: (user, input) => createOwned<IdeaRecord>(client, 'ideas', user, input),
    get: (user, id) => owned<IdeaRecord>(client, 'ideas', user, id),
    list: (user) => listOwned<IdeaRecord>(client, 'ideas', user),
    update: (user, id, input) => updateOwned<IdeaRecord>(client, 'ideas', user, id, input),
    delete: (user: VerifiedUser, id: string) => deleteOwned(client, 'ideas', user, id),
  };
}
