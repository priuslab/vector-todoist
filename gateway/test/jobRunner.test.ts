import { describe, expect, it, vi } from 'vitest';
import { createJobRunner } from '../src/modules/jobs/jobRunner.js';

describe('DB leased job runner', () => {
  it('does not process the same job twice when a second runner cannot claim the lease', async () => {
    const job = { id: 'job-1', type: 'calendar.create', idempotencyKey: 'calendar:u1:task-1', payloadJson: { taskId: 'task-1' }, status: 'pending', attempts: 0 };
    const claim = vi.fn().mockResolvedValueOnce({ ...job, status: 'processing', leaseOwner: 'runner-a' }).mockResolvedValueOnce(null);
    const repository = { claim, complete: vi.fn(), fail: vi.fn() };
    const handler = vi.fn().mockResolvedValue(undefined);
    const runnerA = createJobRunner({ repository, handler, owner: 'runner-a' });
    const runnerB = createJobRunner({ repository, handler, owner: 'runner-b' });
    await Promise.all([runnerA.runOnce(), runnerB.runOnce()]);
    expect(handler).toHaveBeenCalledOnce();
    expect(repository.complete).toHaveBeenCalledOnce();
  });

  it('reclaims stale leases and applies bounded backoff after failure', async () => {
    const job = { id: 'job-1', type: 'calendar.create', idempotencyKey: 'key', payloadJson: {}, status: 'pending', attempts: 1, leaseExpiresAt: '2020-01-01T00:00:00.000Z' };
    const repository = { claim: vi.fn().mockResolvedValue(job), complete: vi.fn(), fail: vi.fn() };
    const handler = vi.fn().mockRejectedValue(new Error('offline'));
    const runner = createJobRunner({ repository, handler, owner: 'runner-a', now: () => Date.parse('2026-07-18T12:00:00Z'), maxAttempts: 3, baseDelayMs: 1_000 });
    await runner.runOnce();
    expect(repository.fail).toHaveBeenCalledWith('job-1', 'runner-a', expect.objectContaining({ nextRunAt: expect.any(String), lastError: 'offline' }));
  });
});
