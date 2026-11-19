import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_PUBLIC_URL: z.string().url().default('http://localhost:3000'),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),

  MONGODB_URI: z.string().min(1),
  MONGODB_DB_NAME: z.string().min(1).default('kibo_dev'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  ADMIN_EMAIL: z.string().email().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_DESKTOP_CLIENT_ID: z.string().optional(),
  INTEGRATIONS_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'INTEGRATIONS_KEY must be 64 hex chars (32 bytes)')
    .optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const msg = Object.entries(flat)
      .map(([k, v]) => `  ${k}: ${(v ?? []).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${msg}`);
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvCache(): void {
  cached = null;
}
