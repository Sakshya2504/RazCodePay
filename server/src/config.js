import 'dotenv/config';

/**
 * Keep all environment access in one place. It makes configuration easy to
 * audit and prevents individual modules from silently using different defaults.
 */
export const config = {
  port: Number(process.env.PORT || 5000),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/razcodepay',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  aiApiKey: process.env.AI_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'gpt-4o-mini',
  allowedOrigin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
};

export function validateConfiguration() {
  const warnings = [];

  if (!config.razorpayWebhookSecret) {
    warnings.push('RAZORPAY_WEBHOOK_SECRET is not configured; signed webhook requests will be rejected.');
  }

  if (!config.aiApiKey) {
    warnings.push('AI_API_KEY is not configured; the decision engine will use the deterministic fallback.');
  }

  return warnings;
}
