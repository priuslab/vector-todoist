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

const configSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    HOST: requiredString,
    PORT: z.coerce.number().int().min(1).max(65_535),
    PUBLIC_WEB_ORIGIN: publicWebOrigin,
    POCKETBASE_URL: requiredString.url(),
    BRAIN_DUMP_MAX_TEXT_LENGTH: z.coerce.number().int().min(1).max(20_000).default(20_000),
    TRUST_PROXY: envBoolean,
    ENABLE_GOOGLE_INTEGRATION: envBoolean,
    ENABLE_TELEGRAM_INTEGRATION: envBoolean,
    ENABLE_STRIPE_INTEGRATION: envBoolean,
    GOOGLE_CLIENT_ID: optionalTrimmedString,
    GOOGLE_CLIENT_SECRET: optionalTrimmedString,
    TELEGRAM_BOT_TOKEN: optionalTrimmedString,
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
    }

    if (env.ENABLE_TELEGRAM_INTEGRATION) {
      requireSecret(env.TELEGRAM_BOT_TOKEN, 'TELEGRAM_BOT_TOKEN', 'ENABLE_TELEGRAM_INTEGRATION');
    }

    if (env.ENABLE_STRIPE_INTEGRATION) {
      requireSecret(env.STRIPE_SECRET_KEY, 'STRIPE_SECRET_KEY', 'ENABLE_STRIPE_INTEGRATION');
      requireSecret(env.STRIPE_WEBHOOK_SECRET, 'STRIPE_WEBHOOK_SECRET', 'ENABLE_STRIPE_INTEGRATION');
    }
  })
  .transform((env) => ({
    nodeEnv: env.NODE_ENV,
    host: env.HOST,
    port: env.PORT,
    publicWebOrigin: env.PUBLIC_WEB_ORIGIN,
    pocketbaseUrl: env.POCKETBASE_URL,
    brainDumpMaxTextLength: env.BRAIN_DUMP_MAX_TEXT_LENGTH,
    trustProxy: env.TRUST_PROXY,
    enableGoogleIntegration: env.ENABLE_GOOGLE_INTEGRATION,
    enableTelegramIntegration: env.ENABLE_TELEGRAM_INTEGRATION,
    enableStripeIntegration: env.ENABLE_STRIPE_INTEGRATION,
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    telegramBotToken: env.TELEGRAM_BOT_TOKEN,
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
