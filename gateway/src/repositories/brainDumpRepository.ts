import type { PocketBaseClient, PocketBaseRecord } from '../pocketbase/client.js';
import type { VerifiedUser } from '../auth/verifyPocketBaseToken.js';
import { createOwned, deleteOwned, listOwned, updateOwned, owned } from './base.js';
export type BrainDumpRecord = PocketBaseRecord & { rawText?: string; transcript?: string; source?: string; status?: string; kind?: string; timezone?: string; idempotencyKey?: string };
export type BrainDumpInput = Omit<Partial<BrainDumpRecord>, 'id' | 'user'> & { user?: never };
export interface BrainDumpRepository { create(user: VerifiedUser, input: BrainDumpInput): Promise<BrainDumpRecord>; get(user: VerifiedUser, id: string): Promise<BrainDumpRecord | null>; list(user: VerifiedUser): Promise<BrainDumpRecord[]>; findByIdempotencyKey?(user: VerifiedUser, key: string): Promise<BrainDumpRecord | null>; update(user: VerifiedUser, id: string, input: BrainDumpInput): Promise<BrainDumpRecord>; delete(user: VerifiedUser, id: string): Promise<void>; }
export function createBrainDumpRepository(client: PocketBaseClient): BrainDumpRepository {
  return {
    create: (user, input) => createOwned<BrainDumpRecord>(client, 'brain_dumps', user, input),
    get: (user, id) => owned<BrainDumpRecord>(client, 'brain_dumps', user, id),
    list: (user) => listOwned<BrainDumpRecord>(client, 'brain_dumps', user),
    findByIdempotencyKey: async (user, key) => {
      const records = await listOwned<BrainDumpRecord>(client, 'brain_dumps', user);
      return records.find((record) => record.idempotencyKey === key) ?? null;
    },
    update: (user, id, input) => updateOwned<BrainDumpRecord>(client, 'brain_dumps', user, id, input),
    delete: (user: VerifiedUser, id: string) => deleteOwned(client, 'brain_dumps', user, id),
  };
}
