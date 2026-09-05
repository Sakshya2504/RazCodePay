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
  const isSubscriptionEvent = eventType.startsWith('subscription.');
  const isInvoiceEvent = eventType.startsWith('invoice.');

  return {
    type: isInvoiceEvent ? 'invoice_overdue' : 'failed_subscription',
    amountMinor,
    currency: entity.currency || 'INR',
    customerId: entity.customer_id || null,
    providerEntityId: entity.id || null,
    providerEntityType: eventType.split('.')[0],
    providerOrderId: entity.order_id || payload?.payload?.payment?.entity?.order_id || null,
    providerSubscriptionId: entity.subscription_id || (isSubscriptionEvent ? entity.id : null),
    providerInvoiceId: entity.invoice_id || (isInvoiceEvent ? entity.id : null),
    failureCode: entity.error_code || entity.error?.code || null,
    failureDescription: entity.error_description || entity.error?.description || null,
  };
}

function shouldOpenRecoveryCase(eventType) {
  return ['payment.failed', 'subscription.pending', 'subscription.halted', 'invoice.issued'].includes(eventType);
}

function caseKeyFor(data) {
  if (data.type === 'invoice_overdue') return `invoice:${data.providerInvoiceId || data.providerEntityId}`;
  return `subscription:${data.providerSubscriptionId || data.providerOrderId || data.providerEntityId}`;
}

function isRecoverySuccess(eventType) {
  return ['payment.captured', 'order.paid', 'subscription.charged', 'invoice.paid'].includes(eventType);
}

/**
 * Turns one verified provider event into a durable event plus an updated case.
 * Money is never inferred from the UI; recovery is confirmed by a later provider signal.
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
    const entityIds = [data.providerEntityId, data.providerOrderId, data.providerSubscriptionId, data.providerInvoiceId].filter(Boolean);
    const openCase = await RecoveryCase.findOne({
      merchantId,
      state: { $nin: ['recovered', 'stopped', 'expired'] },
      $or: [
        { providerEntityId: { $in: entityIds } },
        { providerOrderId: { $in: entityIds } },
        { providerSubscriptionId: { $in: entityIds } },
        { providerInvoiceId: { $in: entityIds } },
      ],
    }).sort({ openedAt: -1 });

    if (openCase) {
      openCase.state = 'recovered';
      openCase.recoveredAmountMinor = data.amountMinor || openCase.amountMinor;
      openCase.recoveredProviderId = data.providerEntityId || data.providerOrderId || data.providerSubscriptionId || data.providerInvoiceId;
      openCase.closedAt = new Date();
      openCase.nextActionAt = null;
      openCase.stopReason = null;
      await openCase.save();

      await writeAudit({
        merchantId,
        caseId: openCase._id,
        eventName: 'case_recovered',
        details: { eventType, providerIds: entityIds, recoveredAmountMinor: openCase.recoveredAmountMinor },
      });
    }

    await IncomingEvent.findByIdAndUpdate(event._id, { processingStatus: 'processed' });
    return { event, case: openCase, recovered: Boolean(openCase) };
  }

  if (!shouldOpenRecoveryCase(eventType) || !data.type || data.amountMinor <= 0) {
    await IncomingEvent.findByIdAndUpdate(event._id, { processingStatus: 'processed' });
    return { event, case: null, ignored: true };
  }

  const caseKey = caseKeyFor(data);
  let recoveryCase = await RecoveryCase.findOne({ merchantId, caseKey });

  if (!recoveryCase) {
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
      providerOrderId: data.providerOrderId,
      providerSubscriptionId: data.providerSubscriptionId,
      providerInvoiceId: data.providerInvoiceId,
      failureCode: data.failureCode,
      failureDescription: data.failureDescription,
      // This is a demo assumption. A production adapter must read consent from the merchant's source of truth.
      consent: { email: true, sms: false, whatsapp: false },
      nextActionAt: new Date(Date.now() + 30 * 60 * 1000),
      openedAt: occurredAt,
    });

    await writeAudit({
      merchantId,
      caseId: recoveryCase._id,
      eventName: 'case_created',
      details: { eventType, caseKey, amountMinor: data.amountMinor },
    });
  } else if (recoveryCase.state === 'recovered') {
    await IncomingEvent.findByIdAndUpdate(event._id, { processingStatus: 'processed' });
    return { event, case: recoveryCase, ignored: true };
  }

  recoveryCase.failureCode = data.failureCode || recoveryCase.failureCode;
  recoveryCase.failureDescription = data.failureDescription || recoveryCase.failureDescription;
  await recoveryCase.save();

  await IncomingEvent.findByIdAndUpdate(event._id, { processingStatus: 'processed' });
  return { event, case: recoveryCase, recovered: false };
}

export async function evaluateCase(recoveryCase) {
  const policy = evaluatePolicy(recoveryCase);

  if (policy.allowedActions.length === 0) {
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
