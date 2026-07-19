import { z } from 'zod';

const requiredString = z.string().trim().min(1);
const optionalTrimmedString = z.string().trim().optional();
const envBoolean = z.enum(['true', 'false']).default('false').transform((value) => value === 'true');
const publicWebOrigin = requiredString.transform((value, context) => {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Must be a valid HTTP(S) origin' });
    return z.NEVER;
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Must be a canonical HTTP(S) origin' });
    return z.NEVER;
  }

  return url.origin;
});
const optionalHttpUrl = optionalTrimmedString.transform((value, context) => {
  if (value === undefined) return value;
  try {
    const url = new URL(value);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password || url.hash) throw new Error();
    return url.toString();
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Must be a valid HTTP(S) URL' });
    return z.NEVER;
  }
});
const optionalEncryptionKey = optionalTrimmedString.refine((value) => {
  if (value === undefined) return true;
  const decoded = /^[0-9a-f]{64}$/i.test(value) ? Buffer.from(value, 'hex') : Buffer.from(value, 'base64');
  return decoded.length === 32;
}, { message: 'Must encode exactly 32 bytes' });

const configSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    HOST: requiredString,
    PORT: z.coerce.number().int().min(1).max(65_535),
    PUBLIC_WEB_ORIGIN: publicWebOrigin,
    PUBLIC_GATEWAY_ORIGIN: publicWebOrigin.optional(),
    GOOGLE_WEBHOOK_URL: optionalHttpUrl,
    POCKETBASE_URL: requiredString.url(),
    POCKETBASE_SERVER_TOKEN: optionalTrimmedString,
    BRAIN_DUMP_MAX_TEXT_LENGTH: z.coerce.number().int().min(1).max(20_000).default(20_000),
    VOICE_MAX_BYTES: z.coerce.number().int().min(1_024).max(25_000_000).default(15_000_000),
    VOICE_MAX_DURATION_SECONDS: z.coerce.number().int().min(1).max(600).default(180),
    VOICE_TRANSCRIPTION_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(20_000),
    GEMINI_API_KEY: optionalTrimmedString,
    GEMINI_MODEL: z.string().trim().min(1).max(100).default('gemini-2.5-flash'),
    AI_TIMEOUT_MS: z.coerce.number().int().min(500).max(60_000).default(20_000),
    TRUST_PROXY: envBoolean,
    ENABLE_GOOGLE_INTEGRATION: envBoolean,
    ENABLE_TELEGRAM_INTEGRATION: envBoolean,
    ENABLE_STRIPE_INTEGRATION: envBoolean,
    GOOGLE_CLIENT_ID: optionalTrimmedString,
    GOOGLE_CLIENT_SECRET: optionalTrimmedString,
    GOOGLE_OAUTH_REDIRECT_URI: optionalHttpUrl,
    GOOGLE_TOKEN_ENCRYPTION_KEY: optionalEncryptionKey,
    TELEGRAM_BOT_TOKEN: optionalTrimmedString,
    TELEGRAM_WEBHOOK_SECRET: optionalTrimmedString,
    STRIPE_SECRET_KEY: optionalTrimmedString,
    STRIPE_WEBHOOK_SECRET: optionalTrimmedString,
  })
  .superRefine((env, context) => {
    const requireSecret = (value: string | undefined, field: string, flag: string) => {
      if (!value) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: `Required when ${flag}=true` });
      }
    };

    if (env.ENABLE_GOOGLE_INTEGRATION) {
      requireSecret(env.GOOGLE_CLIENT_ID, 'GOOGLE_CLIENT_ID', 'ENABLE_GOOGLE_INTEGRATION');
      requireSecret(env.GOOGLE_CLIENT_SECRET, 'GOOGLE_CLIENT_SECRET', 'ENABLE_GOOGLE_INTEGRATION');
      if (env.NODE_ENV === 'production') {
        requireSecret(env.GOOGLE_OAUTH_REDIRECT_URI, 'GOOGLE_OAUTH_REDIRECT_URI', 'ENABLE_GOOGLE_INTEGRATION');
        requireSecret(env.GOOGLE_TOKEN_ENCRYPTION_KEY, 'GOOGLE_TOKEN_ENCRYPTION_KEY', 'ENABLE_GOOGLE_INTEGRATION');
        requireSecret(env.PUBLIC_GATEWAY_ORIGIN, 'PUBLIC_GATEWAY_ORIGIN', 'ENABLE_GOOGLE_INTEGRATION');
        requireSecret(env.GOOGLE_WEBHOOK_URL, 'GOOGLE_WEBHOOK_URL', 'ENABLE_GOOGLE_INTEGRATION');
      }
    }

    if (env.ENABLE_TELEGRAM_INTEGRATION) {
      requireSecret(env.TELEGRAM_BOT_TOKEN, 'TELEGRAM_BOT_TOKEN', 'ENABLE_TELEGRAM_INTEGRATION');
      requireSecret(env.TELEGRAM_WEBHOOK_SECRET, 'TELEGRAM_WEBHOOK_SECRET', 'ENABLE_TELEGRAM_INTEGRATION');
    }

    if (env.ENABLE_STRIPE_INTEGRATION) {
      requireSecret(env.STRIPE_SECRET_KEY, 'STRIPE_SECRET_KEY', 'ENABLE_STRIPE_INTEGRATION');
      requireSecret(env.STRIPE_WEBHOOK_SECRET, 'STRIPE_WEBHOOK_SECRET', 'ENABLE_STRIPE_INTEGRATION');
    }

    if (env.NODE_ENV === 'production') {
      requireSecret(env.GEMINI_API_KEY, 'GEMINI_API_KEY', 'NODE_ENV=production');
    }
  })
  .transform((env) => ({
    nodeEnv: env.NODE_ENV,
    host: env.HOST,
    port: env.PORT,
    publicWebOrigin: env.PUBLIC_WEB_ORIGIN,
    publicGatewayOrigin: env.PUBLIC_GATEWAY_ORIGIN,
    googleWebhookUrl: env.GOOGLE_WEBHOOK_URL,
    pocketbaseUrl: env.POCKETBASE_URL,
    pocketbaseServerToken: env.POCKETBASE_SERVER_TOKEN,
    brainDumpMaxTextLength: env.BRAIN_DUMP_MAX_TEXT_LENGTH,
    voiceMaxBytes: env.VOICE_MAX_BYTES,
    voiceMaxDurationSeconds: env.VOICE_MAX_DURATION_SECONDS,
    voiceTranscriptionTimeoutMs: env.VOICE_TRANSCRIPTION_TIMEOUT_MS,
    geminiApiKey: env.GEMINI_API_KEY,
    geminiModel: env.GEMINI_MODEL,
    aiTimeoutMs: env.AI_TIMEOUT_MS,
    trustProxy: env.TRUST_PROXY,
    enableGoogleIntegration: env.ENABLE_GOOGLE_INTEGRATION,
    enableTelegramIntegration: env.ENABLE_TELEGRAM_INTEGRATION,
    enableStripeIntegration: env.ENABLE_STRIPE_INTEGRATION,
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    googleOAuthRedirectUri: env.GOOGLE_OAUTH_REDIRECT_URI,
    googleTokenEncryptionKey: env.GOOGLE_TOKEN_ENCRYPTION_KEY,
    telegramBotToken: env.TELEGRAM_BOT_TOKEN,
    telegramWebhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
    stripeSecretKey: env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
  }));

export type GatewayConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const parsed = configSchema.safeParse(env);

  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).filter(Boolean).join(', ');
    throw new Error(`Invalid gateway configuration: ${fields}`);
  }

  return parsed.data;
}
