import { createHash, randomBytes as nodeRandomBytes } from 'node:crypto';
import { decryptSecret, encryptSecret } from '../../crypto/encryptedSecret.js';
import type { VerifiedUser } from '../../auth/verifyPocketBaseToken.js';

export type CalendarConnection = {
  id?: string;
  user: string;
  provider: 'google';
  status: 'connected' | 'attention' | 'disabled';
  encryptedRefreshToken?: string;
  accountEmail?: string;
  scopes?: string[];
  tokenExpiresAt?: string;
};

export interface CalendarConnectionRepository {
  get(user: VerifiedUser): Promise<CalendarConnection | null>;
  upsert(user: VerifiedUser, input: Omit<CalendarConnection, 'user' | 'id'>): Promise<CalendarConnection>;
  delete(user: VerifiedUser): Promise<void>;
}

export type GoogleTokenResponse = { refreshToken?: string; email?: string; expiresIn?: number; scopes?: string[] };
type ExchangeInput = { code: string; verifier: string; redirectUri: string; clientId: string };

export class OAuthStateError extends Error { constructor(message = 'Invalid OAuth state') { super(message); this.name = 'OAuthStateError'; } }
export class OAuthProviderError extends Error { constructor() { super('Google OAuth unavailable'); this.name = 'OAuthProviderError'; } }

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.freebusy';
const tokenEndpoint = 'https://oauth2.googleapis.com/token';

function base64Url(bytes: Uint8Array): string { return Buffer.from(bytes).toString('base64url'); }
function challenge(verifier: string): string { return createHash('sha256').update(verifier).digest('base64url'); }

type State = { user: VerifiedUser; verifier: string; createdAt: number; existing: boolean };

export function createGoogleOAuthService(options: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encryptionKey: Buffer | Uint8Array | string;
  repository: CalendarConnectionRepository;
  stateTtlMs?: number;
  now?: () => number;
  randomBytes?: (size: number) => Uint8Array;
  exchangeCode?: (input: ExchangeInput) => Promise<GoogleTokenResponse>;
  revokeToken?: (refreshToken: string) => Promise<void>;
}) {
  const states = new Map<string, State>();
  const now = options.now ?? (() => Date.now());
  const ttl = Math.min(Math.max(options.stateTtlMs ?? 5 * 60_000, 1), 15 * 60_000);
  const random = options.randomBytes ?? ((size: number) => nodeRandomBytes(size));
  const exchange = options.exchangeCode ?? (async ({ code, verifier, redirectUri, clientId }) => {
    const body = new URLSearchParams({ code, client_id: clientId, client_secret: options.clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code', code_verifier: verifier });
    const response = await fetch(tokenEndpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
    if (!response.ok) throw new OAuthProviderError();
    const payload = await response.json() as Record<string, unknown>;
    const refreshToken = typeof payload.refresh_token === 'string' ? payload.refresh_token : undefined;
    const expiresIn = typeof payload.expires_in === 'number' ? payload.expires_in : undefined;
    if (!refreshToken) throw new OAuthProviderError();
    return { refreshToken, expiresIn };
  });

  function consumeState(state: string): State {
    if (!state) throw new OAuthStateError();
    const item = states.get(state);
    states.delete(state);
    if (!item || now() - item.createdAt > ttl) throw new OAuthStateError();
    return item;
  }

  return {
    async start(user: VerifiedUser) {
      const existing = await options.repository.get(user);
      const verifier = base64Url(random(32));
      const state = base64Url(random(24));
      states.set(state, { user: { ...user }, verifier, createdAt: now(), existing: Boolean(existing) });
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.search = new URLSearchParams({ client_id: options.clientId, response_type: 'code', redirect_uri: options.redirectUri, scope: CALENDAR_SCOPE, code_challenge: challenge(verifier), code_challenge_method: 'S256', state, access_type: 'offline', ...(existing ? {} : { prompt: 'consent' }) }).toString();
      return { redirectUrl: url.toString(), state };
    },
    async callback(params: { code?: string; state?: string; exchangeCode?: (input: ExchangeInput) => Promise<GoogleTokenResponse> }) {
      const item = consumeState(params.state ?? '');
      const code = params.code?.trim();
      if (!code) throw new OAuthStateError('Missing OAuth code');
      const token: GoogleTokenResponse = await (params.exchangeCode ?? exchange)({ code, verifier: item.verifier, redirectUri: options.redirectUri, clientId: options.clientId });
      const previous = await options.repository.get(item.user);
      const encryptedRefreshToken = token.refreshToken ? encryptSecret(token.refreshToken, options.encryptionKey) : previous?.encryptedRefreshToken;
      if (!encryptedRefreshToken) throw new OAuthProviderError();
      const connected = await options.repository.upsert(item.user, {
        provider: 'google', status: 'connected', encryptedRefreshToken, accountEmail: token.email ?? previous?.accountEmail ?? item.user.email,
        scopes: token.scopes ?? [CALENDAR_SCOPE], tokenExpiresAt: token.expiresIn ? new Date(now() + token.expiresIn * 1000).toISOString() : previous?.tokenExpiresAt,
      });
      return { status: connected.status, accountEmail: connected.accountEmail };
    },
    async status(user: VerifiedUser) {
      const connection = await options.repository.get(user);
      return connection ? { status: connection.status, accountEmail: connection.accountEmail } : { status: 'disabled' as const };
    },
    async disconnect(user: VerifiedUser) {
      const connection = await options.repository.get(user);
      if (!connection) return;
      if (connection.encryptedRefreshToken && options.revokeToken) {
        try { await options.revokeToken(decryptSecret(connection.encryptedRefreshToken, options.encryptionKey)); } catch { /* clearing local access remains safe */ }
      }
      await options.repository.delete(user);
    },
    clearStates() { states.clear(); },
  };
}

export type GoogleOAuthService = ReturnType<typeof createGoogleOAuthService>;
export { CALENDAR_SCOPE };
