import type { VerifiedUser } from '../../auth/verifyPocketBaseToken.js';
import type { CalendarConnectionRepository } from '../../integrations/google/googleOAuth.js';
import type { CalendarBusySlotRepository } from '../../repositories/calendarBusySlotRepository.js';
import type { GoogleCalendarClient } from '../../integrations/google/calendarClient.js';

export type CalendarProfile = { timezone: string; workHours?: { start: string; end: string } };
export type CalendarBusySlot = { id: string; title: 'Зайнято'; start: string; end: string; locked: true };
export class CalendarSyncError extends Error { readonly code = 'CALENDAR_SYNC_FAILED'; }
export interface BusySlotService {
  sync(user: VerifiedUser, date: string, profile: CalendarProfile): Promise<{ date: string; slots: CalendarBusySlot[]; syncedAt: string | null; stale: boolean; warning?: string }>;
  day(user: VerifiedUser, date: string): Promise<{ date: string; slots: CalendarBusySlot[]; syncedAt: string | null; stale: boolean; warning?: string }>;
}

export function createBusySlotService(deps: { connectionRepository: CalendarConnectionRepository; busySlotRepository: CalendarBusySlotRepository; googleCalendarClient: GoogleCalendarClient }): BusySlotService {
  const { connectionRepository, busySlotRepository, googleCalendarClient } = deps;
  return {
    async sync(user, date, profile) {
      const connection = await connectionRepository.get(user);
      const workday = profile.workHours ?? { start: '09:00', end: '18:00' };
      if (!connection || connection.status !== 'connected') {
        const slots = await busySlotRepository.list(user, date);
        const metadata = await busySlotRepository.metadata(user, date);
        return { date, slots: slots.map((slot) => ({ id: slot.id, title: 'Зайнято' as const, start: slot.start, end: slot.end, locked: true as const })), syncedAt: metadata?.syncedAt ?? null, stale: true, warning: 'Підключіть Google Calendar, щоб оновити зайняті слоти.' };
      }
      try {
        const result = await googleCalendarClient.listBusyIntervals({ connection, date, timezone: profile.timezone, workday });
        const slots = await busySlotRepository.replace(user, date, result.intervals, result.syncedAt);
        return { date, slots: slots.map((slot) => ({ ...slot, title: 'Зайнято' })), syncedAt: result.syncedAt, stale: false };
      } catch {
        const existing = await this.day(user, date);
        const marked = await busySlotRepository.markStale(user, date).catch(() => existing);
        return { date, slots: existing.slots.map((slot) => ({ id: slot.id, title: 'Зайнято' as const, start: slot.start, end: slot.end, locked: true as const })), syncedAt: marked?.syncedAt ?? existing.syncedAt ?? null, stale: true, warning: 'Календар не оновився. Показую останню успішну синхронізацію.' };
      }
    },
    async day(user, date) {
      const slots = await busySlotRepository.list(user, date);
      const metadata = await busySlotRepository.metadata(user, date);
      const stale = metadata ? metadata.stale : true;
      return { date, slots: slots.map((slot) => ({ id: slot.id, title: 'Зайнято' as const, start: slot.start, end: slot.end, locked: true as const })), syncedAt: metadata?.syncedAt ?? null, stale, ...(stale ? { warning: metadata ? 'Календар може бути застарілим.' : 'Календар ще не синхронізовано.' } : {}) };
    },
  };
}
