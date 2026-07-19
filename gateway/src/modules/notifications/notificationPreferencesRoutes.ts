import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { PocketBaseClient, PocketBaseRecord } from '../../pocketbase/client.js';

const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const preferencesSchema = z.object({ timezone: z.string().trim().min(1).max(80), quietStart: clock, quietEnd: clock, remindersEnabled: z.boolean(), morningPlanEnabled: z.boolean(), eveningReviewEnabled: z.boolean() }).strict();
type Preferences = z.infer<typeof preferencesSchema>;
type Record = PocketBaseRecord & Preferences & { user: string };
const defaults: Preferences = { timezone: 'Europe/Warsaw', quietStart: '21:00', quietEnd: '08:00', remindersEnabled: true, morningPlanEnabled: true, eveningReviewEnabled: true };
const esc = (value: string) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");

export function createNotificationPreferencesService(client: PocketBaseClient) {
  return {
    async get(userId: string): Promise<Preferences> {
      const rows = await client.list<Record>('notification_preferences', `user = '${esc(userId)}'`);
      const row = rows.find((item) => item.user === userId);
      return row ? preferencesSchema.parse(row) : defaults;
    },
    async save(userId: string, input: unknown): Promise<Preferences> {
      const parsed = preferencesSchema.parse(input);
      const rows = await client.list<Record>('notification_preferences', `user = '${esc(userId)}'`);
      const existing = rows.find((item) => item.user === userId);
      if (existing) await client.update('notification_preferences', existing.id, { ...parsed, user: userId });
      else await client.create('notification_preferences', { ...parsed, user: userId });
      return parsed;
    },
  };
}

export async function notificationPreferencesRoutes(app: FastifyInstance, service: ReturnType<typeof createNotificationPreferencesService>): Promise<void> {
  const auth = { preHandler: (request: FastifyRequest, reply: FastifyReply) => app.requireUser(request, reply) };
  app.get('/api/v1/settings/notifications', auth, async (request, reply) => {
    try { return reply.send(await service.get(request.user.userId)); } catch { return reply.code(503).send({ error: 'SETTINGS_UNAVAILABLE', retryable: true }); }
  });
  app.patch('/api/v1/settings/notifications', auth, async (request, reply) => {
    const parsed = preferencesSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_NOTIFICATION_SETTINGS' });
    try { return reply.send(await service.save(request.user.userId, parsed.data)); } catch { return reply.code(503).send({ error: 'SETTINGS_UNAVAILABLE', retryable: true }); }
  });
}

