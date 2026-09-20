import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname, '../../../..');

// APP_ENV selects which environment file to load: local | dev | production.
// Precedence: process.env.APP_ENV → NODE_ENV mapping → 'local'.
const APP_ENV = (process.env['APP_ENV'] ?? 'local') as 'local' | 'dev' | 'production';

// Load the environment-specific file first, then fall back to the base .env.
config({ path: resolve(rootDir, `.env.${APP_ENV}`) });
config({ path: resolve(rootDir, '.env') });

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key} (APP_ENV=${APP_ENV})`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

// Storage driver switches automatically based on APP_ENV, but can be
// overridden explicitly with STORAGE_DRIVER.
const defaultStorageDriver = APP_ENV === 'local' ? 'disk' : 's3';

export const env = {
  APP_ENV,
  NODE_ENV: optional('NODE_ENV', APP_ENV === 'production' ? 'production' : 'development') as
    | 'development'
    | 'production'
    | 'test',
  isProduction: APP_ENV === 'production',
  isLocal: APP_ENV === 'local',

  // App Runner / many PaaS inject PORT — prefer it, then API_PORT, then 4000.
  API_PORT: parseInt(optional('PORT', optional('API_PORT', '4000')), 10),
  API_HOST: optional('API_HOST', 'http://localhost:4000'),

  DATABASE_URL: required('DATABASE_URL'),

  JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRES_IN: optional('JWT_ACCESS_EXPIRES_IN', '1h'),
  JWT_REFRESH_EXPIRES_IN: optional('JWT_REFRESH_EXPIRES_IN', '16h'),

  CORS_ORIGINS: optional('CORS_ORIGINS', 'http://localhost:5173,http://localhost:5174').split(','),

  // Auth cookie behaviour. For cross-site frontends (different parent domain
  // than the API) set COOKIE_SAMESITE=none and COOKIE_SECURE=true.
  COOKIE_SAMESITE: optional('COOKIE_SAMESITE', APP_ENV === 'local' ? 'lax' : 'lax') as
    | 'lax'
    | 'strict'
    | 'none',
  COOKIE_SECURE: optional('COOKIE_SECURE', APP_ENV === 'local' ? 'false' : 'true') === 'true',

  // ─── Storage ──────────────────────────────────────────────
  STORAGE_DRIVER: optional('STORAGE_DRIVER', defaultStorageDriver) as 'disk' | 's3',
  // disk driver (local)
  UPLOAD_DIR: optional('UPLOAD_DIR', resolve(rootDir, 'uploads')),
  PUBLIC_UPLOAD_BASE_URL: optional('PUBLIC_UPLOAD_BASE_URL', 'http://localhost:4000/uploads'),
  // s3 driver (dev / production)
  S3_REGION: optional('S3_REGION', 'us-west-2'),
  S3_BUCKET: optional('S3_BUCKET', optional('MINIO_BUCKET', 'mkelectric-media')),
  S3_ACCESS_KEY: optional('S3_ACCESS_KEY', ''),
  S3_SECRET_KEY: optional('S3_SECRET_KEY', ''),
  S3_ENDPOINT: optional('S3_ENDPOINT', ''), // blank = real AWS S3
  S3_PUBLIC_BASE_URL: optional('S3_PUBLIC_BASE_URL', ''), // CloudFront URL in prod

  // ─── Email (SES) ──────────────────────────────────────────
  EMAIL_DRIVER: optional('EMAIL_DRIVER', APP_ENV === 'local' ? 'console' : 'ses') as 'console' | 'ses',
  EMAIL_FROM: optional('EMAIL_FROM', 'noreply@mkelectric.com'),
  EMAIL_FROM_NAME: optional('EMAIL_FROM_NAME', 'KinamNepal'),
  // Base URL of the API itself — verification links point back here.
  VERIFY_REDIRECT_WEB: optional('VERIFY_REDIRECT_WEB', 'http://localhost:5173'),
  VERIFY_REDIRECT_SELLER: optional('VERIFY_REDIRECT_SELLER', 'http://localhost:5175'),

  // ─── Store settings ───────────────────────────────────────
  STORE_NAME: optional('STORE_NAME', 'KinamNepal'),
  STORE_CURRENCY: optional('STORE_CURRENCY', 'NPR'),
  STORE_LOW_STOCK_THRESHOLD: parseInt(optional('STORE_LOW_STOCK_THRESHOLD', '5'), 10),

  // ─── Payment options ────────────────────────────────────────────────────
  //  NOTE: these are SAMPLE / DEVELOPER values. Replace with real merchant
  //  details from your bank + eSewa/Khalti merchant accounts before going live.
  PAY_ESEWA_ID: optional('PAY_ESEWA_ID', '9800000000'),
  PAY_KHALTI_ID: optional('PAY_KHALTI_ID', '9800000000'),
  PAY_BANK_NAME: optional('PAY_BANK_NAME', 'SAMPLE Bank (dev)'),
  PAY_BANK_ACCOUNT_NAME: optional('PAY_BANK_ACCOUNT_NAME', 'KinamNepal Pvt. Ltd. (SAMPLE)'),
  PAY_BANK_ACCOUNT_NUMBER: optional('PAY_BANK_ACCOUNT_NUMBER', '0000000000000000'),
  PAY_BANK_BRANCH: optional('PAY_BANK_BRANCH', 'Pokhara'),
  PAY_FONEPAY_ID: optional('PAY_FONEPAY_ID', '9800000000'),

  // NepalPay / Fonepay merchant QR (bank-issued). SAMPLE merchant PAN + name.
  PAY_NEPALPAY_MERCHANT_ID: optional('PAY_NEPALPAY_MERCHANT_ID', '9779800000000'),
  PAY_MERCHANT_CITY: optional('PAY_MERCHANT_CITY', 'Pokhara'),

  // eSewa hosted checkout (ePay). Public SANDBOX values from eSewa docs.
  ESEWA_MERCHANT_CODE: optional('ESEWA_MERCHANT_CODE', 'EPAYTEST'),
  ESEWA_ENV: optional('ESEWA_ENV', 'sandbox') as 'sandbox' | 'production',
  // Production HMAC secret (provided by eSewa on merchant onboarding).
  ESEWA_SECRET_KEY: optional('ESEWA_SECRET_KEY', 'REPLACE_WITH_REAL_ESEWA_SECRET'),

  // Khalti hosted checkout. SANDBOX test key placeholder (replace with real key).
  KHALTI_ENV: optional('KHALTI_ENV', 'sandbox') as 'sandbox' | 'production',
  KHALTI_SECRET_KEY: optional('KHALTI_SECRET_KEY', 'test_secret_key_dev_placeholder'),

  // Where the provider returns the customer after paying (frontend origin).
  PAYMENT_RETURN_URL: optional('PAYMENT_RETURN_URL', 'http://localhost:5173'),
} as const;
