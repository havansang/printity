const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().trim().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().trim().min(10, 'JWT_SECRET must be at least 10 characters'),
  JWT_EXPIRES_IN: z.string().trim().min(1).default('7d'),
  CLIENT_URL: z.string().trim().min(1).default('http://localhost:5173'),
  UPLOAD_DIR: z.string().trim().min(1).default('uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().positive().default(10),
  GOOGLE_CLIENT_ID: z.string().trim().optional().default(''),
  PUBLIC_BASE_URL: z.string().trim().optional().default(''),
  SMTP_HOST: z.string().trim().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_SECURE: z
    .preprocess((value) => {
      if (typeof value === 'boolean') {
        return value;
      }

      if (typeof value === 'string') {
        return value.toLowerCase() === 'true';
      }

      return value;
    }, z.boolean())
    .default(true),
  SMTP_USER: z.string().trim().optional().default(''),
  SMTP_PASSWORD: z.string().trim().optional().default(''),
  SMTP_FROM: z.string().trim().optional().default(''),
  PASSWORD_RESET_SECRET: z.string().trim().optional().default(''),
  PASSWORD_RESET_OTP_TTL_MINUTES: z.coerce.number().int().min(3).max(10).default(5),
  PASSWORD_RESET_OTP_COOLDOWN_SECONDS: z.coerce.number().int().min(10).max(120).default(30),
  PASSWORD_RESET_OTP_MAX_SENDS_PER_WINDOW: z.coerce.number().int().min(1).max(20).default(5),
  PASSWORD_RESET_OTP_WINDOW_MINUTES: z.coerce.number().int().min(1).max(60).default(10),
  PASSWORD_RESET_OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  PASSWORD_RESET_RESET_TOKEN_TTL_MINUTES: z.coerce.number().int().min(5).max(30).default(10),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Invalid environment configuration\n${issues.join('\n')}`);
}

const env = {
  ...parsedEnv.data,
  GOOGLE_CLIENT_ID: parsedEnv.data.GOOGLE_CLIENT_ID || null,
  PUBLIC_BASE_URL: parsedEnv.data.PUBLIC_BASE_URL || null,
  SMTP_USER: parsedEnv.data.SMTP_USER || null,
  SMTP_PASSWORD: parsedEnv.data.SMTP_PASSWORD || null,
  SMTP_FROM: parsedEnv.data.SMTP_FROM || null,
  PASSWORD_RESET_SECRET: parsedEnv.data.PASSWORD_RESET_SECRET || parsedEnv.data.JWT_SECRET,
};

module.exports = { env };
