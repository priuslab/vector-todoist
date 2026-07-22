import type { PocketBaseClient, PocketBaseRecord } from '../pocketbase/client.js';
import type { VerifiedUser } from '../auth/verifyPocketBaseToken.js';

export class RepositoryError extends Error {
  constructor(readonly code: 'NOT_FOUND' | 'INVALID' | 'UNAVAILABLE', message: string = code, options?: { cause?: unknown }) {
    super(message, options);
  }
}

const quote = (value: string) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
export const ownerFilter = (userId: string) => `user = '${quote(userId)}'`;
export type RepoInput = Record<string, unknown>;
const forUser = (client: PocketBaseClient, user: VerifiedUser) => user.token && client.withToken ? client.withToken(user.token) : client;

export async function owned<T extends PocketBaseRecord>(client: PocketBaseClient, collection: string, user: VerifiedUser, id: string): Promise<T | null> {
  try {
    const records = await forUser(client, user).list<T>(collection, `${ownerFilter(user.userId)} && id = '${quote(id)}'`);
    const record = records.find((item) => item.id === id && item.user === user.userId);
    return record ?? null;
  } catch (error) { throw new RepositoryError('UNAVAILABLE', 'UNAVAILABLE', { cause: error }); }
}

export async function createOwned<T extends PocketBaseRecord>(client: PocketBaseClient, collection: string, user: VerifiedUser, data: RepoInput): Promise<T> {
  try { return await forUser(client, user).create<T>(collection, { ...data, user: user.userId }); } catch (error) { throw new RepositoryError('UNAVAILABLE', 'UNAVAILABLE', { cause: error }); }
}

export async function listOwned<T extends PocketBaseRecord>(client: PocketBaseClient, collection: string, user: VerifiedUser): Promise<T[]> {
  try {
    const records = await forUser(client, user).list<T>(collection, ownerFilter(user.userId));
    return records.filter((record) => record.user === user.userId);
  } catch (error) { throw new RepositoryError('UNAVAILABLE', 'UNAVAILABLE', { cause: error }); }
}

export async function updateOwned<T extends PocketBaseRecord>(client: PocketBaseClient, collection: string, user: VerifiedUser, id: string, data: RepoInput): Promise<T> {
  await requireOwned(client, collection, user, id);
  try { return await forUser(client, user).update<T>(collection, id, { ...data, user: user.userId }); } catch (error) { throw new RepositoryError('UNAVAILABLE', 'UNAVAILABLE', { cause: error }); }
}

export async function deleteOwned(client: PocketBaseClient, collection: string, user: VerifiedUser, id: string): Promise<void> {
  await requireOwned(client, collection, user, id);
  try { await forUser(client, user).delete(collection, id); } catch (error) { throw new RepositoryError('UNAVAILABLE', 'UNAVAILABLE', { cause: error }); }
}

export async function requireOwned<T extends PocketBaseRecord>(client: PocketBaseClient, collection: string, user: VerifiedUser, id: string): Promise<T> {
  const record = await owned<T>(client, collection, user, id);
  if (!record) throw new RepositoryError('NOT_FOUND');
  return record;
}
