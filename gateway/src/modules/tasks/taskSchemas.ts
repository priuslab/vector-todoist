import { z } from 'zod';

const iso = z.string().datetime({ offset: true });
const editable = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(10_000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  deadline: iso.nullable().optional(),
  estimatedMinutes: z.number().int().min(1).max(1_440).optional(),
  energy: z.enum(['low', 'medium', 'high']).nullable().optional(),
  flexible: z.boolean().optional(),
  plannedStart: iso.nullable().optional(),
  plannedEnd: iso.nullable().optional(),
}).strict();

export const taskPatchSchema = editable.extend({
  expectedVersion: z.number().int().min(0).optional(),
  idempotencyKey: z.string().trim().min(8).max(255).optional(),
}).strict().refine((body) => Object.keys(body).some((key) => !['expectedVersion', 'idempotencyKey'].includes(key)), { message: 'At least one editable field is required' });

export const completeTaskSchema = z.object({
  expectedVersion: z.number().int().min(0).optional(),
  idempotencyKey: z.string().trim().min(8).max(255).optional(),
}).strict();

export const undoChangeSetSchema = z.object({ idempotencyKey: z.string().trim().min(8).max(255).optional() }).strict();

export const taskResponseSchema = z.object({
  id: z.string().min(1), title: z.string(), description: z.string().optional(), status: z.string(),
  priority: z.string(), deadline: z.string().nullable().optional(), plannedStart: z.string().nullable().optional(),
  plannedEnd: z.string().nullable().optional(), estimatedMinutes: z.number().int().nullable().optional(),
  actualMinutes: z.number().int().nullable().optional(), energy: z.string().nullable().optional(), flexible: z.boolean().optional(),
  locked: z.boolean().optional(), sourceDump: z.string().nullable().optional(), rescheduleCount: z.number().int().optional(),
  completedAt: z.string().nullable().optional(), version: z.union([z.string(), z.number()]).optional(),
  syncStatus: z.enum(['synced', 'sync_pending', 'attention', 'unscheduled']).optional(), calendarEventId: z.string().nullable().optional(),
}).strict();

export const changeSetResponseSchema = z.object({ id: z.string(), kind: z.string(), status: z.string(), taskId: z.string().optional() }).strict();
export type TaskPatch = z.infer<typeof editable>;
