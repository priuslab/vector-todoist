import { createHash } from 'node:crypto';

export type VerifiedUser = { userId: string; email: string };
export type PocketBaseFetch = typeof fetch;
export type TokenLogger = { warn?: (...args: unknown[]) => void; error?: (...args: unknown[]) => void };

export class AuthError extends Error {
  readonly code = 'UNAUTHORIZED';
  constructor() { super('Unauthorized'); this.name = 'AuthError'; }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createPocketBaseTokenVerifier(options: {
  baseUrl: string;
  fetcher?: PocketBaseFetch;
  cacheTtlMs?: number;
  timeoutMs?: number;
  maxCacheEntries?: number;
  logger?: TokenLogger;
}) {
  const fetcher = options.fetcher ?? fetch;
  const cacheTtlMs = Math.min(Math.max(options.cacheTtlMs ?? 30_000, 0), 60_000);
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 5_000, 100), 30_000);
  const maxCacheEntries = Math.min(Math.max(options.maxCacheEntries ?? 1_000, 1), 10_000);
  const cache = new Map<string, { expiresAt: number; user: VerifiedUser }>();
  const baseUrl = options.baseUrl.replace(/\/$/, '');

  return {
    cacheTtlMs,
    async verify(authorization: string | undefined): Promise<VerifiedUser> {
      if (!authorization?.startsWith('Bearer ')) throw new AuthError();
      const token = authorization.slice(7).trim();
      if (!token) throw new AuthError();
      const key = hashToken(token);
      const cached = cache.get(key);
      if (cached && cached.expiresAt > Date.now()) return cached.user;
      cache.delete(key);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const result = await fetcher(`${baseUrl}/api/collections/users/auth-refresh`, {
          method: 'POST', headers: { authorization: `Bearer ${token}` }, signal: controller.signal,
        });
        if (!result.ok) throw new AuthError();
        const body: unknown = await result.json();
        if (!body || typeof body !== 'object') throw new AuthError();
        const record = (body as { record?: unknown }).record;
        if (!record || typeof record !== 'object') throw new AuthError();
        const userId = (record as { id?: unknown }).id;
        const email = (record as { email?: unknown }).email;
        if (typeof userId !== 'string' || !userId || typeof email !== 'string' || !email) throw new AuthError();
        const user = { userId, email };
        if (cacheTtlMs > 0) {
          if (cache.size >= maxCacheEntries && !cache.has(key)) cache.delete(cache.keys().next().value as string);
          cache.set(key, { user, expiresAt: Date.now() + cacheTtlMs });
        }
        return user;
      } catch (error) {
        options.logger?.warn?.('PocketBase auth verification failed');
        if (error instanceof AuthError) throw error;
        throw new AuthError();
      } finally {
        clearTimeout(timer);
      }
    },
    clear() { cache.clear(); },
  };
}

export type PocketBaseTokenVerifier = ReturnType<typeof createPocketBaseTokenVerifier>;
