import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(24, 'JWT_SECRET must be at least 24 characters'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:8080,http://localhost:5173'),
  PUBLIC_SITE_URL: z.string().url().default('http://localhost:8080'),
  TAX_RATE: z.coerce.number().min(0).max(1).default(0.13),
  DEPOSIT_RULE: z.enum(['one_night']).default('one_night'),
  STRIPE_ENV: z.enum(['test', 'live']).default('test'),
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  GMAIL_SMTP_HOST: z.string().optional().default('smtp.gmail.com'),
  GMAIL_SMTP_PORT: z.coerce.number().int().positive().optional().default(587),
  GMAIL_SMTP_USER: z.string().optional().default(''),
  GMAIL_SMTP_PASS: z.string().optional().default(''),
  MAIL_FROM: z.string().optional().default('curtisinn200@gmail.com'),
  HOTEL_NOTIFICATIONS_EMAIL: z.string().email().optional().default('curtisinn200@gmail.com'),
  TWILIO_ACCOUNT_SID: z.string().optional().default(''),
  TWILIO_AUTH_TOKEN: z.string().optional().default(''),
  TWILIO_MESSAGING_SERVICE_SID: z.string().optional().default(''),
  TWILIO_FROM_NUMBER: z.string().optional().default(''),
  GCS_CONTENT_BUCKET: z.string().optional().default(''),
});

export const config = envSchema.parse(process.env);

export const allowedOrigins = config.ALLOWED_ORIGINS
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const isRealSecret = (value: string) => Boolean(value && value !== 'not-configured');

export const stripeConfigured = Boolean(
  isRealSecret(config.STRIPE_SECRET_KEY) &&
  isRealSecret(config.STRIPE_WEBHOOK_SECRET),
);

export const mailConfigured = Boolean(
  isRealSecret(config.GMAIL_SMTP_USER) &&
  isRealSecret(config.GMAIL_SMTP_PASS),
);

export const twilioConfigured = Boolean(
  isRealSecret(config.TWILIO_ACCOUNT_SID) &&
  isRealSecret(config.TWILIO_AUTH_TOKEN) &&
  (isRealSecret(config.TWILIO_MESSAGING_SERVICE_SID) || isRealSecret(config.TWILIO_FROM_NUMBER)),
);
