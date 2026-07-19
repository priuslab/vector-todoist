import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { PocketBaseClient, PocketBaseRecord } from '../../pocketbase/client.js';
import type { VerifiedUser } from '../../auth/verifyPocketBaseToken.js';
import type { TaskRepository } from '../../repositories/taskRepository.js';
import { RepositoryError } from '../../repositories/base.js';

export type FocusSessionStatus = 'active' | 'paused' | 'finished';
export type FocusSessionRecord = PocketBaseRecord & {
  user: string; task: string; status: FocusSessionStatus; plannedMinutes: number;
  startedAt: string; plannedEndAt: string; pausedAt?: string | null; pausedSeconds: number;
  finishedAt?: string | null; actualMinutes?: number | null; idempotencyKey: string; version: number;
};
export class FocusSessionValidationError extends Error { readonly code = 'INVALID_FOCUS_SESSION'; }
export class FocusSessionNotFoundError extends Error { readonly code = 'NOT_FOUND'; }
export class FocusSessionConflictError extends Error { readonly code = 'FOCUS_SESSION_CONFLICT'; }

export interface FocusSessionRepository {
  list(user: VerifiedUser): Promise<FocusSessionRecord[]>;
  get(user: VerifiedUser, id: string): Promise<FocusSessionRecord | null>;
  create(user: VerifiedUser, input: Record<string, unknown>): Promise<FocusSessionRecord>;
  update(user: VerifiedUser, id: string, input: Record<string, unknown>): Promise<FocusSessionRecord>;
}

const esc = (value: string) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
export function createFocusSessionRepository(client: PocketBaseClient): FocusSessionRepository {
  const scoped = (user: VerifiedUser) => user.token && client.withToken ? client.withToken(user.token) : client;
  return {
    list: async (user) => scoped(user).list<FocusSessionRecord>('focus_sessions', `user = '${esc(user.userId)}'`),
    get: async (user, id) => {
      const rows = await scoped(user).list<FocusSessionRecord>('focus_sessions', `user = '${esc(user.userId)}' && id = '${esc(id)}'`);
      return rows.find((row) => row.id === id && row.user === user.userId) ?? null;
    },
    create: async (user, input) => scoped(user).create<FocusSessionRecord>('focus_sessions', { ...input, user: user.userId }),
    update: async (user, id, input) => scoped(user).update<FocusSessionRecord>('focus_sessions', id, { ...input, user: user.userId }),
  };
}

const startSchema = z.object({ taskId: z.string().trim().min(1).max(128), durationMinutes: z.number().int().min(1).max(240).default(25), idempotencyKey: z.string().trim().min(8).max(255).optional() }).strict();
const finishSchema = z.object({ completeTask: z.boolean().default(false) }).strict();
const nowIso = (value?: string) => value ? new Date(value) : new Date();
const validNow = (date: Date) => Number.isFinite(date.getTime());
const publicSession = (session: FocusSessionRecord) => ({ id: session.id, taskId: session.task, status: session.status, plannedMinutes: Number(session.plannedMinutes), startedAt: session.startedAt, plannedEndAt: session.plannedEndAt, pausedAt: session.pausedAt ?? null, pausedSeconds: Number(session.pausedSeconds ?? 0), finishedAt: session.finishedAt ?? null, actualMinutes: session.actualMinutes == null ? null : Number(session.actualMinutes), version: Number(session.version ?? 1) });

export interface FocusSessionService { start(user: VerifiedUser, input: unknown): Promise<ReturnType<typeof publicSession>>; pause(user: VerifiedUser, id: string): Promise<ReturnType<typeof publicSession>>; resume(user: VerifiedUser, id: string): Promise<ReturnType<typeof publicSession>>; finish(user: VerifiedUser, id: string, input: unknown): Promise<ReturnType<typeof publicSession>>; }
export function createFocusSessionService(deps: { repository: FocusSessionRepository; taskRepository: TaskRepository; now?: () => Date }): FocusSessionService {
  const { repository, taskRepository, now: clock = () => new Date() } = deps;
  const own = async (user: VerifiedUser, id: string) => {
    const session = await repository.get(user, id);
    if (!session || session.user !== user.userId) throw new FocusSessionNotFoundError();
    return session;
  };
  const ensureTask = async (user: VerifiedUser, taskId: string) => {
    const task = await taskRepository.get(user, taskId);
    if (!task || task.user !== user.userId) throw new FocusSessionNotFoundError();
  };
  const update = async (user: VerifiedUser, session: FocusSessionRecord, patch: Record<string, unknown>) => {
    if (Number(session.version ?? 1) !== Number(session.version ?? 1)) throw new FocusSessionConflictError();
    try { return await repository.update(user, session.id, { ...patch, version: Number(session.version ?? 1) + 1 }); }
    catch { throw new RepositoryError('UNAVAILABLE'); }
  };
  return {
    async start(user, raw) {
      const parsed = startSchema.safeParse(raw);
      if (!parsed.success) throw new FocusSessionValidationError();
      await ensureTask(user, parsed.data.taskId);
      const key = parsed.data.idempotencyKey ?? `focus:${parsed.data.taskId}:${parsed.data.durationMinutes}`;
      const existing = (await repository.list(user)).find((item) => item.idempotencyKey === key);
      if (existing) return publicSession(existing);
      const active = (await repository.list(user)).find((item) => item.task === parsed.data.taskId && (item.status === 'active' || item.status === 'paused'));
      if (active) throw new FocusSessionConflictError();
      const started = clock();
      if (!validNow(started)) throw new FocusSessionValidationError();
      try {
        const session = await repository.create(user, { task: parsed.data.taskId, status: 'active', plannedMinutes: parsed.data.durationMinutes, startedAt: started.toISOString(), plannedEndAt: new Date(started.getTime() + parsed.data.durationMinutes * 60_000).toISOString(), pausedAt: null, pausedSeconds: 0, finishedAt: null, actualMinutes: null, idempotencyKey: key, version: 1 });
        return publicSession(session);
      } catch {
        const raced = (await repository.list(user)).find((item) => item.idempotencyKey === key);
        if (raced) return publicSession(raced);
        throw new RepositoryError('UNAVAILABLE');
      }
    },
    async pause(user, id) {
      const session = await own(user, id);
      if (session.status === 'paused') return publicSession(session);
      if (session.status !== 'active') throw new FocusSessionConflictError();
      const paused = clock();
      if (!validNow(paused)) throw new FocusSessionValidationError();
      return publicSession(await update(user, session, { status: 'paused', pausedAt: paused.toISOString() }));
    },
    async resume(user, id) {
      const session = await own(user, id);
      if (session.status === 'active') return publicSession(session);
      if (session.status !== 'paused' || !session.pausedAt) throw new FocusSessionConflictError();
      const resumed = clock();
      const pausedAt = new Date(session.pausedAt);
      if (!validNow(resumed) || !validNow(pausedAt) || resumed.getTime() < pausedAt.getTime()) throw new FocusSessionValidationError();
      const added = Math.max(0, Math.floor((resumed.getTime() - pausedAt.getTime()) / 1000));
      const plannedEnd = new Date(new Date(session.plannedEndAt).getTime() + added * 1000);
      return publicSession(await update(user, session, { status: 'active', pausedAt: null, pausedSeconds: Number(session.pausedSeconds ?? 0) + added, plannedEndAt: plannedEnd.toISOString() }));
    },
    async finish(user, id, raw) {
      const parsed = finishSchema.safeParse(raw ?? {});
      if (!parsed.success) throw new FocusSessionValidationError();
      const session = await own(user, id);
      if (session.status === 'finished') return publicSession(session);
      if (session.status !== 'active' && session.status !== 'paused') throw new FocusSessionConflictError();
      const finished = clock();
      const pausedAt = session.pausedAt ? new Date(session.pausedAt) : null;
      const pausedSeconds = Number(session.pausedSeconds ?? 0) + (pausedAt && validNow(finished) ? Math.max(0, Math.floor((finished.getTime() - pausedAt.getTime()) / 1000)) : 0);
      const started = new Date(session.startedAt);
      if (!validNow(finished) || !validNow(started)) throw new FocusSessionValidationError();
      const actualMinutes = Math.max(0, Math.round(((finished.getTime() - started.getTime()) / 60_000 - pausedSeconds / 60) * 10) / 10);
      const result = await update(user, session, { status: 'finished', pausedAt: null, pausedSeconds, finishedAt: finished.toISOString(), actualMinutes });
      // Completing a focus session never completes its task implicitly. The explicit flag is
      // accepted for future task-confirmation UI, but task mutation remains a separate action.
      void parsed.data.completeTask;
      return publicSession(result);
    },
  };
}

const mapError = (error: unknown) => {
  if (error instanceof FocusSessionNotFoundError || (error instanceof RepositoryError && error.code === 'NOT_FOUND')) return { status: 404, body: { error: 'NOT_FOUND' } };
  if (error instanceof FocusSessionValidationError) return { status: 422, body: { error: 'INVALID_FOCUS_SESSION' } };
  if (error instanceof FocusSessionConflictError) return { status: 409, body: { error: 'FOCUS_SESSION_CONFLICT', retryable: true } };
  return { status: 503, body: { error: 'FOCUS_SESSION_UNAVAILABLE', retryable: true } };
};
const auth = (app: FastifyInstance) => ({ preHandler: (request: FastifyRequest, reply: FastifyReply) => app.requireUser(request, reply) });
export async function focusSessionRoutes(app: FastifyInstance, service: FocusSessionService): Promise<void> {
  const secured = auth(app);
  app.post('/api/v1/focus-sessions/start', secured, async (request: FastifyRequest<{ Body: unknown }>, reply) => { try { return reply.code(200).send(await service.start(request.user, request.body)); } catch (e) { const mapped = mapError(e); return reply.code(mapped.status).send(mapped.body); } });
  app.post('/api/v1/focus-sessions/:id/pause', secured, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => { try { return reply.code(200).send(await service.pause(request.user, request.params.id)); } catch (e) { const mapped = mapError(e); return reply.code(mapped.status).send(mapped.body); } });
  app.post('/api/v1/focus-sessions/:id/resume', secured, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => { try { return reply.code(200).send(await service.resume(request.user, request.params.id)); } catch (e) { const mapped = mapError(e); return reply.code(mapped.status).send(mapped.body); } });
  app.post('/api/v1/focus-sessions/:id/finish', secured, async (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply) => { try { return reply.code(200).send(await service.finish(request.user, request.params.id, request.body)); } catch (e) { const mapped = mapError(e); return reply.code(mapped.status).send(mapped.body); } });
}
