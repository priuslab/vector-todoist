import type { JobRecord, JobRepository } from './jobRepository.js';

export type JobHandler = (job: JobRecord) => Promise<void>;

export function createJobRunner(options: {
  repository: Pick<JobRepository, 'claim' | 'complete' | 'fail'>;
  handler: JobHandler;
  owner: string;
  now?: () => number;
  leaseMs?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
}): { runOnce(): Promise<boolean> } {
  const now = options.now ?? (() => Date.now());
  const leaseMs = Math.min(Math.max(options.leaseMs ?? 30_000, 1_000), 300_000);
  const maxAttempts = Math.min(Math.max(options.maxAttempts ?? 5, 1), 10);
  const baseDelayMs = Math.min(Math.max(options.baseDelayMs ?? 1_000, 100), 300_000);
  return {
    async runOnce() {
      const job = await options.repository.claim(options.owner, new Date(now()).toISOString(), leaseMs);
      if (!job) return false;
      try {
        await options.handler(job);
        await options.repository.complete(job.id, options.owner);
      } catch (error) {
        const attempts = Number(job.attempts ?? 0) + 1;
        const delay = Math.min(baseDelayMs * 2 ** Math.max(0, attempts - 1), 300_000);
        await options.repository.fail(job.id, options.owner, {
          status: attempts >= maxAttempts ? 'failed' : 'pending',
          nextRunAt: new Date(now() + delay).toISOString(),
          lastError: error instanceof Error ? error.message.slice(0, 500) : 'JOB_FAILED',
        });
      }
      return true;
    },
  };
}
