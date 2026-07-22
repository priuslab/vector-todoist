import type { PocketBaseClient, PocketBaseRecord } from '../../pocketbase/client.js';
import type { VerifiedUser } from '../../auth/verifyPocketBaseToken.js';
import { RepositoryError } from '../../repositories/base.js';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type JobRecord = PocketBaseRecord & {
  user?: string;
  type: string;
  idempotencyKey: string;
  payloadJson: unknown;
  status: JobStatus;
  attempts: number;
  nextRunAt: string;
  lastError?: string;
  leaseOwner?: string;
  leaseExpiresAt?: string;
};

export interface JobRepository {
  getByIdempotencyKey(user: VerifiedUser, key: string): Promise<JobRecord | null>;
  create(user: VerifiedUser, input: Omit<Partial<JobRecord>, 'id' | 'user'> & { type: string; idempotencyKey: string; payloadJson: unknown }): Promise<JobRecord>;
  claim(owner: string, now: string, leaseMs: number): Promise<JobRecord | null>;
  complete(id: string, owner: string): Promise<void>;
  fail(id: string, owner: string, input: { nextRunAt: string; lastError: string; status: JobStatus }): Promise<void>;
}

/** PocketBase-backed outbox repository. Jobs are normally called by the VPS worker with a server token. */
export function createJobRepository(client: PocketBaseClient, options: { serverToken?: string } = {}): JobRepository {
  const workerClient = options.serverToken && client.withToken ? client.withToken(options.serverToken) : client;
  const getByKey = async (user: VerifiedUser, key: string) => {
    try {
      const escaped = key.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
      const rows = await workerClient.list<JobRecord>('jobs', `user = '${user.userId.replaceAll("'", "\\'")}' && idempotencyKey = '${escaped}'`);
      return rows.find((job) => job.idempotencyKey === key && job.user === user.userId) ?? null;
    } catch { throw new RepositoryError('UNAVAILABLE'); }
  };
  return {
    getByIdempotencyKey: getByKey,
    create: async (user, input) => workerClient.create<JobRecord>('jobs', { ...input, user: user.userId, status: input.status ?? 'pending', attempts: input.attempts ?? 0, nextRunAt: input.nextRunAt ?? new Date().toISOString() }),
    async claim(owner, now, leaseMs) {
      const due = await workerClient.list<JobRecord>('jobs', `(status = 'pending' || status = 'processing') && nextRunAt <= '${now}'`);
      const candidate = due.find((job) => job.status === 'pending' || !job.leaseExpiresAt || Date.parse(job.leaseExpiresAt) <= Date.parse(now));
      if (!candidate) return null;
      const leaseExpiresAt = new Date(Date.parse(now) + leaseMs).toISOString();
      const claimKey = `${candidate.id}:${owner}`;
      try { await workerClient.create('job_claims', { jobId: candidate.id, claimKey, owner, expiresAt: leaseExpiresAt }); }
      catch {
        const claims = await workerClient.list<PocketBaseRecord & { owner?: string; expiresAt?: string }>('job_claims', `jobId = '${candidate.id.replaceAll("'", "\\'")}'`);
        const claim = claims[0];
        if (!claim || !claim.expiresAt || Date.parse(claim.expiresAt) > Date.parse(now)) return null;
        const reclaimKey = `${candidate.id}:${claim.owner ?? ''}:${claim.expiresAt}`;
        try { await workerClient.create('job_reclaims', { jobId: candidate.id, reclaimKey, owner, expiresAt: leaseExpiresAt }); }
        catch {
          const rows = await workerClient.list<PocketBaseRecord & { expiresAt?: string }>('job_reclaims', `reclaimKey = '${reclaimKey.replaceAll("'", "\\'")}'`);
          if (!rows[0] || !rows[0].expiresAt || Date.parse(rows[0].expiresAt) > Date.parse(now)) return null;
          await workerClient.delete('job_reclaims', rows[0].id);
          try { await workerClient.create('job_reclaims', { jobId: candidate.id, reclaimKey, owner, expiresAt: leaseExpiresAt }); } catch { return null; }
        }
        await workerClient.update('job_claims', claim.id, { owner, claimKey, expiresAt: leaseExpiresAt });
      }
      const claimed = await workerClient.update<JobRecord>('jobs', candidate.id, { status: 'processing', leaseOwner: owner, leaseExpiresAt });
      // A second VPS may have raced this update. Read-back makes only the winner process the job.
      return claimed.leaseOwner === owner && claimed.status === 'processing' ? claimed : null;
    },
    async complete(id, owner) {
      const rows = await workerClient.list<JobRecord>('jobs', `id = '${id.replaceAll("'", "\\'")}' && ((status = 'processing' && leaseOwner = '${owner.replaceAll("'", "\\'")}') || status = 'pending')`);
      if (rows[0]) { await workerClient.update('jobs', id, { status: 'completed', leaseOwner: '', leaseExpiresAt: null }); const claims = await workerClient.list<PocketBaseRecord & { id: string }>('job_claims', `jobId = '${id.replaceAll("'", "\\'")}'`); if (claims[0]) await workerClient.delete('job_claims', claims[0].id); const reclaims = await workerClient.list<PocketBaseRecord & { id: string }>('job_reclaims', `jobId = '${id.replaceAll("'", "\\'")}'`); for (const reclaim of reclaims) await workerClient.delete('job_reclaims', reclaim.id); }
    },
    async fail(id, owner, input) {
      const rows = await workerClient.list<JobRecord>('jobs', `id = '${id.replaceAll("'", "\\'")}' && status = 'processing' && leaseOwner = '${owner.replaceAll("'", "\\'")}'`);
      if (rows[0]) { await workerClient.update('jobs', id, { ...input, attempts: Number(rows[0].attempts ?? 0) + 1, leaseOwner: '', leaseExpiresAt: null }); const claims = await workerClient.list<PocketBaseRecord & { id: string }>('job_claims', `jobId = '${id.replaceAll("'", "\\'")}'`); if (claims[0]) await workerClient.delete('job_claims', claims[0].id); const reclaims = await workerClient.list<PocketBaseRecord & { id: string }>('job_reclaims', `jobId = '${id.replaceAll("'", "\\'")}'`); for (const reclaim of reclaims) await workerClient.delete('job_reclaims', reclaim.id); }
    },
  };
}
