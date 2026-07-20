import { z } from 'zod';

const iso = z.string().datetime({ offset: true });
const profile = z.object({
  timezone: z.string().min(1).max(80).default('Europe/Warsaw'),
  workHours: z.object({ start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }).default({ start: '09:00', end: '18:00' }),
  energyPeak: z.object({ start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }).default({ start: '09:30', end: '12:30' }),
  focusBlockMinutes: z.number().int().min(5).max(480).default(50),
  breakMinutes: z.number().int().min(0).max(120).default(10),
  dailyLimitMinutes: z.number().int().min(0).max(1440).default(360),
}).default({});
const busySlot = z.object({ id: z.string().min(1).max(160), title: z.string().min(1).max(500), start: iso, end: iso, locked: z.literal(true).default(true) }).strict();

export const planPreviewBodySchema = z.object({
  profile,
  busySlots: z.array(busySlot).max(100).default([]),
  now: iso.optional(),
  timezone: z.string().min(1).max(80).optional(),
  idempotencyKey: z.string().min(8).max(255).optional(),
  calendarDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  confirmCalendarConflicts: z.boolean().optional(),
}).strict();
export const applyBodySchema = z.object({ idempotencyKey: z.string().min(8).max(255).optional(), confirmCalendarConflicts: z.boolean().optional() }).strict().default({});
export const todayQuerySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), timezone: z.string().min(1).max(80).default('Europe/Warsaw') }).strict();

export const proposalTaskSchema = z.object({
  id: z.string().min(1), title: z.string().min(1).max(500), description: z.string().max(10_000), status: z.enum(['inbox', 'scheduled']), priority: z.enum(['low', 'medium', 'high', 'urgent']),
  deadline: iso.nullable(), plannedStart: iso.nullable(), plannedEnd: iso.nullable(), estimatedMinutes: z.number().int().positive().max(1440), energy: z.enum(['low', 'medium', 'high']), flexible: z.boolean(), locked: z.boolean(), sourceDump: z.string(),
});
export const proposalIdeaSchema = z.object({ id: z.string().min(1), text: z.string().min(1).max(20_000), summary: z.string().max(2_000), status: z.literal('backlog'), sourceDump: z.string() });
export const planPreviewSchema = z.object({
  changeSetId: z.string().min(1), tasks: z.array(proposalTaskSchema), ideas: z.array(proposalIdeaSchema), blocks: z.array(z.object({ id: z.string(), kind: z.enum(['busy', 'task', 'break']), title: z.string(), start: iso, end: iso, locked: z.boolean(), taskId: z.string().optional() })), unscheduledTaskIds: z.array(z.string()), warnings: z.array(z.object({ code: z.string(), message: z.string(), taskId: z.string().optional() })), reasons: z.record(z.string(), z.array(z.object({ code: z.string(), message: z.string() }))),
}).strict();
const taskResponseShape = z.object({ id: z.string(), title: z.string().optional(), description: z.string().optional(), status: z.string().optional(), priority: z.string().optional(), deadline: z.string().nullable().optional(), plannedStart: z.string().nullable().optional(), plannedEnd: z.string().nullable().optional(), estimatedMinutes: z.number().optional(), actualMinutes: z.number().optional(), energy: z.string().optional(), flexible: z.boolean().optional(), locked: z.boolean().optional(), sourceDump: z.string().optional(), rescheduleCount: z.number().optional() }).strict();
export const ideaResponseShape = z.object({ id: z.string(), text: z.string().optional(), summary: z.string().optional(), status: z.string().optional(), sourceDump: z.string().optional() }).strict();
export const applyResponseSchema = z.object({ changeSet: z.object({ id: z.string(), status: z.string(), kind: z.string().optional(), idempotencyKey: z.string().optional(), beforeJson: z.unknown().optional(), afterJson: z.unknown().optional() }).passthrough(), tasks: z.array(taskResponseShape), ideas: z.array(ideaResponseShape) }).strict();
export const todayResponseSchema = z.object({ date: z.string(), timezone: z.string(), tasks: z.array(taskResponseShape), blocks: z.array(taskResponseShape), warnings: z.array(z.unknown()) }).strict();
export const inboxResponseSchema = z.object({ ideas: z.array(ideaResponseShape), tasks: z.array(taskResponseShape) }).strict();
export const taskResponseSchema = taskResponseShape;
export type TaskResponse = z.infer<typeof taskResponseShape>;
export type IdeaResponse = z.infer<typeof ideaResponseShape>;
export type ChangeSetResponse = z.infer<typeof applyResponseSchema>['changeSet'];
export type PlanPreviewBody = z.infer<typeof planPreviewBodySchema>;
export type PlanPreview = z.infer<typeof planPreviewSchema>;
