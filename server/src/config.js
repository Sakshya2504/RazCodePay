import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '127.0.0.1',
  mongodbUri: process.env.MONGODB_URI || '',
  redisUrl: process.env.REDIS_URL || '',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  razorpayOauthClientId: process.env.RAZORPAY_OAUTH_CLIENT_ID || '',
  razorpayOauthClientSecret: process.env.RAZORPAY_OAUTH_CLIENT_SECRET || '',
  razorpayOauthRedirectUri: process.env.RAZORPAY_OAUTH_REDIRECT_URI || 'http://localhost:3000/api/integrations/razorpay/oauth/callback',
  aiApiKey: process.env.AI_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'gpt-4o-mini',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me',
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  allowedOrigin: process.env.ALLOWED_ORIGIN || 'http://127.0.0.1:5173',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || '',
  smtpPassword: process.env.SMTP_PASSWORD || '',
  mailFrom: process.env.MAIL_FROM || 'RazCodePay <no-reply@example.com>',
  demoMode: (process.env.DEMO_MODE || 'true').toLowerCase() === 'true',
};

export function validateConfiguration() {
  const warnings = [];
  if (!config.razorpayWebhookSecret && !config.demoMode) warnings.push('RAZORPAY_WEBHOOK_SECRET is required for production webhooks.');
  if (!config.aiApiKey) warnings.push('AI_API_KEY is not configured; local model remains active.');
  if (!config.mongodbUri && !config.demoMode) warnings.push('MONGODB_URI is required when DEMO_MODE=false.');
  if (!config.redisUrl && !config.demoMode) warnings.push('REDIS_URL is empty; background jobs stay disabled.');
  if (!config.smtpHost && !config.demoMode) warnings.push('SMTP is not configured; customer email actions will be suppressed.');
  if (!config.demoMode && config.jwtSecret === 'dev-only-change-me') warnings.push('JWT_SECRET must be changed before production use.');
  if (!config.demoMode && !config.encryptionKey) warnings.push('ENCRYPTION_KEY must be configured before storing provider secrets.');
  return warnings;
}
