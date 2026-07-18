import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from '../src/crypto/encryptedSecret.js';
import { createGoogleOAuthService, OAuthStateError } from '../src/integrations/google/googleOAuth.js';

const user = { userId: 'user-a', email: 'a@example.com', token: 'pb-token-a' };
const key = Buffer.alloc(32, 7);

function repository(initial: any = null) {
  let record = initial;
  return {
    get: async (owner: any) => record && record.user === owner.userId ? record : null,
    upsert: async (owner: any, input: any) => { record = { id: record?.id ?? 'calendar-1', user: owner.userId, ...input }; return record; },
    delete: async (owner: any) => { if (!record || record.user !== owner.userId) throw new Error('NOT_FOUND'); record = null; },
    current: () => record,
  };
}

describe('encrypted calendar secrets', () => {
  it('round trips AES-256-GCM and fails closed for a wrong key or tampering', () => {
    const encrypted = encryptSecret('refresh-token', key);
    expect(encrypted).not.toContain('refresh-token');
    expect(decryptSecret(encrypted, key)).toBe('refresh-token');
    expect(() => decryptSecret(encrypted, Buffer.alloc(32, 8))).toThrow();
    expect(() => decryptSecret(`${encrypted.slice(0, -1)}x`, key)).toThrow();
  });
});

describe('Google Calendar OAuth', () => {
  it('creates PKCE state and does not request broad scopes', async () => {
    const repo = repository();
    const service = createGoogleOAuthService({ clientId: 'client', clientSecret: 'secret', redirectUri: 'https://app.test/api/v1/integrations/google-calendar/callback', encryptionKey: key, repository: repo, randomBytes: (n) => Buffer.alloc(n, 1), now: () => 1_000 });
    const started = await service.start(user);
    const url = new URL(started.redirectUrl);
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/calendar.freebusy');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('access_type')).toBe('offline');
  });

  it('rejects state mismatch, expiry and reuse, and stores no plaintext token', async () => {
    const repo = repository();
    let now = 1_000;
    const service = createGoogleOAuthService({ clientId: 'client', clientSecret: 'secret', redirectUri: 'https://app.test/callback', encryptionKey: key, repository: repo, randomBytes: (n) => Buffer.alloc(n, 2), now: () => now, stateTtlMs: 100 });
    const started = await service.start(user);
    await expect(service.callback({ code: 'code', state: 'wrong' })).rejects.toBeInstanceOf(OAuthStateError);
    now = 2_000;
    await expect(service.callback({ code: 'code', state: started.state })).rejects.toBeInstanceOf(OAuthStateError);
    const second = await service.start(user);
    const result = await service.callback({ code: 'code', state: second.state, exchangeCode: async () => ({ refreshToken: 'refresh-secret', email: user.email, expiresIn: 3600 }) });
    expect(result.status).toBe('connected');
    expect(repo.current().encryptedRefreshToken).not.toContain('refresh-secret');
    await expect(service.callback({ code: 'code', state: second.state })).rejects.toBeInstanceOf(OAuthStateError);
  });

  it('keeps ownership isolated for status and deletion', async () => {
    const repo = repository({ id: 'calendar-1', user: 'user-a', status: 'connected', encryptedRefreshToken: encryptSecret('token', key) });
    const service = createGoogleOAuthService({ clientId: 'client', clientSecret: 'secret', redirectUri: 'https://app.test/callback', encryptionKey: key, repository: repo });
    expect((await service.status(user)).status).toBe('connected');
    expect((await service.status({ userId: 'user-b', email: 'b@example.com' })).status).toBe('disabled');
    await expect(service.disconnect({ userId: 'user-b', email: 'b@example.com' })).resolves.toBeUndefined();
  });
});
