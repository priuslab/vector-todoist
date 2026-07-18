import type { PocketBaseClient, PocketBaseRecord } from '../pocketbase/client.js';
import type { VerifiedUser } from '../auth/verifyPocketBaseToken.js';
import { createOwned, deleteOwned, updateOwned, RepositoryError } from './base.js';
import type { CalendarConnection, CalendarConnectionRepository } from '../integrations/google/googleOAuth.js';

type Record = PocketBaseRecord & CalendarConnection;

export function createCalendarConnectionRepository(client: PocketBaseClient): CalendarConnectionRepository {
  return {
    async get(user) {
      const scoped = user.token && client.withToken ? client.withToken(user.token) : client;
      const rows = await scoped.list<Record>('calendar_connections', `user = '${user.userId.replaceAll("'", "\\'")}' && provider = 'google'`);
      const row = rows.find((item) => item.user === user.userId && item.provider === 'google');
      return row ?? null;
    },
    async upsert(user, input) {
      const existing = await this.get(user);
      try {
        if (existing?.id) return await updateOwned<Record>(client, 'calendar_connections', user, existing.id, input);
        return await createOwned<Record>(client, 'calendar_connections', user, input);
      } catch { throw new RepositoryError('UNAVAILABLE'); }
    },
    async delete(user) {
      const existing = await this.get(user);
      if (!existing) return;
      if (existing.id) await deleteOwned(client, 'calendar_connections', user, existing.id);
    },
  };
}
