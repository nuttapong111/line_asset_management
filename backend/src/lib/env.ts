import dotenv from 'dotenv'
import path from 'path'

// Load root .env (monorepo) then backend/.env if present
dotenv.config({ path: path.resolve(process.cwd(), '../.env') })
dotenv.config()

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '4000', 10),
  DATABASE_URL: process.env.DATABASE_URL || '',

  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Passcode used on the /link-admin screen to register a LINE account as admin
  ADMIN_SETUP_CODE: (process.env.ADMIN_SETUP_CODE || '').trim(),

  LINE_CHANNEL_ID: process.env.LINE_CHANNEL_ID || '',
  LINE_CHANNEL_SECRET: process.env.LINE_CHANNEL_SECRET || '',
  LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  LINE_LOGIN_CHANNEL_ID: process.env.LINE_LOGIN_CHANNEL_ID || '',
  LIFF_ID: process.env.LIFF_ID || '',

  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  LIFF_BASE_URL: process.env.LIFF_BASE_URL || 'http://localhost:5173',
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:4000',

  // Cloudflare R2 (S3-compatible) — primary object storage
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || '',
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
  R2_BUCKET: process.env.R2_BUCKET || '',

  // Legacy AWS S3 (optional fallback — prefer R2)
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
  AWS_BUCKET: process.env.AWS_BUCKET || '',
  AWS_REGION: process.env.AWS_REGION || 'ap-southeast-1',

  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER || '',

  DEFAULT_PROMPTPAY_NUMBER: process.env.DEFAULT_PROMPTPAY_NUMBER || '',

  // Slip verification provider (rough OCR to assist manual approval).
  // 'easyslip' uses developer.easyslip.com; anything else falls back to mock.
  SLIP_VERIFY_PROVIDER: (process.env.SLIP_VERIFY_PROVIDER || 'mock').trim().toLowerCase(),
  EASYSLIP_API_KEY: (process.env.EASYSLIP_API_KEY || '').trim(),
}

/**
 * Canonical LIFF entry URL. Opening this in LINE logs the user in and the app
 * routes by role (admin → portfolio, tenant → home, owner → dashboard).
 * Prefer building from LIFF_ID; fall back to LIFF_BASE_URL.
 */
export const liffEntryUrl = env.LIFF_ID ? `https://liff.line.me/${env.LIFF_ID}` : env.LIFF_BASE_URL

/** LINE Messaging API is configured (real mode) when these are present */
export const isLineConfigured = Boolean(env.LINE_CHANNEL_ACCESS_TOKEN && env.LINE_CHANNEL_SECRET)

/** Mock auth allowed when not in production OR when LINE Login is not configured */
export const isMockAuthAllowed = env.NODE_ENV !== 'production' || !env.LINE_LOGIN_CHANNEL_ID

/** Cloudflare R2 configured */
export const isR2Configured = Boolean(
  env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET
)

/** @deprecated use isR2Configured */
export const isS3Configured = isR2Configured

/** Twilio configured */
export const isTwilioConfigured = Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER)
