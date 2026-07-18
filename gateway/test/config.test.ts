import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config.js';

function validEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: '8787',
    PUBLIC_WEB_ORIGIN: 'https://app.vector.test',
    POCKETBASE_URL: 'http://127.0.0.1:8090',
    ...overrides,
  };
}

describe('loadConfig', () => {
  it('returns validated required values', () => {
    expect(loadConfig(validEnv())).toMatchObject({
      nodeEnv: 'test',
      host: '127.0.0.1',
      port: 8787,
      publicWebOrigin: 'https://app.vector.test',
      pocketbaseUrl: 'http://127.0.0.1:8090',
      trustProxy: false,
    });
  });

  it.each(['development', 'test', 'production'] as const)('accepts %s as NODE_ENV', (nodeEnv) => {
    expect(loadConfig(validEnv({ NODE_ENV: nodeEnv })).nodeEnv).toBe(nodeEnv);
  });

  it.each(['NODE_ENV', 'HOST', 'PORT', 'PUBLIC_WEB_ORIGIN', 'POCKETBASE_URL'])(
    'fails fast when %s is missing',
    (name) => {
      expect(() => loadConfig(validEnv({ [name]: undefined }))).toThrow(name);
    },
  );

  it('rejects an unsupported NODE_ENV', () => {
    expect(() => loadConfig(validEnv({ NODE_ENV: 'staging' }))).toThrow('NODE_ENV');
  });

  it.each(['0', '-1', '65536', '8787.5', 'not-a-port'])('rejects invalid PORT %s', (port) => {
    expect(() => loadConfig(validEnv({ PORT: port }))).toThrow('PORT');
  });

  it('parses an explicit true TRUST_PROXY value', () => {
    expect(loadConfig(validEnv({ TRUST_PROXY: 'true' })).trustProxy).toBe(true);
  });

  it('parses an explicit false TRUST_PROXY value', () => {
    expect(loadConfig(validEnv({ TRUST_PROXY: 'false' })).trustProxy).toBe(false);
  });

  it('rejects an ambiguous TRUST_PROXY value', () => {
    expect(() => loadConfig(validEnv({ TRUST_PROXY: '1' }))).toThrow('TRUST_PROXY');
  });

  it('does not require integration secrets while integration flags are off', () => {
    expect(
      loadConfig(
        validEnv({
          ENABLE_GOOGLE_INTEGRATION: 'false',
          ENABLE_TELEGRAM_INTEGRATION: 'false',
          ENABLE_STRIPE_INTEGRATION: 'false',
          GOOGLE_CLIENT_ID: undefined,
          GOOGLE_CLIENT_SECRET: undefined,
          TELEGRAM_BOT_TOKEN: undefined,
          STRIPE_SECRET_KEY: undefined,
          STRIPE_WEBHOOK_SECRET: undefined,
        }),
      ),
    ).toMatchObject({
      enableGoogleIntegration: false,
      enableTelegramIntegration: false,
      enableStripeIntegration: false,
    });
  });
});
