import crypto from 'node:crypto';
import { IncomingEvent } from '../models/IncomingEvent.js';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { evaluatePolicy } from './policy.js';
import { recommendRecoveryAction } from './decisionEngine.js';
import { writeAudit } from './audit.js';

function getRazorpayEntity(payload) {
  const root = payload?.payload || {};
  return root.payment?.entity || root.subscription?.entity || root.invoice?.entity || root.order?.entity || {};
}

function extractCanonicalData(eventType, payload) {
  const entity = getRazorpayEntity(payload);
  const amountMinor = Number(entity.amount || entity.total_amount || 0);
  const providerEntityId = entity.id || entity.payment_id || null;

  let type = null;
  if (eventType.startsWith('payment.') || eventType.startsWith('subscription.')) {
    type = entity.subscription_id || payload?.payload?.subscription ? 'failed_subscription' : 'failed_subscription';
  } else if (eventType.startsWith('invoice.')) {
    type = 'invoice_overdue';
  }

  return {
    type,
    amountMinor,
    currency: entity.currency || 'INR',
    customerId: entity.customer_id || entity.email || null,
    providerEntityId,
    providerEntityType: entity.type || eventType.split('.')[0],
    failureCode: entity.error_code || entity.error?.code || null,
    failureDescription: entity.error_description || entity.error?.description || null,
    subscriptionId: entity.subscription_id || null,
    invoiceId: entity.invoice_id || null,
    orderId: entity.order_id || null,
  };
}

function caseKeyFor(data) {
  if (data.type === 'invoice_overdue') {
    return `invoice:${data.invoiceId || data.providerEntityId}`;
  }

  return `subscription:${data.subscriptionId || data.orderId || data.providerEntityId}`;
}

function isRecoverySuccess(eventType) {
  return ['payment.captured', 'order.paid', 'subscription.charged', 'invoice.paid'].includes(eventType);
}

/**
 * Turns a verified provider event into one durable case. The event itself is
 * never treated as the case state; cases are mutable projections of events.
 */
export async function processVerifiedEvent({ merchantId, eventType, providerEventId, payload, dedupeKey, payloadSha256 }) {
  const occurredAt = payload?.created_at ? new Date(payload.created_at * 1000) : new Date();

  const event = await IncomingEvent.create({
    merchantId,
    source: 'razorpay',
    eventType,
    providerEventId,
    dedupeKey,
    payloadSha256,
    signatureVerified: true,
    payload,
    occurredAt,
  });

  const data = extractCanonicalData(eventType, payload);

  if (isRecoverySuccess(eventType)) {
    const providerId = data.providerEntityId;
    const query = providerId
      ? { merchantId, $or: [{ providerEntityId: providerId }, { recoveredProviderId: providerId }] }
      : { merchantId, state: { $in: ['detected', 'enriched', 'awaiting_window', 'planned', 'executing', 'monitoring'] } };

    const openCase = await RecoveryCase.findOne({ ...query, state: { $ne: 'recovered' } }).sort({ openedAt: -1 });
    if (openCase) {
      openCase.state = 'recovered';
      openCase.recoveredAmountMinor = data.amountMinor || openCase.amountMinor;
      openCase.recoveredProviderId = providerId;
      openCase.closedAt = new Date();
      openCase.nextActionAt = null;
      openCase.stopReason = null;
      await openCase.save();

      await writeAudit({
        merchantId,
        caseId: openCase._id,
        eventName: 'case_recovered',
        details: { eventType, providerId, recoveredAmountMinor: openCase.recoveredAmountMinor },
      });
    }

    return { event, case: openCase, recovered: Boolean(openCase) };
  }

  if (!data.type || data.amountMinor <= 0) {
    await IncomingEvent.findByIdAndUpdate(event._id, { processingStatus: 'processed' });
    return { event, case: null, ignored: true };
  }

  const caseKey = caseKeyFor(data);
  let recoveryCase = await RecoveryCase.findOne({ merchantId, caseKey });

  if (!recoveryCase) {
    const nextActionAt = new Date(Date.now() + 30 * 60 * 1000);
    recoveryCase = await RecoveryCase.create({
      merchantId,
      caseKey,
      type: data.type,
      state: 'awaiting_window',
      amountMinor: data.amountMinor,
      currency: data.currency,
      customerId: data.customerId,
      providerEntityId: data.providerEntityId,
      providerEntityType: data.providerEntityType,
      failureCode: data.failureCode,
      failureDescription: data.failureDescription,
      consent: { email: true, sms: false, whatsapp: false },
      nextActionAt,
      openedAt: occurredAt,
    });

    await writeAudit({
      merchantId,
      caseId: recoveryCase._id,
      eventName: 'case_created',
      details: { eventType, caseKey, amountMinor: data.amountMinor },
    });
  }

  if (data.failureCode || data.failureDescription) {
    recoveryCase.failureCode = data.failureCode || recoveryCase.failureCode;
    recoveryCase.failureDescription = data.failureDescription || recoveryCase.failureDescription;
    await recoveryCase.save();
  }

  await IncomingEvent.findByIdAndUpdate(event._id, { processingStatus: 'processed' });
  return { event, case: recoveryCase, recovered: false };
}

export async function evaluateCase(recoveryCase) {
  const policy = evaluatePolicy(recoveryCase);

  if (policy.allowedActions.length === 0) {
    recoveryCase.state = recoveryCase.state === 'detected' ? 'planned' : recoveryCase.state;
    recoveryCase.explanation = policy.reasons.join(', ');
    await recoveryCase.save();
    return { case: recoveryCase, policy, decision: null };
  }

  const decision = await recommendRecoveryAction(recoveryCase, policy.allowedActions);
  recoveryCase.state = decision.recommendedAction === 'wait' ? 'awaiting_window' : 'planned';
  recoveryCase.explanation = `${decision.recommendedAction} selected because ${decision.reasonCodes.join(', ')}.`;
  recoveryCase.riskScore = recoveryCase.riskScore ?? calculateRiskScore(recoveryCase);
  recoveryCase.recoverabilityScore = recoveryCase.recoverabilityScore ?? calculateRecoverabilityScore(recoveryCase);
  await recoveryCase.save();

  await writeAudit({
    merchantId: recoveryCase.merchantId,
    caseId: recoveryCase._id,
    eventName: 'recovery_decision_created',
    details: { decision, policyReasons: policy.reasons },
  });

  return { case: recoveryCase, policy, decision };
}

// These baseline scores are intentionally transparent. The Python ML service
// can replace them later without changing the policy or case lifecycle.
function calculateRiskScore(caseData) {
  let score = 0.45;
  if (caseData.failureCode) score += 0.12;
  if (caseData.amountMinor >= 100000) score += 0.18;
  if (caseData.attemptCount > 0) score += 0.1;
  return Math.min(1, score);
}

function calculateRecoverabilityScore(caseData) {
  let score = 0.5;
  if (caseData.consent?.email) score += 0.18;
  if (caseData.attemptCount === 0) score += 0.14;
  if (caseData.failureCode && ['BAD_REQUEST_ERROR', 'payment_failed'].includes(caseData.failureCode)) score += 0.05;
  return Math.min(1, score);
}

export function createPayloadHash(rawBody) {
  return crypto.createHash('sha256').update(rawBody).digest('hex');
}
