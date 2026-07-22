import { z } from 'zod';

const boundedText = (max: number) => z.string().trim().min(1).max(max);
const confidence = z.number().finite().min(0).max(1);

const questionSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  text: boundedText(500),
  field: z.string().regex(/^[a-zA-Z0-9_.\[\]-]{1,120}$/),
}).strict();

const taskSchema = z.object({
  title: boundedText(500),
  description: z.string().trim().max(2_000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  estimatedMinutes: z.number().int().positive().max(1_440),
  deadline: z.string().datetime({ offset: true }).nullable(),
  energy: z.enum(['low', 'medium', 'high']),
  confidence,
}).strict();

const ideaSchema = z.object({
  text: boundedText(2_000),
  summary: z.string().trim().max(500),
  confidence,
  goalId: z.string().trim().min(1).max(128).nullable().optional(),
  projectId: z.string().trim().min(1).max(128).nullable().optional(),
}).strict();

const linkSchema = z.object({
  fromType: z.enum(['goal', 'project', 'idea', 'task', 'completed']),
  fromId: z.string().trim().min(1).max(128),
  toType: z.enum(['goal', 'project', 'idea', 'task', 'completed']),
  toId: z.string().trim().min(1).max(128),
  confidence,
  rationale: z.string().trim().max(1_000).optional(),
}).strict();

export const analysisSchema = z.object({
  summary: boundedText(2_000),
  confidence,
  questions: z.array(questionSchema).max(1),
  tasks: z.array(taskSchema).max(50),
  ideas: z.array(ideaSchema).max(50),
  context: z.array(z.string().trim().min(1).max(500)).max(20),
  goal: z.object({ title: boundedText(500), confidence }).strict().optional(),
  project: z.object({ title: boundedText(500), confidence }).strict().optional(),
  links: z.array(linkSchema).max(100).optional(),
}).strict();

export type BrainDumpAnalysis = z.infer<typeof analysisSchema>;
export type ClarificationQuestion = BrainDumpAnalysis['questions'][number];
