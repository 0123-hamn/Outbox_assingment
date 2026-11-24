import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform(Number),
  BACKEND_URL: z.string().default('http://localhost:5000'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().default('postgresql://reachinbox_user:reachinbox_password@localhost:5432/reachinbox_db?schema=public'),
  
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379').transform(Number),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:5000/api/auth/google/callback'),

  SESSION_SECRET: z.string().default('reachinbox-default-session-secret-key-32chars'),
  JWT_SECRET: z.string().default('reachinbox-default-jwt-secret-key-32chars'),
  ENCRYPTION_KEY: z.string().default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),

  ETHEREAL_HOST: z.string().default('smtp.ethereal.email'),
  ETHEREAL_PORT: z.string().default('587').transform(Number),
  ETHEREAL_USER: z.string().optional().default(''),
  ETHEREAL_PASS: z.string().optional().default(''),

  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),

  SLACK_CLIENT_ID: z.string().optional().default(''),
  SLACK_CLIENT_SECRET: z.string().optional().default(''),
  SLACK_REDIRECT_URI: z.string().default('http://localhost:5000/api/slack/callback'),

  WORKER_CONCURRENCY: z.string().default('5').transform(Number),
  MIN_DELAY_BETWEEN_EMAILS_MS: z.string().default('2000').transform(Number),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.string().default('200').transform(Number),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables:', parsedEnv.error.format());
  throw new Error('Invalid environment configuration');
}

export const config = parsedEnv.data;
