import type { VerifiedUser } from '../../auth/verifyPocketBaseToken.js';
import type { BrainDumpRepository } from '../../repositories/brainDumpRepository.js';
import type { PocketBaseClient } from '../../pocketbase/client.js';
import { createOwned, listOwned } from '../../repositories/base.js';
import type { PocketBaseRecord } from '../../pocketbase/client.js';
import { analysisSchema, type BrainDumpAnalysis, type ClarificationQuestion } from './analysisSchema.js';
import { ANALYSIS_PROMPT_VERSION } from './prompts/analyzeBrainDump.v1.js';
import type { AnalysisAiClient, AiCompletionInput } from './geminiClient.js';

export type AnalysisSessionRecord = PocketBaseRecord & { user?: string; brainDump?: string; model?: string; promptVersion?: string; confidence?: number; resultJson?: unknown; questionsJson?: unknown; errorCode?: string };
export type AnalysisSessionInput = Omit<Partial<AnalysisSessionRecord>, 'id' | 'user'> & { user?: never };
export interface AnalysisSessionRepository {
  create(user: VerifiedUser, input: AnalysisSessionInput): Promise<AnalysisSessionRecord>;
  listForDump(user: VerifiedUser, brainDumpId: string): Promise<AnalysisSessionRecord[]>;
}

export function createAnalysisSessionRepository(client: PocketBaseClient): AnalysisSessionRepository {
  return {
    create: (user, input) => createOwned<AnalysisSessionRecord>(client, 'ai_sessions', user, input),
    listForDump: async (user, brainDumpId) => (await listOwned<AnalysisSessionRecord>(client, 'ai_sessions', user)).filter((record) => record.brainDump === brainDumpId),
  };
}

export class AnalysisNotFoundError extends Error { readonly code = 'NOT_FOUND'; }
export class AnalysisValidationError extends Error { readonly code = 'NEEDS_ATTENTION'; }
export class AiRetryableError extends Error {
  readonly code = 'AI_UNAVAILABLE';
  constructor(options?: { cause?: unknown }) { super('AI analysis unavailable', options); }
}
export class AnalysisAnswersError extends Error { readonly code = 'INVALID_ANSWERS'; }

export type AnalysisResult = { id: string; status: 'classified' | 'needs_clarification' | 'needs_attention'; analysis: BrainDumpAnalysis };

export interface AnalysisService {
  analyze(user: VerifiedUser, brainDumpId: string, answers?: Array<{ id: string; text: string }>): Promise<AnalysisResult>;
  answer(user: VerifiedUser, brainDumpId: string, answers: unknown): Promise<AnalysisResult>;
  result(user: VerifiedUser, brainDumpId: string): Promise<AnalysisResult | null>;
}

const safeRecordResult = (record: AnalysisSessionRecord): BrainDumpAnalysis | null => {
  const parsed = analysisSchema.safeParse(record.resultJson);
  return parsed.success ? parsed.data : null;
};

export function createAnalysisService(dumpRepository: BrainDumpRepository, sessionRepository: AnalysisSessionRepository, aiClient: AnalysisAiClient): AnalysisService {
  const activeAttempts = new Map<string, Promise<AnalysisResult>>();
  async function getDump(user: VerifiedUser, id: string) {
    const dump = await dumpRepository.get(user, id);
    if (!dump || dump.user !== user.userId) throw new AnalysisNotFoundError();
    const text = String(dump.rawText ?? dump.transcript ?? '').trim();
    if (!text) throw new AnalysisValidationError();
    return { dump, text };
  }

  async function execute(user: VerifiedUser, brainDumpId: string, answers: Array<{ id: string; text: string }> = []): Promise<AnalysisResult> {
    const { text } = await getDump(user, brainDumpId);
    const prior = await sessionRepository.listForDump(user, brainDumpId);
    if (answers.length === 0) {
      const existing = prior.at(-1);
      const existingResult = existing ? safeRecordResult(existing) : null;
      if (existing?.id && existingResult) return { id: existing.id, status: existingResult.questions.length ? 'needs_clarification' : 'classified', analysis: existingResult };
    }
    const input: AiCompletionInput = { brainDumpText: text, ...(answers.length ? { answers } : {}) };
    let raw: unknown;
    try { raw = await aiClient.complete(input); } catch (error) { await dumpRepository.update(user, brainDumpId, { status: 'failed', errorCode: 'AI_UNAVAILABLE' }); throw new AiRetryableError({ cause: error }); }
    let parsed = analysisSchema.safeParse(raw);
    if (!parsed.success) {
      try { raw = await aiClient.complete({ ...input, repair: true }); } catch (error) { await dumpRepository.update(user, brainDumpId, { status: 'failed', errorCode: 'AI_UNAVAILABLE' }); throw new AiRetryableError({ cause: error }); }
      parsed = analysisSchema.safeParse(raw);
    }
    if (!parsed.success) {
      await dumpRepository.update(user, brainDumpId, { status: 'failed', errorCode: 'NEEDS_ATTENTION' });
      throw new AnalysisValidationError();
    }
    const analysis = parsed.data;
    const status = analysis.questions.length > 0 ? 'needs_clarification' : 'classified';
    await dumpRepository.update(user, brainDumpId, { status });
    const session = await sessionRepository.create(user, { brainDump: brainDumpId, model: aiClient.model, promptVersion: ANALYSIS_PROMPT_VERSION, confidence: analysis.confidence, resultJson: analysis, questionsJson: analysis.questions });
    return { id: session.id, status, analysis };
  }

  async function analyzeOnce(user: VerifiedUser, brainDumpId: string): Promise<AnalysisResult> {
    const key = `${user.userId}:${brainDumpId}`;
    const active = activeAttempts.get(key);
    if (active) return active;
    const attempt = execute(user, brainDumpId).finally(() => activeAttempts.delete(key));
    activeAttempts.set(key, attempt);
    return attempt;
  }

  return {
    analyze: analyzeOnce,
    async answer(user, brainDumpId, answersInput) {
      const prior = await sessionRepository.listForDump(user, brainDumpId);
      const previous = prior.at(-1);
      const previousAnalysis = previous ? safeRecordResult(previous) : null;
      if (!previousAnalysis) throw new AnalysisAnswersError();
      if (!Array.isArray(answersInput) || answersInput.length > 2) throw new AnalysisAnswersError();
      const answers = answersInput.map((item) => {
        if (!item || typeof item !== 'object') throw new AnalysisAnswersError();
        const value = item as { id?: unknown; text?: unknown };
        if (typeof value.id !== 'string' || typeof value.text !== 'string' || value.text.trim().length === 0 || value.text.length > 1_000) throw new AnalysisAnswersError();
        if (!previousAnalysis.questions.some((question) => question.id === value.id)) throw new AnalysisAnswersError();
        return { id: value.id, text: value.text.trim() };
      });
      return execute(user, brainDumpId, answers);
    },
    async result(user, brainDumpId) {
      await getDump(user, brainDumpId);
      const existing = (await sessionRepository.listForDump(user, brainDumpId)).at(-1);
      const analysis = existing ? safeRecordResult(existing) : null;
      return existing?.id && analysis ? { id: existing.id, status: analysis.questions.length ? 'needs_clarification' : 'classified', analysis } : null;
    },
  };
}
