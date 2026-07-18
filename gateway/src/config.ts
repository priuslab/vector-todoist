import { z } from 'zod';

const requiredString = z.string().trim().min(1);
const envBoolean = z.enum(['true', 'false']).default('false').transform((value) => value === 'true');

const configSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    HOST: requiredString,
    PORT: z.coerce.number().int().min(1).max(65_535),
    PUBLIC_WEB_ORIGIN: requiredString.url(),
    POCKETBASE_URL: requiredString.url(),
    TRUST_PROXY: envBoolean,
    ENABLE_GOOGLE_INTEGRATION: envBoolean,
    ENABLE_TELEGRAM_INTEGRATION: envBoolean,
    ENABLE_STRIPE_INTEGRATION: envBoolean,
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
    STRIPE_SECRET_KEY: z.string().min(1).optional(),
    STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  })
  .superRefine((env, context) => {
    if (env.ENABLE_GOOGLE_INTEGRATION && (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['GOOGLE_CLIENT_ID'], message: 'Required when ENABLE_GOOGLE_INTEGRATION=true' });
    }

    if (env.ENABLE_TELEGRAM_INTEGRATION && !env.TELEGRAM_BOT_TOKEN) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['TELEGRAM_BOT_TOKEN'], message: 'Required when ENABLE_TELEGRAM_INTEGRATION=true' });
    }

    if (env.ENABLE_STRIPE_INTEGRATION && (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['STRIPE_SECRET_KEY'], message: 'Required when ENABLE_STRIPE_INTEGRATION=true' });
    }
  })
  .transform((env) => ({
    nodeEnv: env.NODE_ENV,
    host: env.HOST,
    port: env.PORT,
    publicWebOrigin: env.PUBLIC_WEB_ORIGIN,
    pocketbaseUrl: env.POCKETBASE_URL,
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
