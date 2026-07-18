import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { BusySlotService } from './busySlotService.js';
import type { CalendarEventService } from './calendarEventService.js';

const dateSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict();
const syncBodySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), timezone: z.string().min(1).max(80), workHours: z.object({ start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }).optional() }).strict();
const slotSchema = z.object({ id: z.string().min(1).max(160), title: z.literal('Зайнято'), start: z.string().datetime({ offset: true }), end: z.string().datetime({ offset: true }), locked: z.literal(true) }).strict();
const calendarResponseSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), slots: z.array(slotSchema).max(100), syncedAt: z.string().datetime({ offset: true }).nullable(), stale: z.boolean(), warning: z.string().max(500).optional() }).strict();

export async function calendarRoutes(app: FastifyInstance, service: BusySlotService, eventService?: CalendarEventService): Promise<void> {
  const auth = { preHandler: (request: FastifyRequest, reply: FastifyReply) => app.requireUser(request, reply) };
  app.post('/api/v1/calendar/sync', auth, async (request: FastifyRequest<{ Body: unknown }>, reply) => {
    const parsed = syncBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_CALENDAR_REQUEST' });
    try { return reply.code(200).send(calendarResponseSchema.parse(await service.sync(request.user, parsed.data.date, { timezone: parsed.data.timezone, workHours: parsed.data.workHours }))); }
    catch { return reply.code(503).send({ error: 'CALENDAR_UNAVAILABLE', retryable: true }); }
  });
  app.get('/api/v1/calendar/day', auth, async (request: FastifyRequest<{ Querystring: unknown }>, reply) => {
    const parsed = dateSchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_QUERY' });
    try { return reply.code(200).send(calendarResponseSchema.parse(await service.day(request.user, parsed.data.date))); }
    catch { return reply.code(503).send({ error: 'CALENDAR_UNAVAILABLE', retryable: true }); }
  });
  if (eventService) app.post('/api/v1/tasks/:id/calendar-sync', auth, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try { return reply.code(200).send(await eventService.syncTask(request.user, request.params.id)); }
    catch { return reply.code(503).send({ error: 'CALENDAR_UNAVAILABLE', retryable: true }); }
  });
}
