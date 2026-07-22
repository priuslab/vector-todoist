import { createHash, randomBytes } from 'node:crypto';
import type { VerifiedUser } from '../../auth/verifyPocketBaseToken.js';
import type { CalendarConnection, CalendarConnectionRepository } from './googleOAuth.js';
import type { JobRepository } from '../../modules/jobs/jobRepository.js';
import type { PocketBaseClient } from '../../pocketbase/client.js';
import { RepositoryError } from '../../repositories/base.js';

export type CalendarWatchRecord = {
  id: string;
  user: string;
  calendarId: string;
  channelId: string;
  channelToken?: string;
  channelTokenHash?: string;
  resourceId: string;
  expiration: string;
  status: 'active' | 'expired' | 'disabled';
};

export interface CalendarWatchRepository {
  get(user: VerifiedUser, calendarId: string): Promise<CalendarWatchRecord | null>;
  getByChannel(channelId: string): Promise<CalendarWatchRecord | null>;
  upsert(user: VerifiedUser, input: Omit<CalendarWatchRecord, 'id' | 'user'>): Promise<CalendarWatchRecord>;
  update(id: string, input: Partial<CalendarWatchRecord>): Promise<CalendarWatchRecord>;
}

export function createCalendarWatchRepository(client: PocketBaseClient): CalendarWatchRepository {
  const escaped = (value: string) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
  return {
    async get(user, calendarId) { try { const rows = await client.list<CalendarWatchRecord>('calendar_watch_channels', `user = '${escaped(user.userId)}' && calendarId = '${escaped(calendarId)}'`); return rows.find((row) => row.user === user.userId && row.calendarId === calendarId) ?? null; } catch { throw new RepositoryError('UNAVAILABLE'); } },
    async getByChannel(channelId) { try { const rows = await client.list<CalendarWatchRecord>('calendar_watch_channels', `channelId = '${escaped(channelId)}'`); return rows.find((row) => row.channelId === channelId) ?? null; } catch { throw new RepositoryError('UNAVAILABLE'); } },
    async upsert(user, input) { try { const existing = await this.get(user, input.calendarId); const { channelToken: _secret, ...safe } = input; if (existing) return await client.update<CalendarWatchRecord>('calendar_watch_channels', existing.id, { ...safe, user: user.userId }); return await client.create<CalendarWatchRecord>('calendar_watch_channels', { ...safe, user: user.userId }); } catch { throw new RepositoryError('UNAVAILABLE'); } },
    async update(id, input) { try { return await client.update<CalendarWatchRecord>('calendar_watch_channels', id, input); } catch { throw new RepositoryError('UNAVAILABLE'); } },
  };
}

export interface CalendarWatchProvider {
  watch(input: { connection: CalendarConnection; calendarId: string; channelId: string; channelToken: string; }): Promise<{ resourceId: string; expiration: string }>;
  stop?(input: { connection: CalendarConnection; calendarId: string; channelId: string; resourceId: string }): Promise<void>;
}

export class CalendarWatchUnavailableError extends Error {
  readonly code = 'CALENDAR_WATCH_UNAVAILABLE';
  constructor() { super('Google Calendar watch unavailable'); }
}

export class CalendarWatchValidationError extends Error {
  readonly code = 'INVALID_CALENDAR_NOTIFICATION';
  constructor() { super('Invalid Google Calendar notification'); }
}

const safeToken = (size: number) => randomBytes(size).toString('base64url');
const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');
const safeExpiration = (value: string) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
};

/** Owns Google watch channels and creates a renewal job before the provider expiry. */
export function createCalendarWatchService(deps: {
  repository: CalendarWatchRepository;
  connectionRepository: CalendarConnectionRepository;
  provider: CalendarWatchProvider;
  jobRepository: Pick<JobRepository, 'getByIdempotencyKey' | 'create'>;
  now?: () => number;
  randomToken?: (bytes: number) => string;
  renewalLeadMs?: number;
  defaultCalendarId?: string;
}) {
  const now = deps.now ?? (() => Date.now());
  const random = deps.randomToken ?? safeToken;
  const renewalLeadMs = Math.min(Math.max(deps.renewalLeadMs ?? 60 * 60_000, 60_000), 24 * 60 * 60_000);
  const defaultCalendarId = deps.defaultCalendarId ?? 'primary';

  async function scheduleRenewal(user: VerifiedUser, watch: CalendarWatchRecord) {
    const dueAt = Math.max(now(), Date.parse(watch.expiration) - renewalLeadMs);
    const key = `calendar.watch.renew:${user.userId}:${watch.calendarId}:${watch.channelId}`;
    if (await deps.jobRepository.getByIdempotencyKey(user, key)) return;
    try {
      await deps.jobRepository.create(user, {
        type: 'calendar.watch.renew', idempotencyKey: key,
        payloadJson: { watchId: watch.id, calendarId: watch.calendarId, channelId: watch.channelId },
        status: 'pending', attempts: 0, nextRunAt: new Date(dueAt).toISOString(),
      });
    } catch {
      // A concurrent worker may have reserved this idempotency key.
    }
  }

  async function renew(user: VerifiedUser, calendarId = defaultCalendarId): Promise<CalendarWatchRecord> {
    const connection = await deps.connectionRepository.get(user);
    if (!connection || connection.status !== 'connected') throw new CalendarWatchUnavailableError();
    const previous = await deps.repository.get(user, calendarId);
    const channelId = `vector-${random(18)}`;
    const channelToken = random(32);
    let providerResult: { resourceId: string; expiration: string };
    try {
      providerResult = await deps.provider.watch({ connection, calendarId, channelId, channelToken });
    } catch {
      throw new CalendarWatchUnavailableError();
    }
    const expiration = safeExpiration(providerResult.expiration);
    if (!providerResult.resourceId || !expiration || Date.parse(expiration) <= now()) throw new CalendarWatchUnavailableError();
    const watch = await deps.repository.upsert(user, {
      calendarId, channelId, channelToken, channelTokenHash: tokenHash(channelToken), resourceId: providerResult.resourceId, expiration, status: 'active',
    });
    if (previous && deps.provider.stop && previous.channelId !== channelId) {
      try { await deps.provider.stop({ connection, calendarId, channelId: previous.channelId, resourceId: previous.resourceId }); } catch { /* old channel expiry is harmless */ }
    }
    await scheduleRenewal(user, watch);
    return watch;
  }

  async function ensure(user: VerifiedUser, calendarId = defaultCalendarId): Promise<CalendarWatchRecord> {
    const current = await deps.repository.get(user, calendarId);
    if (current && current.status === 'active' && Date.parse(current.expiration) > now() + renewalLeadMs) {
      await scheduleRenewal(user, current);
      return current;
    }
    return renew(user, calendarId);
  }

  async function validateNotification(input: { channelId?: string; channelToken?: string; resourceId?: string }) {
    if (!input.channelId || !input.channelToken || !input.resourceId) throw new CalendarWatchValidationError();
    const watch = await deps.repository.getByChannel(input.channelId);
    if (!watch || watch.status !== 'active' || (watch.channelTokenHash ? watch.channelTokenHash !== tokenHash(input.channelToken) : watch.channelToken !== input.channelToken) || watch.resourceId !== input.resourceId || Date.parse(watch.expiration) <= now()) throw new CalendarWatchValidationError();
    return watch;
  }

  return { ensure, renew, scheduleRenewal, validateNotification };
}

export type CalendarWatchService = ReturnType<typeof createCalendarWatchService>;
