import { describe, expect, it, vi } from 'vitest';
import clearResult from './fixtures/ai/clear-result.json' with { type: 'json' };
import lowConfidenceResult from './fixtures/ai/low-confidence-result.json' with { type: 'json' };
import invalidResult from './fixtures/ai/invalid-result.json' with { type: 'json' };
import { analysisSchema } from '../src/modules/ai/analysisSchema.js';
import { createAnalysisService, AnalysisNotFoundError, AnalysisValidationError, AnalysisAnswersError, AiRetryableError, type AnalysisAiClient, type AnalysisSessionRepository } from '../src/modules/ai/analyzeBrainDump.js';
import type { BrainDumpRepository } from '../src/repositories/brainDumpRepository.js';
import type { VerifiedUser } from '../src/auth/verifyPocketBaseToken.js';

const alice: VerifiedUser = { userId: 'alice', email: 'alice@example.test' };
const bob: VerifiedUser = { userId: 'bob', email: 'bob@example.test' };

function repos() {
  const dumps = new Map<string, any>([['dump-1', { id: 'dump-1', user: 'alice', rawText: 'Підготувати подкаст', status: 'received' }]]);
  const sessions: any[] = [];
  const dumpRepository: BrainDumpRepository = {
    create: vi.fn(), list: vi.fn(), delete: vi.fn(), update: vi.fn(async (_user, id, input) => ({ ...dumps.get(id), ...input })),
    get: vi.fn(async (user, id) => { const item = dumps.get(id); return item?.user === user.userId ? item : null; }),
  };
  const sessionRepository: AnalysisSessionRepository = {
    create: vi.fn(async (_user, input) => { const item = { id: `session-${sessions.length + 1}`, ...input }; sessions.push(item); return item; }),
    listForDump: vi.fn(async (user, dumpId) => sessions.filter((item) => item.user === user.userId && item.brainDump === dumpId)),
  };
  return { dumps, sessions, dumpRepository, sessionRepository };
}

function client(result: unknown): AnalysisAiClient {
  return { complete: vi.fn(async () => result) };
}

describe('analysisSchema', () => {
  it('accepts clear and low-confidence fixtures', () => {
    expect(analysisSchema.parse(clearResult).questions).toHaveLength(0);
    expect(analysisSchema.parse(lowConfidenceResult).questions).toHaveLength(1);
  });
  it('rejects unknown enums, unsafe confidence, invalid dates, and more than two questions', () => {
    expect(analysisSchema.safeParse(invalidResult).success).toBe(false);
    expect(analysisSchema.safeParse({ ...clearResult, tasks: [{ ...clearResult.tasks[0], priority: 'critical' }] }).success).toBe(false);
    expect(analysisSchema.safeParse({ ...clearResult, tasks: [{ ...clearResult.tasks[0], estimatedMinutes: 1.5 }] }).success).toBe(false);
    expect(analysisSchema.safeParse({ ...clearResult, tasks: [{ ...clearResult.tasks[0], deadline: 'tomorrow' }] }).success).toBe(false);
  });
});

describe('analyzeBrainDump orchestration', () => {
  it('returns a clear analysis, persists one session, updates only dump status, and never writes tasks', async () => {
    const state = repos();
    const service = createAnalysisService(state.dumpRepository, state.sessionRepository, client(clearResult));
    const result = await service.analyze(alice, 'dump-1');
    expect(result.analysis.questions).toEqual([]);
    expect(state.sessionRepository.create).toHaveBeenCalledTimes(1);
    expect(state.dumpRepository.update).toHaveBeenCalledWith(alice, 'dump-1', { status: 'classified' });
  });

  it('coalesces concurrent analyze requests into one active AI session', async () => {
    const state = repos();
    let resolve: ((value: unknown) => void) | undefined;
    const ai = { model: 'test', complete: vi.fn(() => new Promise<unknown>((done) => { resolve = done; })) };
    const service = createAnalysisService(state.dumpRepository, state.sessionRepository, ai);
    const first = service.analyze(alice, 'dump-1');
    const second = service.analyze(alice, 'dump-1');
    await vi.waitFor(() => expect(ai.complete).toHaveBeenCalled());
    resolve?.(clearResult);
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(ai.complete).toHaveBeenCalledTimes(1);
    expect(state.sessionRepository.create).toHaveBeenCalledTimes(1);
  });

  it('keeps low-confidence analyses in clarification state with at most two questions', async () => {
    const state = repos();
    const service = createAnalysisService(state.dumpRepository, state.sessionRepository, client(lowConfidenceResult));
    const result = await service.analyze(alice, 'dump-1');
    expect(result.analysis.questions).toHaveLength(1);
    expect(state.dumpRepository.update).toHaveBeenCalledWith(alice, 'dump-1', { status: 'needs_clarification' });
  });

  it('repairs one malformed model result, then marks needs_attention without persistence on a second failure', async () => {
    const state = repos();
    const ai = { complete: vi.fn().mockResolvedValueOnce(invalidResult).mockResolvedValueOnce(clearResult) };
    const service = createAnalysisService(state.dumpRepository, state.sessionRepository, ai);
    await expect(service.analyze(alice, 'dump-1')).resolves.toMatchObject({ analysis: { summary: clearResult.summary } });
    expect(ai.complete).toHaveBeenCalledTimes(2);

    const failedState = repos();
    const failedAi = { complete: vi.fn().mockResolvedValue(invalidResult) };
    const failed = createAnalysisService(failedState.dumpRepository, failedState.sessionRepository, failedAi);
    await expect(failed.analyze(alice, 'dump-1')).rejects.toBeInstanceOf(AnalysisValidationError);
    expect(failedAi.complete).toHaveBeenCalledTimes(2);
    expect(failedState.dumpRepository.update).toHaveBeenCalledWith(alice, 'dump-1', { status: 'failed', errorCode: 'NEEDS_ATTENTION' });
    expect(failedState.sessionRepository.create).toHaveBeenCalledTimes(0);
  });

  it('maps timeout/network errors to retryable safe errors and does not persist sessions', async () => {
    const state = repos();
    const ai = { complete: vi.fn(async () => { throw new Error('network secret'); }) };
    const service = createAnalysisService(state.dumpRepository, state.sessionRepository, ai);
    await expect(service.analyze(alice, 'dump-1')).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
      cause: { message: 'network secret' },
    });
    expect(state.sessionRepository.create).not.toHaveBeenCalled();
    expect(state.dumpRepository.update).toHaveBeenCalledWith(alice, 'dump-1', { status: 'failed', errorCode: 'AI_UNAVAILABLE' });
  });

  it('keeps a repair timeout retryable instead of treating it as invalid model output', async () => {
    const state = repos();
    const ai = { complete: vi.fn().mockResolvedValueOnce(invalidResult).mockRejectedValueOnce(new Error('timeout')) };
    const service = createAnalysisService(state.dumpRepository, state.sessionRepository, ai);
    await expect(service.analyze(alice, 'dump-1')).rejects.toBeInstanceOf(AiRetryableError);
    expect(state.dumpRepository.update).toHaveBeenCalledWith(alice, 'dump-1', { status: 'failed', errorCode: 'AI_UNAVAILABLE' });
  });

  it('rejects cross-user ownership and accepts only returned question IDs', async () => {
    const state = repos();
    const service = createAnalysisService(state.dumpRepository, state.sessionRepository, client(lowConfidenceResult));
    await expect(service.analyze(bob, 'dump-1')).rejects.toBeInstanceOf(AnalysisNotFoundError);
    await service.analyze(alice, 'dump-1');
    await expect(service.answer(alice, 'dump-1', [{ id: 'not-returned', text: 'x' }])).rejects.toBeInstanceOf(AnalysisAnswersError);
  });
});
