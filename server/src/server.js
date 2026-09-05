import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import { config, validateConfiguration } from './config.js';
import { initializeStore } from './store.js';
import { registerApiRoutes } from './routes/api.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerIntegrationRoutes } from './routes/integration.js';
import { processVerifiedEvent, createPayloadHash } from './services/recovery.js';
import { getRazorpayConnection } from './store.js';
import { decryptSecret } from './services/security.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.allowedOrigin, credentials: false }));
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));

app.get('/api/health', (_req, res) => res.json({ service: 'RazCodePay', status: 'ok', track: '03', port: config.port, mode: config.demoMode ? 'demo-safe' : 'production-mongodb', ai: config.aiApiKey ? 'llm-plus-local-model' : 'local-model' }));

function safeEqualHex(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex')); } catch { return false; }
}

// Each real merchant gets a dedicated webhook URL: /api/webhooks/razorpay/:merchantId.
// The merchant webhook secret is stored encrypted in MongoDB; the global secret remains a demo fallback.
app.post('/api/webhooks/razorpay/:merchantId?', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res, next) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
    const signature = req.get('X-Razorpay-Signature') || '';
    const eventId = req.get('x-razorpay-event-id') || '';
    const merchantId = req.params.merchantId || (config.demoMode ? (req.get('X-RazCodePay-Merchant-Id') || 'demo-merchant') : '');
    if (!merchantId) return res.status(400).json({ error: 'Merchant webhook route is required in production.' });

    let secret = config.razorpayWebhookSecret;
    if (!config.demoMode) {
      const connection = await getRazorpayConnection(merchantId);
      if (!connection?.encryptedWebhookSecret) return res.status(503).json({ error: 'Merchant webhook secret is not configured.' });
      secret = decryptSecret(connection.encryptedWebhookSecret);
    }
    if (!secret) return res.status(503).json({ error: 'Webhook secret is not configured.' });

    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (!safeEqualHex(expected, signature)) return res.status(401).json({ error: 'Invalid webhook signature.' });

    const payload = JSON.parse(rawBody.toString('utf8'));
    if (!payload.event) return res.status(400).json({ error: 'Webhook event is missing.' });
    const payloadSha256 = createPayloadHash(rawBody);
    const dedupeKey = eventId || `${payload.event}:${payloadSha256}`;
    const result = await processVerifiedEvent({ merchantId, eventType: payload.event, providerEventId: eventId, payload, dedupeKey, payloadSha256, signatureVerified: true });
    return res.status(result.duplicate ? 200 : 202).json(result);
  } catch (error) { return next(error); }
});

app.use(express.json({ limit: '1mb' }));
registerAuthRoutes(app);
registerIntegrationRoutes(app);
registerApiRoutes(app);

app.use((error, _req, res, _next) => {
  console.error('[API]', error);
  res.status(error.statusCode || 500).json({ error: error.message || 'Internal server error' });
});

for (const warning of validateConfiguration()) console.warn(`[config] ${warning}`);

async function start() {
  if (!config.demoMode && !config.mongodbUri) throw new Error('MONGODB_URI is required when DEMO_MODE=false.');
  const storage = await initializeStore();
  const server = app.listen(config.port, config.host, () => {
    console.log(`RazCodePay backend → http://${config.host}:${config.port}`);
    console.log(`Storage → ${storage}`);
    console.log('Razorpay webhook → POST /api/webhooks/razorpay/:merchantId');
    console.log(`AI mode → ${config.aiApiKey ? `LLM (${config.aiModel}) + local model` : 'local recovery model'}`);
  });
  const shutdown = (signal) => { console.log(`${signal} received. Closing API...`); server.close(() => process.exit(0)); };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((error) => { console.error('Server startup failed:', error.message); process.exit(1); });
