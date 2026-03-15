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
};

module.exports = { env };
