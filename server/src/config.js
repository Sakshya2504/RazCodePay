import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '127.0.0.1',
  mongodbUri: process.env.MONGODB_URI || '',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  aiApiKey: process.env.AI_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'gpt-4o-mini',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me',
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  allowedOrigin: process.env.ALLOWED_ORIGIN || 'http://127.0.0.1:5173',
  demoMode: (process.env.DEMO_MODE || 'true').toLowerCase() === 'true',
};

export function validateConfiguration() {
  const warnings = [];
  if (!config.razorpayWebhookSecret) warnings.push('Razorpay webhook secret is not configured.');
  if (!config.aiApiKey) warnings.push('AI_API_KEY is not configured; local model remains active.');
  if (!config.mongodbUri) warnings.push('MONGODB_URI is empty; the application will use safe demo storage.');
  if (!config.demoMode && config.jwtSecret === 'dev-only-change-me') warnings.push('JWT_SECRET must be changed before production use.');
  if (!config.demoMode && !config.encryptionKey) warnings.push('ENCRYPTION_KEY must be configured before storing provider secrets.');
  return warnings;
}
