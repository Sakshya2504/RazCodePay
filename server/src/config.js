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
  allowedOrigin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  demoMode: (process.env.DEMO_MODE || 'true').toLowerCase() === 'true',
};

export function validateConfiguration() {
  const warnings = [];
  if (!config.razorpayWebhookSecret) warnings.push('Razorpay webhook secret is not configured; signed webhooks are disabled locally.');
  if (!config.aiApiKey) warnings.push('AI_API_KEY is not configured; the local recovery model will be used.');
  if (!config.mongodbUri) warnings.push('MONGODB_URI is empty; the API will use the in-memory demo store.');
  return warnings;
}
