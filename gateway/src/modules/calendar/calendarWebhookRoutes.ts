import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { CalendarWatchService } from '../../integrations/google/calendarWatch.js';
import type { JobRepository } from '../jobs/jobRepository.js';

type GoogleHeaders = {
  'x-goog-channel-id'?: string;
  'x-goog-channel-token'?: string;
  'x-goog-resource-id'?: string;
  'x-goog-resource-state'?: string;
  'x-goog-message-number'?: string;
};

const header = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const validMessage = (value: string | undefined) => Boolean(value && /^[0-9]{1,40}$/.test(value));
const notificationHeaders = z.object({ channelId: z.string().min(1).max(500), channelToken: z.string().min(1).max(500), resourceId: z.string().min(1).max(500), state: z.enum(['sync', 'exists', 'update', 'not_exists']), messageNumber: z.string().regex(/^[0-9]{1,40}$/) }).strict();

/** Google sends notifications without a user token. The persisted channel is the only source of ownership. */
export async function calendarWebhookRoutes(app: FastifyInstance, deps: {
  watchService: Pick<CalendarWatchService, 'validateNotification'>;
  jobRepository: Pick<JobRepository, 'getByIdempotencyKey' | 'create'>;
}): Promise<void> {
  app.post('/webhooks/google/calendar', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (request: FastifyRequest, reply: FastifyReply) => {
    const headers = request.headers as GoogleHeaders;
    const channelId = header(headers['x-goog-channel-id']);
    const channelToken = header(headers['x-goog-channel-token']);
    const resourceId = header(headers['x-goog-resource-id']);
    const state = header(headers['x-goog-resource-state']);
    const messageNumber = header(headers['x-goog-message-number']);
    const parsed = notificationHeaders.safeParse({ channelId, channelToken, resourceId, state, messageNumber });
    if (!parsed.success || (request.body !== undefined && request.body !== null)) return reply.code(400).send({ error: 'INVALID_CALENDAR_NOTIFICATION' });
    let watch;
    try { watch = await deps.watchService.validateNotification({ channelId, channelToken, resourceId }); }
    catch { return reply.code(401).send({ error: 'INVALID_CALENDAR_NOTIFICATION' }); }
    const notificationKey = `calendar.reconcile:${watch.user}:${watch.calendarId}:${channelId}:${resourceId}:${messageNumber}`;
    const user = { userId: watch.user, email: '' };
    if (await deps.jobRepository.getByIdempotencyKey(user, notificationKey)) return reply.code(204).send();
    try {
      await deps.jobRepository.create(user, {
        type: 'calendar.reconcile', idempotencyKey: notificationKey,
        payloadJson: { watchId: watch.id, userId: watch.user, calendarId: watch.calendarId, resourceId, channelId, state, messageNumber },
        status: 'pending', attempts: 0, nextRunAt: new Date().toISOString(),
      });
    } catch {
      // Duplicate delivery racing another webhook request is still acknowledged.
    }
    return reply.code(204).send();
  });
}
