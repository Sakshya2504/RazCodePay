import crypto from 'node:crypto';
import { addCase, getCase, updateCase, listCases, recordEvent, hasEvent, summarize } from '../store.js';
import { evaluatePolicy } from './policy.js';
import { recommendRecoveryAction } from './decisionEngine.js';
import { writeAudit } from './audit.js';

const FAILURE_EVENTS = new Set(['payment.failed', 'subscription.pending', 'subscription.halted', 'invoice.issued']);
const SUCCESS_EVENTS = new Set(['payment.captured', 'order.paid', 'subscription.charged', 'invoice.paid']);

export function createPayloadHash(rawBody) { return crypto.createHash('sha256').update(rawBody).digest('hex'); }
function entityFrom(payload) { const root = payload?.payload || {}; return root.payment?.entity || root.subscription?.entity || root.invoice?.entity || root.order?.entity || {}; }
function canonical(eventType, payload) {
  const entity = entityFrom(payload), isInvoice = eventType.startsWith('invoice.'), isSubscription = eventType.startsWith('subscription.');
  return { type: isInvoice ? 'invoice_overdue' : eventType.startsWith('order.') ? 'checkout_abandonment' : 'failed_subscription', amountMinor: Number(entity.amount || entity.total_amount || 0), currency: entity.currency || 'INR', customerId: entity.customer_id || entity.email || 'unknown-customer', providerEntityId: entity.id || null, providerOrderId: entity.order_id || (eventType.startsWith('order.') ? entity.id : null), providerSubscriptionId: entity.subscription_id || (isSubscription ? entity.id : null), providerInvoiceId: entity.invoice_id || (isInvoice ? entity.id : null), failureCode: entity.error_code || entity.error?.code || null, failureDescription: entity.error_description || entity.error?.description || null };
}
function findMatchingCase(merchantId, data) {
  const ids = [data.providerEntityId, data.providerOrderId, data.providerSubscriptionId, data.providerInvoiceId].filter(Boolean);
  return listCases(merchantId).find((item) => ids.some((id) => [item.providerEntityId, item.providerOrderId, item.providerSubscriptionId, item.providerInvoiceId].includes(id)));
}

export async function processVerifiedEvent({ merchantId = 'demo-merchant', eventType, providerEventId, payload, dedupeKey, payloadSha256 }) {
  if (hasEvent(dedupeKey)) return { duplicate: true, recovered: false, eventId: providerEventId || dedupeKey };
  recordEvent(dedupeKey, { eventType, providerEventId, payloadSha256, receivedAt: new Date().toISOString() });
  const data = canonical(eventType, payload);

  if (SUCCESS_EVENTS.has(eventType)) {
    const current = findMatchingCase(merchantId, data);
    if (!current) return { recovered: false, ignored: true, eventId: providerEventId || dedupeKey };
    const updated = updateCase(merchantId, current.id, { state: 'recovered', recoveredAmountMinor: data.amountMinor || current.amountMinor, recoveredProviderId: data.providerEntityId || data.providerOrderId || data.providerSubscriptionId || data.providerInvoiceId, nextActionAt: null, closedAt: new Date().toISOString(), stopReason: null, explanation: `Recovered from verified Razorpay event: ${eventType}.` });
    await writeAudit({ merchantId, caseId: current.id, eventName: 'case_recovered', details: { eventType, providerEventId, amountMinor: updated.recoveredAmountMinor } });
    return { recovered: true, caseId: current.id, eventId: providerEventId || dedupeKey };
  }

  if (!FAILURE_EVENTS.has(eventType) || data.amountMinor <= 0) return { recovered: false, ignored: true, eventId: providerEventId || dedupeKey };
  const cases = listCases(merchantId);
  const caseKey = `${data.providerInvoiceId || data.providerSubscriptionId || data.providerOrderId || data.providerEntityId}:${data.type}`;
  let current = cases.find((item) => item.caseKey === caseKey || item.providerEntityId === data.providerEntityId);
  if (!current) {
    current = addCase(merchantId, { id: `case-live-${crypto.randomUUID().slice(0, 8)}`, caseKey, merchantId, type: data.type, state: 'awaiting_window', amountMinor: data.amountMinor, currency: data.currency, customerId: data.customerId, providerEntityId: data.providerEntityId, providerOrderId: data.providerOrderId, providerSubscriptionId: data.providerSubscriptionId, providerInvoiceId: data.providerInvoiceId, failureCode: data.failureCode, failureDescription: data.failureDescription, consent: { email: true, sms: false, whatsapp: false }, attemptCount: 0, attempts: [], riskScore: null, recoverabilityScore: null, ai: null, nextActionAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), recoveredAmountMinor: 0, recoveredProviderId: null, openedAt: new Date().toISOString(), closedAt: null, stopReason: null, updatedAt: new Date().toISOString() });
    await writeAudit({ merchantId, caseId: current.id, eventName: 'case_created_from_webhook', details: { eventType, caseKey, amountMinor: data.amountMinor } });
  } else {
    updateCase(merchantId, current.id, { failureCode: data.failureCode || current.failureCode, failureDescription: data.failureDescription || current.failureDescription });
  }
  return { recovered: false, caseId: current.id, eventId: providerEventId || dedupeKey };
}

export async function evaluateCase(merchantId, caseId) {
  const current = getCase(merchantId, caseId);
  if (!current) throw new Error('Recovery case not found');
  const policy = evaluatePolicy(current);
  const decision = policy.allowedActions.length ? await recommendRecoveryAction(current, policy.allowedActions) : null;
  const updated = updateCase(merchantId, caseId, { riskScore: decision?.riskScore ?? current.riskScore, recoverabilityScore: decision?.recoverabilityScore ?? current.recoverabilityScore, ai: decision, explanation: decision?.explanation || policy.reasons.join(', '), state: decision?.recommendedAction === 'wait' ? 'awaiting_window' : decision ? 'planned' : current.state });
  await writeAudit({ merchantId, caseId, eventName: 'ai_recovery_decision_created', details: { policy, decision } });
  return { case: updated, policy, decision, summary: summarize(merchantId) };
}
