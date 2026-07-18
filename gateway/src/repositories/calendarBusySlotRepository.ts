import type { PocketBaseClient, PocketBaseRecord } from '../pocketbase/client.js';
import type { VerifiedUser } from '../auth/verifyPocketBaseToken.js';
import { createOwned, listOwned, ownerFilter, RepositoryError } from './base.js';
import type { BusyInterval } from '../integrations/google/calendarClient.js';

export type BusySlotRecord = PocketBaseRecord & BusyInterval & { user: string; date: string; syncedAt: string; stale?: boolean };
export type CalendarSyncMeta = { date: string; syncedAt: string; stale: boolean };
export interface CalendarBusySlotRepository {
  list(user: VerifiedUser, date: string): Promise<BusySlotRecord[]>;
  replace(user: VerifiedUser, date: string, slots: BusyInterval[], syncedAt: string): Promise<BusySlotRecord[]>;
  metadata(user: VerifiedUser, date: string): Promise<CalendarSyncMeta | null>;
  markStale(user: VerifiedUser, date: string): Promise<CalendarSyncMeta | null>;
}

const esc = (value: string) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
const collection = 'calendar_busy_slots';

export function createCalendarBusySlotRepository(client: PocketBaseClient): CalendarBusySlotRepository {
  const scoped = (user: VerifiedUser) => user.token && client.withToken ? client.withToken(user.token) : client;
  const metadataRows = async (user: VerifiedUser) => listOwned<PocketBaseRecord & CalendarSyncMeta>(scoped(user), 'calendar_syncs', user);
  return {
    async list(user, date) {
      try { return await listOwned<BusySlotRecord>(scoped(user), collection, user).then((rows) => rows.filter((row) => row.date === date)); }
      catch { throw new RepositoryError('UNAVAILABLE'); }
    },
    async replace(user, date, slots, syncedAt) {
      // Records are immutable snapshots. Removing only this user's date is safe; stale snapshots are never exposed.
      const current = await this.list(user, date);
      try {
        for (const row of current) await scoped(user).delete(collection, row.id);
        const result = await Promise.all(slots.map((slot) => createOwned<BusySlotRecord>(scoped(user), collection, user, { date, syncedAt, stale: false, id: slot.id, start: slot.start, end: slot.end, locked: true })));
        const metadata = (await metadataRows(user)).find((row) => row.date === date);
        if (metadata?.id) await scoped(user).update('calendar_syncs', metadata.id, { date, syncedAt, stale: false, user: user.userId });
        else await createOwned(scoped(user), 'calendar_syncs', user, { date, syncedAt, stale: false });
        return result;
      } catch { throw new RepositoryError('UNAVAILABLE'); }
    },
    async metadata(user, date) {
      const rows = await metadataRows(user);
      const row = rows.find((item) => item.date === date);
      return row ? { date, syncedAt: String(row.syncedAt ?? ''), stale: row.stale === true } : null;
    },
    async markStale(user, date) {
      const rows = await metadataRows(user);
      const row = rows.find((item) => item.date === date);
      if (!row) return null;
      const pb = scoped(user);
      try { await pb.update('calendar_syncs', row.id, { stale: true, user: user.userId }); }
      catch { throw new RepositoryError('UNAVAILABLE'); }
      return { date, syncedAt: String(row.syncedAt ?? ''), stale: true };
    },
  };
}

export const calendarBusySlotFilter = (user: VerifiedUser, date: string) => `${ownerFilter(user.userId)} && date = '${esc(date)}'`;
