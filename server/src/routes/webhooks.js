import crypto from 'node:crypto';
import { IncomingEvent } from '../models/IncomingEvent.js';
import { config } from '../config.js';
import { processVerifiedEvent, createPayloadHash } from '../services/recovery.js';
import { writeAudit } from '../services/audit.js';

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left || '', 'utf8');
  const rightBuffer = Buffer.from(right || '', 'utf8');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifySignature(rawBody, signature) {
  if (!config.razorpayWebhookSecret || !signature) return false;
  const expected = crypto.createHmac('sha256', config.razorpayWebhookSecret).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}

export function registerWebhookRoutes(app) {
  app.post('/api/webhooks/razorpay', async (req, res) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
    const signature = req.get('X-Razorpay-Signature');
    const merchantId = req.get('X-RazCodePay-Merchant-Id') || 'demo-merchant';
    const payloadSha256 = createPayloadHash(rawBody);

    if (!verifySignature(rawBody, signature)) {
      await writeAudit({
        merchantId,
        eventName: 'webhook_signature_rejected',
        details: { payloadSha256 },
        actorType: 'razorpay',
      }).catch(() => undefined);
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Webhook body must be valid JSON' });
    }

    const eventType = payload.event;
    const providerEventId = payload.id || payload.event_id || null;
    if (!eventType) return res.status(400).json({ error: 'Webhook event type is required' });

    const dedupeKey = providerEventId
      ? `razorpay:${merchantId}:${providerEventId}`
      : `razorpay:${merchantId}:${eventType}:${payloadSha256}`;

    // A duplicate delivery is a normal provider behaviour, not a server error.
    const existing = await IncomingEvent.findOne({ merchantId, dedupeKey }).select('_id').lean();
    if (existing) {
      await writeAudit({
        merchantId,
        eventName: 'webhook_duplicate_ignored',
        details: { dedupeKey, eventType },
        actorType: 'razorpay',
      }).catch(() => undefined);
      return res.status(200).json({ received: true, duplicate: true, eventId: existing._id });
    }

    try {
      const result = await processVerifiedEvent({
        merchantId,
        eventType,
        providerEventId,
        payload,
        dedupeKey,
        payloadSha256,
      });

      return res.status(200).json({
        received: true,
        eventId: result.event._id,
        caseId: result.case?._id || null,
        recovered: result.recovered || false,
      });
    } catch (error) {
      console.error('Webhook processing failed:', error.message);
      return res.status(500).json({ error: 'Webhook could not be persisted' });
    }
  });
}
