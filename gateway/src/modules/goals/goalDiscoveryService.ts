import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { VerifiedUser } from '../../auth/verifyPocketBaseToken.js';
import type { PocketBaseClient, PocketBaseRecord } from '../../pocketbase/client.js';
import { createOwned, listOwned, owned, updateOwned } from '../../repositories/base.js';
import { RepositoryError } from '../../repositories/base.js';

const questionSchema = z.object({ id: z.string().trim().min(1).max(64), prompt: z.string().trim().min(1).max(500), maxLength: z.number().int().min(1).max(2_000) }).strict();
const protocolSchema = z.object({
  version: z.string().trim().regex(/^goal-discovery\.v\d+$/), enabled: z.literal(true), title: z.string().trim().min(1).max(200),
  maxQuestions: z.number().int().min(1).max(3), questions: z.array(questionSchema).min(1).max(3),
  completion: z.object({ minimumAnswers: z.number().int().min(1).max(3), maximumAnswers: z.number().int().min(1).max(3) }).strict(),
  output: z.object({ titleMaxLength: z.number().int().min(40).max(500), rationaleMaxLength: z.number().int().min(80).max(2_000), confidenceMin: z.literal(0), confidenceMax: z.literal(1) }).strict(),
  safety: z.object({ notice: z.string().trim().min(1).max(500), disallowedClaims: z.array(z.string().trim().min(1).max(100)).min(1).max(20) }).strict(),
}).strict().superRefine((p, ctx) => {
  if (p.questions.length > p.maxQuestions || p.completion.maximumAnswers > p.maxQuestions || p.completion.minimumAnswers > p.completion.maximumAnswers) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid question bounds' });
  if (new Set(p.questions.map((q) => q.id)).size !== p.questions.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Question ids must be unique' });
});
export type GoalDiscoveryProtocol = z.infer<typeof protocolSchema>;
export type GoalDiscoveryAnswer = { id: string; text: string };
export type GoalDiscoverySuggestion = { title: string; rationale: string; confidence: number; safetyNotice: string; editable: true };
export type GoalDiscoverySessionRecord = PocketBaseRecord & { user?: string; protocolVersion?: string; status?: 'active' | 'completed' | 'skipped'; answersJson?: unknown; suggestionJson?: unknown; startedAt?: string; completedAt?: string | null };
export interface GoalDiscoveryRepository {
  create(user: VerifiedUser, input: Record<string, unknown>): Promise<GoalDiscoverySessionRecord>;
  get(user: VerifiedUser, id: string): Promise<GoalDiscoverySessionRecord | null>;
  update(user: VerifiedUser, id: string, input: Record<string, unknown>): Promise<GoalDiscoverySessionRecord>;
  list(user: VerifiedUser): Promise<GoalDiscoverySessionRecord[]>;
}
export function createGoalDiscoveryRepository(client: PocketBaseClient): GoalDiscoveryRepository {
  return {
    create: (user, input) => createOwned<GoalDiscoverySessionRecord>(client, 'goal_discovery_sessions', user, input),
    get: (user, id) => owned<GoalDiscoverySessionRecord>(client, 'goal_discovery_sessions', user, id),
    update: (user, id, input) => updateOwned<GoalDiscoverySessionRecord>(client, 'goal_discovery_sessions', user, id, input),
    list: (user) => listOwned<GoalDiscoverySessionRecord>(client, 'goal_discovery_sessions', user),
  };
}
export interface GoalDiscoveryAiClient { readonly model?: string; complete(input: { questions: Array<{ prompt: string; answer: string }> }): Promise<unknown>; }
export class GoalDiscoveryDisabledError extends Error { readonly code = 'DISABLED'; }
export class GoalDiscoveryNotFoundError extends Error { readonly code = 'NOT_FOUND'; }
export class GoalDiscoveryValidationError extends Error { readonly code = 'INVALID_GOAL_DISCOVERY'; }
export class GoalDiscoveryConflictError extends Error { readonly code = 'CONFLICT'; }

const suggestionSchema = z.object({ title: z.string().trim().min(3).max(500), rationale: z.string().trim().min(3).max(2_000), confidence: z.number().min(0).max(1), safetyNotice: z.string().optional(), editable: z.literal(true).optional() }).strict();
const unsafe = (value: string, protocol: GoalDiscoveryProtocol) => protocol.safety.disallowedClaims.some((term) => value.toLocaleLowerCase('uk-UA').includes(term.toLocaleLowerCase('uk-UA')));
const publicSession = (record: GoalDiscoverySessionRecord, protocol: GoalDiscoveryProtocol) => ({ id: record.id, status: record.status ?? 'active', protocolVersion: record.protocolVersion, questions: protocol.questions, answers: Array.isArray(record.answersJson) ? record.answersJson : [], suggestion: suggestionSchema.safeParse(record.suggestionJson).success ? record.suggestionJson : null, safetyNotice: protocol.safety.notice, editable: true });
const protocolFromFile = (): unknown => { try { return JSON.parse(readFileSync(new URL('../ai/prompts/goalDiscovery.protocol.json', import.meta.url), 'utf8')); } catch { return null; } };
export function loadGoalDiscoveryProtocol(raw: unknown = protocolFromFile()): GoalDiscoveryProtocol | null { const parsed = protocolSchema.safeParse(raw); return parsed.success ? parsed.data : null; }

export interface GoalDiscoveryService {
  readonly enabled: boolean;
  protocol(): { enabled: boolean; protocol?: GoalDiscoveryProtocol; safetyNotice?: string };
  start(user: VerifiedUser): Promise<ReturnType<typeof publicSession>>;
  get(user: VerifiedUser, id: string): Promise<ReturnType<typeof publicSession>>;
  answer(user: VerifiedUser, id: string, input: unknown): Promise<ReturnType<typeof publicSession>>;
  complete(user: VerifiedUser, id: string, input?: unknown): Promise<ReturnType<typeof publicSession>>;
  edit(user: VerifiedUser, id: string, input: unknown): Promise<ReturnType<typeof publicSession>>;
  skip(user: VerifiedUser, id: string): Promise<ReturnType<typeof publicSession>>;
}

export function createGoalDiscoveryService(deps: { repository: GoalDiscoveryRepository; protocol?: unknown; aiClient?: GoalDiscoveryAiClient; now?: () => string }): GoalDiscoveryService {
  const protocol = loadGoalDiscoveryProtocol(deps.protocol);
  const now = deps.now ?? (() => new Date().toISOString());
  const requireEnabled = () => { if (!protocol) throw new GoalDiscoveryDisabledError(); return protocol; };
  const requireSession = async (user: VerifiedUser, id: string) => { const record = await deps.repository.get(user, id); if (!record || record.user !== user.userId) throw new GoalDiscoveryNotFoundError(); return record; };
  const safeAnswers = (value: unknown, p: GoalDiscoveryProtocol, existing: GoalDiscoveryAnswer[] = []): GoalDiscoveryAnswer[] => {
    const schema = z.array(z.object({ id: z.string().trim().min(1).max(64), text: z.string().trim().min(1).max(2_000) }).strict()).max(p.completion.maximumAnswers);
    const candidate = Array.isArray(value) ? value : value && typeof value === 'object' && Array.isArray((value as { answers?: unknown }).answers) ? (value as { answers: unknown[] }).answers : value;
    const parsed = schema.safeParse(candidate); if (!parsed.success) throw new GoalDiscoveryValidationError();
    const answers = [...existing];
    for (const item of parsed.data) { const question = p.questions.find((q) => q.id === item.id); if (!question || item.text.length > question.maxLength) throw new GoalDiscoveryValidationError(); const index = answers.findIndex((a) => a.id === item.id); if (index >= 0) answers[index] = item; else answers.push(item); }
    if (answers.length > p.completion.maximumAnswers) throw new GoalDiscoveryValidationError(); return answers;
  };
  const fallback = (answers: GoalDiscoveryAnswer[], p: GoalDiscoveryProtocol): GoalDiscoverySuggestion => {
    const result = answers.find((a) => a.id === 'result')?.text || answers[0]?.text || 'Сформувати один важливий результат';
    const title = result.replace(/[.!?]+$/g, '').trim().slice(0, p.output.titleMaxLength);
    const safeTitle = title && !unsafe(title, p) ? title : 'Сформувати один важливий результат';
    return { title: safeTitle, rationale: 'Це чернетка мети на основі твоїх відповідей. Її можна змінити перед збереженням.', confidence: Math.min(0.85, 0.45 + answers.length * 0.15), safetyNotice: p.safety.notice, editable: true };
  };
  const finish = async (user: VerifiedUser, record: GoalDiscoverySessionRecord, answers: GoalDiscoveryAnswer[], p: GoalDiscoveryProtocol) => {
    let suggestion = fallback(answers, p);
    if (deps.aiClient) { try { const raw = await deps.aiClient.complete({ questions: answers.map((a) => ({ prompt: p.questions.find((q) => q.id === a.id)?.prompt ?? '', answer: a.text })) }); const parsed = suggestionSchema.safeParse(raw); if (parsed.success && !unsafe(`${parsed.data.title} ${parsed.data.rationale}`, p)) suggestion = { ...parsed.data, safetyNotice: p.safety.notice, editable: true }; } catch { /* deterministic safe fallback */ } }
    return deps.repository.update(user, record.id, { status: 'completed', answersJson: answers, suggestionJson: suggestion, completedAt: now() });
  };
  return {
    enabled: Boolean(protocol), protocol: () => protocol ? { enabled: true, protocol, safetyNotice: protocol.safety.notice } : { enabled: false },
    async start(user) { const p = requireEnabled(); const record = await deps.repository.create(user, { protocolVersion: p.version, status: 'active', answersJson: [], suggestionJson: null, startedAt: now(), completedAt: null }); return publicSession(record, p); },
    async get(user, id) { const p = requireEnabled(); return publicSession(await requireSession(user, id), p); },
    async answer(user, id, input) { const p = requireEnabled(); const record = await requireSession(user, id); if (record.status === 'skipped') throw new GoalDiscoveryConflictError(); const existing = Array.isArray(record.answersJson) ? record.answersJson as GoalDiscoveryAnswer[] : []; const answers = safeAnswers(input, p, existing); if (answers.length < p.completion.minimumAnswers) return publicSession(await deps.repository.update(user, id, { answersJson: answers }), p); const updated = await finish(user, record, answers, p); return publicSession(updated, p); },
    async complete(user, id, input) { const p = requireEnabled(); const record = await requireSession(user, id); if (record.status === 'skipped') throw new GoalDiscoveryConflictError(); const answers = input === undefined ? safeAnswers(record.answersJson ?? [], p) : safeAnswers(input, p, Array.isArray(record.answersJson) ? record.answersJson as GoalDiscoveryAnswer[] : []); if (answers.length < p.completion.minimumAnswers) throw new GoalDiscoveryValidationError(); return publicSession(await finish(user, record, answers, p), p); },
    async edit(user, id, input) { const p = requireEnabled(); const record = await requireSession(user, id); if (record.status !== 'completed') throw new GoalDiscoveryConflictError(); const parsed = z.object({ title: z.string().trim().min(3).max(p.output.titleMaxLength), rationale: z.string().trim().min(3).max(p.output.rationaleMaxLength) }).strict().safeParse(input); if (!parsed.success || unsafe(`${parsed.data?.title ?? ''} ${parsed.data?.rationale ?? ''}`, p)) throw new GoalDiscoveryValidationError(); const suggestion = { ...(suggestionSchema.parse(record.suggestionJson)), ...parsed.data, safetyNotice: p.safety.notice, editable: true } as GoalDiscoverySuggestion; return publicSession(await deps.repository.update(user, id, { suggestionJson: suggestion }), p); },
    async skip(user, id) { const p = requireEnabled(); const record = await requireSession(user, id); return publicSession(await deps.repository.update(user, id, { status: 'skipped', completedAt: now() }), p); },
  };
}
