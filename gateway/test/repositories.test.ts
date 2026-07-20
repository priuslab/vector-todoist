import { describe, expect, it, vi } from 'vitest';

import { createBrainDumpRepository } from '../src/repositories/brainDumpRepository.js';
import { createTaskRepository } from '../src/repositories/taskRepository.js';
import { createIdeaRepository } from '../src/repositories/ideaRepository.js';
import { createChangeSetRepository } from '../src/repositories/changeSetRepository.js';
import { createPocketBaseClient, PocketBaseClientError } from '../src/pocketbase/client.js';

type RecordData = { id: string; user: string; title?: string; text?: string };
function client(records: RecordData[]) {
  return {
    list: vi.fn(async (collection: string, filter: string) => {
      const match = /id = '([^']+)'/.exec(filter);
      return records.filter((r) => (!match || r.id === match[1]) && (collection !== 'tasks' || filter.includes(`user = 'user-1'`) ? true : false));
    }),
    create: vi.fn(async (_collection: string, data: Record<string, unknown>) => ({ id: 'created', ...data })),
    update: vi.fn(async (_collection: string, id: string, data: Record<string, unknown>) => ({ id, ...data, user: 'user-1' })),
    delete: vi.fn(async () => undefined),
  };
}

const identity = { userId: 'user-1', email: 'olena@example.test' };

describe('PocketBase repositories', () => {
  it('sets server-side ownership and ignores spoofed user fields', async () => {
    const pb = client([]);
    const task = createTaskRepository(pb);
    const idea = createIdeaRepository(pb);
    const dump = createBrainDumpRepository(pb);
    const changes = createChangeSetRepository(pb);

    await task.create(identity, { title: 'Task', user: 'attacker' });
    await idea.create(identity, { text: 'Idea', user: 'attacker' });
    await dump.create(identity, { rawText: 'Dump', user: 'attacker' });
    await changes.create(identity, { kind: 'schedule', beforeJson: '{}', user: 'attacker' });

    for (const call of pb.create.mock.calls) expect(call[1]).toMatchObject({ user: identity.userId });
  });

  it('uses a bounded request timeout and rejects malformed list responses safely', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ items: null }), { status: 200 }));
    const pb = createPocketBaseClient({ baseUrl: 'http://pb.test', fetcher, timeoutMs: 100 });
    await expect(pb.list('tasks', "user = 'user-1'")).rejects.toBeInstanceOf(PocketBaseClientError);
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/api/collections/tasks/records?'), expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('retains safe PocketBase validation details for server-side diagnostics', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      code: 400,
      message: 'Failed to create record.',
      data: { startedAt: { code: 'validation_invalid_datetime', message: 'Invalid date.' } },
    }), { status: 400, headers: { 'content-type': 'application/json' } }));
    const pb = createPocketBaseClient({ baseUrl: 'http://pb.test', fetcher });

    await expect(pb.create('goal_discovery_sessions', {})).rejects.toMatchObject({
      status: 400,
      details: {
        code: 400,
        message: 'Failed to create record.',
        fields: { startedAt: { code: 'validation_invalid_datetime', message: 'Invalid date.' } },
      },
    });
  });

  it('preserves the safe PocketBase failure as the repository error cause', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      code: 400,
      message: 'Failed to create record.',
      data: { user: { code: 'validation_invalid', message: 'Invalid owner.' } },
    }), { status: 400, headers: { 'content-type': 'application/json' } }));
    const repository = createBrainDumpRepository(createPocketBaseClient({ baseUrl: 'http://pb.test', fetcher }));

    await expect(repository.create({ ...identity, token: 'request-token' }, { rawText: 'Dump' })).rejects.toMatchObject({
      code: 'UNAVAILABLE',
      cause: {
        status: 400,
        details: { fields: { user: { code: 'validation_invalid', message: 'Invalid owner.' } } },
      },
    });
  });

  it('propagates the verified bearer token only to the request-scoped PocketBase client', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id: 'created' }), { status: 200 }));
    const pb = createPocketBaseClient({ baseUrl: 'http://pb.test', fetcher });
    const dump = createBrainDumpRepository(pb);
    await dump.create({ ...identity, token: 'request-token' }, { rawText: 'Dump' });
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/api/collections/brain_dumps/records'), expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer request-token' }) }));
  });

  it('converts a hanging PocketBase request into a safe unavailable error', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    const pb = createPocketBaseClient({ baseUrl: 'http://pb.test', fetcher, timeoutMs: 10 });
    await expect(pb.list('tasks', '')).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });

  it('scopes reads, updates, deletes, and undo to verified owner and hides cross-user records', async () => {
    const pb = client([{ id: 'owned', user: 'user-1' }, { id: 'other', user: 'user-2' }]);
    const task = createTaskRepository(pb);
    const changes = createChangeSetRepository(pb);

    await expect(task.get(identity, 'other')).resolves.toBeNull();
    await expect(task.update(identity, 'other', { title: 'Nope' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(task.delete(identity, 'other')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(changes.undo(identity, 'other')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(pb.list.mock.calls.every(([, filter]) => filter.includes("user = 'user-1'"))).toBe(true);
  });
});
