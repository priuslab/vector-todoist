import { decryptSecret } from '../../crypto/encryptedSecret.js';
import type { CalendarConnection } from './googleOAuth.js';

export type CalendarEvent = {
  id?: string;
  status?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
};

export type BusyInterval = { id: string; start: string; end: string; locked: true };
export class GoogleCalendarError extends Error { constructor(message = 'Google Calendar unavailable') { super(message); this.name = 'GoogleCalendarError'; } }

type Provider = {
  listEvents(input: { accessToken: string; calendarId: string; timeMin: string; timeMax: string; timezone: string }): Promise<CalendarEvent[]>;
  refreshAccessToken(input: { refreshToken: string }): Promise<{ accessToken: string; expiresIn?: number }>;
};

const zonedIso = (date: string, time: string, timezone: string) => {
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  const rough = new Date(`${date}T${normalizedTime}Z`);
  const part = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' }).formatToParts(rough).find((item) => item.type === 'timeZoneName')?.value ?? 'GMT';
  const match = part.match(/GMT([+-])(\d{2})(?::(\d{2}))?/);
  const offset = match ? (Number(match[2]) * 60 + Number(match[3] ?? 0)) * (match[1] === '-' ? -1 : 1) : 0;
  return new Date(rough.getTime() - offset * 60_000).toISOString();
};

const dayBounds = (date: string, timezone: string, workday: { start: string; end: string }) => ({
  timeMin: zonedIso(date, workday.start, timezone),
  timeMax: zonedIso(date, workday.end, timezone),
});

const toIso = (value: string, timezone: string, eventTimezone = timezone, end = false) => {
  if (value.endsWith('Z') || /[+-]\d\d:\d\d$/.test(value)) return new Date(value).toISOString();
  const [date, time = end ? '23:59:59' : '00:00:00'] = value.split('T');
  return zonedIso(date, time.replace(/Z$/, '').slice(0, 8), eventTimezone);
};

export function createGoogleCalendarClient(options: {
  encryptionKey: Buffer | Uint8Array | string;
  clientId?: string;
  clientSecret?: string;
  provider?: Provider;
  calendarIds?: string[];
  decrypt?: (value: string, key: Buffer | Uint8Array | string) => string;
  now?: () => number;
}): { listBusyIntervals(input: { connection: CalendarConnection; date: string; timezone: string; workday: { start: string; end: string } }): Promise<{ intervals: BusyInterval[]; syncedAt: string }> } {
  const provider = options.provider ?? (options.clientId && options.clientSecret ? {
    async refreshAccessToken({ refreshToken }: { refreshToken: string }) {
      const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: options.clientId!, client_secret: options.clientSecret!, refresh_token: refreshToken, grant_type: 'refresh_token' }) });
      if (!response.ok) throw new GoogleCalendarError();
      const payload = await response.json() as Record<string, unknown>;
      if (typeof payload.access_token !== 'string') throw new GoogleCalendarError();
      return { accessToken: payload.access_token, expiresIn: typeof payload.expires_in === 'number' ? payload.expires_in : undefined };
    },
    async listEvents({ accessToken, calendarId, timeMin, timeMax, timezone }: { accessToken: string; calendarId: string; timeMin: string; timeMax: string; timezone: string }) {
      const query = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', timeZone: timezone });
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${query}`, { headers: { authorization: `Bearer ${accessToken}` } });
      if (response.status === 401) throw new GoogleCalendarError('UNAUTHORIZED');
      if (!response.ok) throw new GoogleCalendarError();
      const payload = await response.json() as { items?: CalendarEvent[] };
      return Array.isArray(payload.items) ? payload.items : [];
    },
  } satisfies Provider : undefined);
  if (!provider) throw new Error('Google Calendar provider is required');
  const decryptToken = options.decrypt ?? decryptSecret;
  const now = options.now ?? (() => Date.now());

  return {
    async listBusyIntervals({ connection, date, timezone, workday }) {
      if (!connection.encryptedRefreshToken) throw new GoogleCalendarError('Google Calendar is not connected');
      const refreshToken = decryptToken(connection.encryptedRefreshToken, options.encryptionKey);
      const ids = connection.calendarIds?.length ? connection.calendarIds : options.calendarIds?.length ? options.calendarIds : ['primary'];
      const bounds = dayBounds(date, timezone, workday);
      let token = await provider.refreshAccessToken({ refreshToken });
      let refreshed = false;
      const events: CalendarEvent[] = [];
      for (const calendarId of ids) {
        try {
          events.push(...await provider.listEvents({ accessToken: token.accessToken, calendarId, ...bounds, timezone }));
        } catch (error) {
          const unauthorized = error instanceof GoogleCalendarError ? error.message === 'UNAUTHORIZED' : /401|unauthorized/i.test(String((error as Error)?.message ?? error));
          if (!unauthorized) throw new GoogleCalendarError();
          if (refreshed) throw new GoogleCalendarError();
          refreshed = true;
          token = await provider.refreshAccessToken({ refreshToken });
          events.push(...await provider.listEvents({ accessToken: token.accessToken, calendarId, ...bounds, timezone }));
        }
      }
      const startWork = zonedIso(date, workday.start, timezone);
      const endWork = zonedIso(date, workday.end, timezone);
      const normalized = events
        .filter((event) => event.status !== 'cancelled' && event.status !== 'declined')
        .map((event, index) => {
          const allDay = Boolean(event.start?.date && !event.start?.dateTime);
          const eventTimezone = event.start?.timeZone ?? timezone;
          const start = allDay ? startWork : toIso(event.start?.dateTime ?? event.start?.date ?? startWork, timezone, eventTimezone);
          const end = allDay ? endWork : toIso(event.end?.dateTime ?? event.end?.date ?? endWork, timezone, event.end?.timeZone ?? eventTimezone, true);
          const startMs = Date.parse(start); const endMs = Date.parse(end);
          if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
          return { id: `${event.id ?? 'google-event'}-${index}`, start, end, locked: true as const };
        })
        .filter((item): item is BusyInterval => Boolean(item));
      normalized.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
      const merged: BusyInterval[] = [];
      for (const item of normalized) {
        const previous = merged.at(-1);
        if (previous && Date.parse(item.start) <= Date.parse(previous.end)) {
          if (Date.parse(item.end) > Date.parse(previous.end)) previous.end = item.end;
        } else merged.push({ ...item });
      }
      return { intervals: merged, syncedAt: new Date(now()).toISOString() };
    },
  };
}

export type GoogleCalendarClient = ReturnType<typeof createGoogleCalendarClient>;
