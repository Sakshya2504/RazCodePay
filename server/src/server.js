import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { config, validateConfiguration } from './config.js';
import { registerApiRoutes } from './routes/api.js';
import { processVerifiedEvent, createPayloadHash } from './services/recovery.js';

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: config.allowedOrigin }));
app.get('/api/health', (_req, res) => res.json({ service: 'RazCodePay', status: 'ok', track: '03', port: config.port, mode: config.demoMode ? 'demo-safe' : 'configured' }));

function timingSafeEqualHex(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right)); } catch { return false; }
}

app.post('/api/webhooks/razorpay', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res, next) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
    const signature = req.get('X-Razorpay-Signature') || '';
    const eventId = req.get('x-razorpay-event-id') || '';
    const merchantId = req.get('X-RazCodePay-Merchant-Id') || 'demo-merchant';

    if (!config.razorpayWebhookSecret) return res.status(503).json({ error: 'Webhook secret is not configured in this environment.' });
    const expected = crypto.createHmac('sha256', config.razorpayWebhookSecret).update(rawBody).digest('hex');
    if (!timingSafeEqualHex(expected, signature)) return res.status(401).json({ error: 'Invalid webhook signature.' });

    const payload = JSON.parse(rawBody.toString('utf8'));
    const eventType = payload.event;
    if (!eventType) return res.status(400).json({ error: 'Webhook event is missing.' });

    const dedupeKey = eventId || `${eventType}:${createPayloadHash(rawBody)}`;
    const result = await processVerifiedEvent({ merchantId, eventType, providerEventId: eventId, payload, dedupeKey, payloadSha256: createPayloadHash(rawBody) });
    return res.status(result.duplicate ? 200 : 202).json(result);
  } catch (error) {
    return next(error);
  }
});

app.use(express.json({ limit: '1mb' }));
registerApiRoutes(app);

app.use((error, _req, res, _next) => {
  console.error('[API]', error);
  res.status(500).json({ error: 'Internal server error', message: config.demoMode ? error.message : undefined });
});

for (const warning of validateConfiguration()) console.warn(`[config] ${warning}`);

const server = app.listen(config.port, config.host, () => {
  console.log(`RazCodePay backend → http://${config.host}:${config.port}`);
  console.log('Razorpay webhook → POST /api/webhooks/razorpay');
  console.log(`AI mode → ${config.aiApiKey ? `LLM (${config.aiModel}) + local guardrail model` : 'local recovery model (no API key required)'}`);
});

function shutdown(signal) {
  console.log(`${signal} received. Closing API...`);
  server.close(() => process.exit(0));
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
