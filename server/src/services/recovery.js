import crypto from 'node:crypto';
import { addCase, getCase, updateCase, listCases, recordEvent, markEventStatus, summarize } from '../store.js';
import { evaluatePolicy } from './policy.js';
import { recommendRecoveryAction } from './decisionEngine.js';
import { writeAudit } from './audit.js';

const FAILURE_EVENTS = new Set(['payment.failed', 'subscription.pending', 'subscription.halted', 'invoice.issued']);
const SUCCESS_EVENTS = new Set(['payment.captured', 'order.paid', 'subscription.charged', 'invoice.paid']);

export function createPayloadHash(rawBody) { return crypto.createHash('sha256').update(rawBody).digest('hex'); }
function entityFrom(payload) { const root = payload?.payload || {}; return root.payment?.entity || root.subscription?.entity || root.invoice?.entity || root.order?.entity || {}; }
function canonical(eventType, payload) {
  const entity = entityFrom(payload);
  const invoice = eventType.startsWith('invoice.');
  const subscription = eventType.startsWith('subscription.');
  return {
    type: invoice ? 'invoice_overdue' : eventType.startsWith('order.') ? 'checkout_abandonment' : 'failed_subscription',
    amountMinor: Number(entity.amount || entity.total_amount || 0),
    currency: entity.currency || 'INR',
    customer: { id: entity.customer_id || null, name: entity.customer_details?.customer_name || entity.customer_details?.name || null, email: entity.email || entity.customer_details?.customer_email || null, contact: entity.contact || entity.customer_details?.customer_contact || null },
    provider: { entityId: entity.id || null, entityType: eventType.split('.')[0], orderId: entity.order_id || (eventType.startsWith('order.') ? entity.id : null), subscriptionId: entity.subscription_id || (subscription ? entity.id : null), invoiceId: entity.invoice_id || (invoice ? entity.id : null) },
    failure: { code: entity.error_code || entity.error?.code || null, description: entity.error_description || entity.error?.description || null },
  };
}

export async function processVerifiedEvent({ merchantId = 'demo-merchant', eventType, providerEventId, payload, dedupeKey, payloadSha256, signatureVerified = false }) {
  const inserted = await recordEvent(dedupeKey, { merchantId, providerEventId, eventType, dedupeKey, payloadSha256, payload, signatureVerified, processingStatus: 'received', occurredAt: payload?.created_at ? new Date(payload.created_at * 1000) : new Date() });
  if (!inserted) return { duplicate: true, recovered: false, eventId: providerEventId || dedupeKey };

  try {
    const data = canonical(eventType, payload);
    if (SUCCESS_EVENTS.has(eventType)) {
      const cases = await listCases(merchantId);
      const ids = new Set([data.provider.entityId, data.provider.orderId, data.provider.subscriptionId, data.provider.invoiceId].filter(Boolean));
      const current = cases.find((item) => [item.provider?.entityId, item.provider?.orderId, item.provider?.subscriptionId, item.provider?.invoiceId].some((id) => ids.has(id)) && !['recovered', 'stopped', 'expired'].includes(item.state));
      if (!current) {
        await markEventStatus(dedupeKey, 'ignored');
        return { recovered: false, ignored: true, eventId: providerEventId || dedupeKey };
      }
      const updated = await updateCase(merchantId, current.id, { state: 'recovered', recoveredAmountMinor: data.amountMinor || current.amountMinor, recoveredProviderId: data.provider.entityId || data.provider.orderId || data.provider.subscriptionId || data.provider.invoiceId, nextActionAt: null, closedAt: new Date(), stopReason: null, explanation: `Recovered from verified Razorpay event: ${eventType}.` });
      await writeAudit({ merchantId, caseId: current.id, actorType: 'razorpay', eventName: 'case_recovered', details: { eventType, providerEventId, amountMinor: updated.recoveredAmountMinor } });
      await markEventStatus(dedupeKey, 'processed');
      return { recovered: true, caseId: current.id, eventId: providerEventId || dedupeKey };
    }

    if (!FAILURE_EVENTS.has(eventType) || data.amountMinor <= 0) {
      await markEventStatus(dedupeKey, 'ignored');
      return { recovered: false, ignored: true, eventId: providerEventId || dedupeKey };
    }

    const cases = await listCases(merchantId);
    const caseKey = `${data.provider.invoiceId || data.provider.subscriptionId || data.provider.orderId || data.provider.entityId}:${data.type}`;
    let current = cases.find((item) => item.caseKey === caseKey || item.provider?.entityId === data.provider.entityId);
    if (!current) {
      current = await addCase(merchantId, { caseKey, type: data.type, state: 'awaiting_window', amountMinor: data.amountMinor, currency: data.currency, customer: data.customer, provider: data.provider, failure: data.failure, consent: { email: Boolean(data.customer.email), sms: false, whatsapp: false }, attemptCount: 0, attempts: [], riskScore: null, recoverabilityScore: null, ai: null, nextActionAt: new Date(Date.now() + 30 * 60000), recoveredAmountMinor: 0, recoveredProviderId: null, openedAt: new Date() });
      await writeAudit({ merchantId, caseId: current.id, actorType: 'razorpay', eventName: 'case_created_from_webhook', details: { eventType, caseKey, amountMinor: data.amountMinor } });
    } else {
      current = await updateCase(merchantId, current.id, { failure: { ...current.failure, ...data.failure } });
    }
    await markEventStatus(dedupeKey, 'processed');
    return { recovered: false, caseId: current.id, eventId: providerEventId || dedupeKey };
  } catch (error) {
    await markEventStatus(dedupeKey, 'failed', error.message).catch(() => {});
    throw error;
  }
}

export async function evaluateCase(merchantId, caseId) {
  const current = await getCase(merchantId, caseId);
  if (!current) throw new Error('Recovery case not found');
  const policy = evaluatePolicy(current);
  const decision = policy.allowedActions.length ? await recommendRecoveryAction(current, policy.allowedActions) : null;
  const updated = await updateCase(merchantId, caseId, { riskScore: decision?.riskScore ?? current.riskScore, recoverabilityScore: decision?.recoverabilityScore ?? current.recoverabilityScore, ai: decision, explanation: decision?.explanation || policy.reasons.join(', '), state: decision?.recommendedAction === 'wait' ? 'awaiting_window' : decision ? 'planned' : current.state });
  await writeAudit({ merchantId, caseId, eventName: 'ai_recovery_decision_created', details: { policy, decision } });
  return { case: updated, policy, decision, summary: await summarize(merchantId) };
}
