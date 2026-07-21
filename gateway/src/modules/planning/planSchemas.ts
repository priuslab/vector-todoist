import { z } from 'zod';

const iso = z.string().datetime({ offset: true });
const boundedId = z.string().trim().min(1).max(128);
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
  goalId: boundedId.optional(),
  calendarDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  confirmCalendarConflicts: z.boolean().optional(),
}).strict();
export const applyBodySchema = z.object({ idempotencyKey: z.string().min(8).max(255).optional(), confirmCalendarConflicts: z.boolean().optional() }).strict().default({});
export const todayQuerySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), timezone: z.string().min(1).max(80).default('Europe/Warsaw') }).strict();

export const proposalTaskSchema = z.object({
  id: z.string().min(1), title: z.string().min(1).max(500), description: z.string().max(10_000), status: z.enum(['inbox', 'scheduled']), priority: z.enum(['low', 'medium', 'high', 'urgent']),
  deadline: iso.nullable(), plannedStart: iso.nullable(), plannedEnd: iso.nullable(), estimatedMinutes: z.number().int().positive().max(1440), energy: z.enum(['low', 'medium', 'high']), flexible: z.boolean(), locked: z.boolean(), sourceDump: boundedId, goalId: boundedId.nullable().default(null),
}).strict();
export const proposalIdeaSchema = z.object({ id: z.string().min(1), text: z.string().min(1).max(20_000), summary: z.string().max(2_000), status: z.literal('backlog'), sourceDump: boundedId, goalId: boundedId.nullable().default(null) }).strict();
const planBlockSchema = z.object({ id: z.string(), kind: z.enum(['busy', 'task', 'break']), title: z.string(), start: iso, end: iso, locked: z.boolean(), taskId: z.string().optional() });
const planWarningSchema = z.object({ code: z.string(), message: z.string(), taskId: z.string().optional() });
const planReasonsSchema = z.record(z.string(), z.array(z.object({ code: z.string(), message: z.string() })));
const persistedPreviewSchema = z.object({ blocks: z.array(planBlockSchema), unscheduledTaskIds: z.array(z.string()), warnings: z.array(planWarningSchema), reasons: planReasonsSchema }).strict();

export function normalizeLegacyPlanChangeSetPayload(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Object.prototype.hasOwnProperty.call(value, 'dumpId')) return value;
  const payload = value as { tasks?: unknown; ideas?: unknown };
  if (Object.prototype.hasOwnProperty.call(payload, 'goalId') || !Array.isArray(payload.tasks) || !Array.isArray(payload.ideas)) return value;
  const sourceDumps = [...payload.tasks, ...payload.ideas].map((proposal) => {
    if (!proposal || typeof proposal !== 'object') return null;
    if (Object.prototype.hasOwnProperty.call(proposal, 'goalId')) return null;
    const parsed = boundedId.safeParse((proposal as { sourceDump?: unknown }).sourceDump);
    return parsed.success ? parsed.data : null;
  });
  if (!sourceDumps.length || sourceDumps.some((sourceDump) => sourceDump === null) || new Set(sourceDumps).size !== 1) return value;
  return { ...payload, dumpId: sourceDumps[0] };
}

export const planChangeSetPayloadSchema = z.object({
  dumpId: boundedId,
  goalId: boundedId.nullable().default(null),
  tasks: z.array(proposalTaskSchema),
  ideas: z.array(proposalIdeaSchema),
  preview: persistedPreviewSchema.optional(),
  calendarStale: z.boolean().optional(),
  appliedTaskIds: z.array(z.string().min(1)).optional(),
  appliedIdeaIds: z.array(z.string().min(1)).optional(),
  appliedEdgeIds: z.array(z.string().min(1)).optional(),
}).strict().superRefine((payload, context) => {
  for (const [collection, proposals] of [['tasks', payload.tasks], ['ideas', payload.ideas]] as const) {
    proposals.forEach((proposal, index) => {
      if (proposal.sourceDump !== payload.dumpId) context.addIssue({ code: 'custom', path: [collection, index, 'sourceDump'], message: 'Proposal sourceDump must match dumpId' });
      if (proposal.goalId !== payload.goalId) context.addIssue({ code: 'custom', path: [collection, index, 'goalId'], message: 'Proposal goalId must match goalId' });
    });
  }
});
export const draftResponseShape = z.object({ id: z.string(), text: z.string(), status: z.string().optional(), source: z.string().optional(), kind: z.string().optional(), created: z.string().optional() }).strict();
export const planPreviewSchema = z.object({
  changeSetId: z.string().min(1), tasks: z.array(proposalTaskSchema), ideas: z.array(proposalIdeaSchema), blocks: z.array(planBlockSchema), unscheduledTaskIds: z.array(z.string()), warnings: z.array(planWarningSchema), reasons: planReasonsSchema,
}).strict();
const taskResponseShape = z.object({ id: z.string(), title: z.string().optional(), description: z.string().optional(), status: z.string().optional(), priority: z.string().optional(), deadline: z.string().nullable().optional(), plannedStart: z.string().nullable().optional(), plannedEnd: z.string().nullable().optional(), estimatedMinutes: z.number().optional(), actualMinutes: z.number().optional(), energy: z.string().optional(), flexible: z.boolean().optional(), locked: z.boolean().optional(), sourceDump: z.string().optional(), goalId: z.string().nullable().optional(), rescheduleCount: z.number().optional() }).strict();
export const ideaResponseShape = z.object({ id: z.string(), text: z.string().optional(), summary: z.string().optional(), status: z.string().optional(), sourceDump: z.string().optional(), goalId: z.string().nullable().optional() }).strict();
export const applyResponseSchema = z.object({ changeSet: z.object({ id: z.string(), status: z.string(), kind: z.string().optional(), idempotencyKey: z.string().optional(), beforeJson: z.unknown().optional(), afterJson: z.unknown().optional() }).passthrough(), tasks: z.array(taskResponseShape), ideas: z.array(ideaResponseShape) }).strict();
export const todayResponseSchema = z.object({ date: z.string(), timezone: z.string(), tasks: z.array(taskResponseShape), blocks: z.array(taskResponseShape), warnings: z.array(z.unknown()) }).strict();
export const inboxResponseSchema = z.object({ ideas: z.array(ideaResponseShape), tasks: z.array(taskResponseShape), drafts: z.array(draftResponseShape) }).strict();
export const taskResponseSchema = taskResponseShape;
export type TaskResponse = z.infer<typeof taskResponseShape>;
export type IdeaResponse = z.infer<typeof ideaResponseShape>;
export type DraftResponse = z.infer<typeof draftResponseShape>;
export type ChangeSetResponse = z.infer<typeof applyResponseSchema>['changeSet'];
export type PlanPreviewBody = z.infer<typeof planPreviewBodySchema>;
export type PlanPreview = z.infer<typeof planPreviewSchema>;
export type PlanChangeSetPayload = z.infer<typeof planChangeSetPayloadSchema>;
