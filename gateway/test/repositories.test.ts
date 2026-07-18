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
