import type { VerifiedUser } from '../../auth/verifyPocketBaseToken.js';
import type { TelegramClient } from '../../integrations/telegram/telegramClient.js';
import type { PocketBaseClient, PocketBaseRecord } from '../../pocketbase/client.js';
import { RepositoryError } from '../../repositories/base.js';
import type { JobHandler } from '../jobs/jobRunner.js';
import type { JobRecord } from '../jobs/jobRepository.js';
import { localDate, notificationKey, shouldSendNotification, type NotificationPreferences, type NotificationType } from './notificationPolicy.js';
import { eveningReviewTemplate, morningPlanTemplate, overdueTemplate, rescheduleTemplate, taskReminderTemplate } from './telegramTemplates.uk.js';

export type NotificationJobPayload = {
  type: NotificationType;
  recipientId: string;
  chatId: string;
  timezone: string;
  preferences: NotificationPreferences;
  taskId?: string;
  taskVersion?: string | number;
  title?: string;
  time?: string;
  date?: string;
  tasks?: Array<{ title: string; time?: string }>;
  completed?: number;
  remaining?: number;
  count?: number;
  changeSetId?: string;
  critical?: boolean;
};

export interface NotificationClaimStore {
  claim(key: string): Promise<boolean>;
  release?(key: string): Promise<void>;
}

export function createMemoryNotificationClaimStore(): NotificationClaimStore {
  const claimed = new Set<string>();
  return { async claim(key) { if (claimed.has(key)) return false; claimed.add(key); return true; }, async release(key) { claimed.delete(key); } };
}

/** Durable unique-key claim used by the VPS worker; duplicate creates are safe no-ops. */
export function createPocketBaseNotificationClaimStore(client: PocketBaseClient): NotificationClaimStore {
  return {
    async claim(key) {
      try { await client.create('notification_claims', { notificationKey: key, claimedAt: new Date().toISOString() }); return true; }
      catch {
        try {
          const rows = await client.list<PocketBaseRecord & { notificationKey?: string }>('notification_claims', `notificationKey = '${key.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`);
          if (rows.some((row) => row.notificationKey === key)) return false;
        } catch { throw new RepositoryError('UNAVAILABLE'); }
        throw new RepositoryError('UNAVAILABLE');
      }
    },
    async release(key) {
      const rows = await client.list<PocketBaseRecord & { notificationKey?: string }>('notification_claims', `notificationKey = '${key.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`);
      const claim = rows.find((row) => row.notificationKey === key);
      if (claim) await client.delete('notification_claims', claim.id);
    },
  };
}

function messageFor(payload: NotificationJobPayload) {
  switch (payload.type) {
    case 'morning_plan': return morningPlanTemplate({ date: payload.date ?? localDate(new Date(), payload.timezone), tasks: payload.tasks ?? [] });
    case 'evening_review': return eveningReviewTemplate({ date: payload.date ?? localDate(new Date(), payload.timezone), completed: payload.completed ?? 0, remaining: payload.remaining ?? 0 });
    case 'task_reminder': return taskReminderTemplate({ title: payload.title ?? 'Задача', time: payload.time });
    case 'overdue': return overdueTemplate({ title: payload.title ?? 'Задача' });
    case 'reschedule': return rescheduleTemplate({ count: payload.count ?? 0, changeSetId: payload.changeSetId ?? 'latest' });
    case 'system': return { text: payload.title ?? 'Є важливе оновлення від Вектора.' };
  }
}

export function createTelegramNotificationJobHandler(deps: {
  telegram: Pick<TelegramClient, 'sendMessage'>;
  claims: NotificationClaimStore;
  now?: () => Date;
}): JobHandler {
  const now = deps.now ?? (() => new Date());
  return async (job: JobRecord) => {
    const raw = job.payloadJson && typeof job.payloadJson === 'object' ? job.payloadJson as Record<string, unknown> : {};
    const payload = raw as unknown as NotificationJobPayload;
    if (!payload.chatId || !payload.recipientId || !payload.type || !payload.timezone) throw new Error('NOTIFICATION_PAYLOAD_INVALID');
    const at = now();
    const decision = shouldSendNotification({ type: payload.type, recipientId: payload.recipientId, at, preferences: payload.preferences, critical: payload.critical, taskId: payload.taskId, taskVersion: payload.taskVersion, localDate: payload.date });
    if (!decision.allowed) return;
    const key = notificationKey({ type: payload.type, recipientId: payload.recipientId, taskId: payload.taskId, taskVersion: payload.taskVersion, localDate: payload.date ?? localDate(at, payload.timezone) });
    if (!await deps.claims.claim(key)) return;
    try { await deps.telegram.sendMessage(payload.chatId, messageFor(payload).text, { inlineKeyboard: messageFor(payload).inlineKeyboard }); }
    catch (error) { if (deps.claims.release) await deps.claims.release(key); throw error; }
  };
}

export const createNotificationJobHandler = createTelegramNotificationJobHandler;

export function notificationJobIdempotencyKey(payload: Pick<NotificationJobPayload, 'type' | 'recipientId' | 'taskId' | 'taskVersion' | 'date'>): string {
  return notificationKey(payload);
}

export function notificationUser(user: VerifiedUser, payload: NotificationJobPayload): NotificationJobPayload & { userId: string } {
  return { ...payload, recipientId: payload.recipientId || user.userId, userId: user.userId };
}
