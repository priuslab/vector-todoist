import { describe, expect, it, vi } from 'vitest';
import { createCalendarWorker } from '../src/worker.js';

describe('Calendar VPS worker registration', () => {
  it('dispatches renewal and reconciliation jobs through the leased runner', async () => {
    const jobs: any[] = [{ id: 'j1', user: 'u1', type: 'calendar.watch.renew', payloadJson: { calendarId: 'primary' }, status: 'pending', attempts: 0 }];
    const repository = { claim: vi.fn(async () => jobs.shift() ?? null), complete: vi.fn(), fail: vi.fn() };
    const renew = vi.fn().mockResolvedValue(undefined);
    const worker = createCalendarWorker({ repository, owner: 'vps-1', resolveUser: async (userId) => ({ userId, email: 'olena@example.com' }), watchService: { renew }, reconcileService: { reconcile: vi.fn(), reconcileWatch: vi.fn() } });
    await worker.runOnce();
    expect(renew).toHaveBeenCalledWith({ userId: 'u1', email: 'olena@example.com' }, 'primary');
    expect(repository.complete).toHaveBeenCalledWith('j1', 'vps-1');
  });
});
