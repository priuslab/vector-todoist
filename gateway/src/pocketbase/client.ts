export type PocketBaseRecord = { id: string; user?: string; [key: string]: unknown };
export class PocketBaseClientError extends Error {
  readonly code = 'UNAVAILABLE';
  constructor() { super('PocketBase unavailable'); this.name = 'PocketBaseClientError'; }
}

export interface PocketBaseClient {
  list<T extends PocketBaseRecord = PocketBaseRecord>(collection: string, filter: string): Promise<T[]>;
  create<T extends PocketBaseRecord = PocketBaseRecord>(collection: string, data: Record<string, unknown>): Promise<T>;
  update<T extends PocketBaseRecord = PocketBaseRecord>(collection: string, id: string, data: Record<string, unknown>): Promise<T>;
  delete(collection: string, id: string): Promise<void>;
}

export function createPocketBaseClient(options: { baseUrl: string; token?: string; fetcher?: typeof fetch; timeoutMs?: number }): PocketBaseClient {
  const fetcher = options.fetcher ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 5_000, 100), 30_000);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(`${baseUrl}${path}`, {
        ...init, signal: controller.signal,
        headers: { 'content-type': 'application/json', ...(options.token ? { authorization: `Bearer ${options.token}` } : {}), ...init.headers },
      });
      if (!response.ok) throw new PocketBaseClientError();
      if (response.status === 204) return undefined as T;
      try { return await response.json() as T; } catch { throw new PocketBaseClientError(); }
    } catch { throw new PocketBaseClientError(); } finally { clearTimeout(timer); }
  }
  return {
    async list<T extends PocketBaseRecord = PocketBaseRecord>(collection: string, filter: string): Promise<T[]> {
      const params = new URLSearchParams({ filter });
      const body: unknown = await request(`/api/collections/${encodeURIComponent(collection)}/records?${params}`);
      if (!body || typeof body !== 'object' || !Array.isArray((body as { items?: unknown }).items)) throw new PocketBaseClientError();
      return (body as { items: unknown[] }).items.filter((item): item is PocketBaseRecord => Boolean(item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string')) as T[];
    },
    async create<T extends PocketBaseRecord = PocketBaseRecord>(collection: string, data: Record<string, unknown>): Promise<T> {
      const body: unknown = await request(`/api/collections/${encodeURIComponent(collection)}/records`, { method: 'POST', body: JSON.stringify(data) });
      if (!body || typeof body !== 'object' || typeof (body as { id?: unknown }).id !== 'string') throw new PocketBaseClientError();
      return body as T;
    },
    async update<T extends PocketBaseRecord = PocketBaseRecord>(collection: string, id: string, data: Record<string, unknown>): Promise<T> {
      const body: unknown = await request(`/api/collections/${encodeURIComponent(collection)}/records/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) });
      if (!body || typeof body !== 'object' || typeof (body as { id?: unknown }).id !== 'string') throw new PocketBaseClientError();
      return body as T;
    },
    delete: async (collection, id) => { await request(`/api/collections/${encodeURIComponent(collection)}/records/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  };
}
