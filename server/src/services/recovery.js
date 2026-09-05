import crypto from 'node:crypto';
import { addCase, getCase, updateCase, listCases, recordEvent, markEventStatus, summarize, recordRecoveryOutcome, getMerchant, listExperiments } from '../store.js';
import { evaluatePolicy, normalizePolicy } from './policy.js';
import { recommendRecoveryAction } from './decisionEngine.js';
import { writeAudit } from './audit.js';
import { enqueueRecoveryJob } from '../queue.js';
import { listActiveExperiment, pickArm } from './experiments.js';

const FAILURE_EVENTS = new Set(['payment.failed', 'subscription.pending', 'subscription.halted', 'invoice.issued']);
const SUCCESS_EVENTS = new Set(['payment.captured', 'order.paid', 'subscription.charged', 'invoice.paid', 'payment_link.paid']);

export function createPayloadHash(rawBody) { return crypto.createHash('sha256').update(rawBody).digest('hex'); }
function entityFrom(payload) { const root = payload?.payload || {}; return root.payment?.entity || root.subscription?.entity || root.invoice?.entity || root.order?.entity || root.payment_link?.entity || {}; }
function canonical(eventType, payload) {
  const entity = entityFrom(payload);
  const invoice = eventType.startsWith('invoice.');
  const subscription = eventType.startsWith('subscription.');
  return {
    type: invoice ? 'invoice_overdue' : eventType.startsWith('order.') || eventType.startsWith('payment_link.') ? 'checkout_abandonment' : 'failed_subscription',
    amountMinor: Number(entity.amount || entity.total_amount || entity.amount_paid || 0),
    currency: entity.currency || 'INR',
    customer: { id: entity.customer_id || null, name: entity.customer_details?.customer_name || entity.customer_details?.name || null, email: entity.email || entity.customer_details?.customer_email || null, contact: entity.contact || entity.customer_details?.customer_contact || null },
    provider: { entityId: entity.id || null, entityType: eventType.split('.')[0], orderId: entity.order_id || (eventType.startsWith('order.') ? entity.id : null), subscriptionId: entity.subscription_id || (subscription ? entity.id : null), invoiceId: entity.invoice_id || (invoice ? entity.id : null), paymentLinkId: entity.payment_link_id || entity.link_id || null },
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
      const ids = new Set([data.provider.entityId, data.provider.orderId, data.provider.subscriptionId, data.provider.invoiceId, data.provider.paymentLinkId].filter(Boolean));
      const current = cases.find((item) => [item.provider?.entityId, item.provider?.orderId, item.provider?.subscriptionId, item.provider?.invoiceId, item.provider?.paymentLinkId].some((id) => ids.has(id)) && !['recovered', 'stopped', 'expired'].includes(item.state));
      if (!current) { await markEventStatus(dedupeKey, 'ignored'); return { recovered: false, ignored: true, eventId: providerEventId || dedupeKey }; }
      const recoveredAmountMinor = data.amountMinor || current.amountMinor;
      const updated = await updateCase(merchantId, current.id, { state: 'recovered', recoveredAmountMinor, recoveredProviderId: data.provider.entityId || data.provider.orderId || data.provider.paymentLinkId, nextActionAt: null, closedAt: new Date(), stopReason: null, explanation: `Recovered from verified Razorpay event: ${eventType}.` });
      await recordRecoveryOutcome({ merchantId: updated.merchantId, caseId: updated.id, experimentId: updated.experiment?.id || null, arm: updated.experiment?.arm || 'unassigned', intervention: updated.ai?.recommendation || 'unknown', outcome: 'recovered', recoveredAmountMinor, timeToRecoveryMinutes: Math.max(0, (Date.now() - new Date(updated.openedAt).getTime()) / 60000), modelVersion: updated.ai?.modelVersion });
      await writeAudit({ merchantId, caseId: current.id, actorType: 'razorpay', eventName: 'case_recovered', details: { eventType, providerEventId, amountMinor: recoveredAmountMinor } });
      await markEventStatus(dedupeKey, 'processed');
      return { recovered: true, caseId: current.id, eventId: providerEventId || dedupeKey };
    }

    if (!FAILURE_EVENTS.has(eventType) || data.amountMinor <= 0) { await markEventStatus(dedupeKey, 'ignored'); return { recovered: false, ignored: true, eventId: providerEventId || dedupeKey }; }
    const cases = await listCases(merchantId);
    const merchant = await getMerchant(merchantId);
    const policy = normalizePolicy(merchant?.policy || {});
    const caseKey = `${data.provider.invoiceId || data.provider.subscriptionId || data.provider.orderId || data.provider.entityId}:${data.type}`;
    let current = cases.find((item) => item.caseKey === caseKey || item.provider?.entityId === data.provider.entityId);
    if (!current) {
      const nextActionAt = new Date(Date.now() + policy.graceMinutes * 60000);
      current = await addCase(merchantId, { caseKey, type: data.type, state: 'awaiting_window', amountMinor: data.amountMinor, currency: data.currency, customer: data.customer, provider: data.provider, failure: data.failure, consent: { email: Boolean(data.customer.email), sms: false, whatsapp: false }, attemptCount: 0, attempts: [], riskScore: null, recoverabilityScore: null, ai: null, nextActionAt, recoveredAmountMinor: 0, recoveredProviderId: null, openedAt: new Date() });
      const experiment = await listActiveExperiment(merchantId);
      if (experiment) {
        const arm = pickArm(current.id, experiment);
        current = arm ? await updateCase(merchantId, current.id, { experiment: { id: experiment.id, arm: arm.name } }) : current;
      }
      await writeAudit({ merchantId, caseId: current.id, actorType: 'razorpay', eventName: 'case_created_from_webhook', details: { eventType, caseKey, amountMinor: data.amountMinor, experiment: current.experiment || null, graceMinutes: policy.graceMinutes } });
    } else {
      current = await updateCase(merchantId, current.id, { failure: { ...current.failure, ...data.failure } });
    }
    const delayMs = Math.max(0, new Date(current.nextActionAt).getTime() - Date.now());
    const job = await enqueueRecoveryJob({ type: 'evaluate_recovery', merchantId, caseId: current.id, operation: 'evaluate' }, { jobId: `evaluate:${current.id}:${new Date(current.nextActionAt).getTime()}`, delayMs });
    await writeAudit({ merchantId, caseId: current.id, eventName: 'recovery_job_scheduled', details: job });
    await markEventStatus(dedupeKey, 'processed');
    return { recovered: false, caseId: current.id, eventId: providerEventId || dedupeKey, job };
  } catch (error) {
    await markEventStatus(dedupeKey, 'failed', error.message).catch(() => {});
    throw error;
  }
}

export async function evaluateCase(merchantId, caseId) {
  const current = await getCase(merchantId, caseId);
  if (!current) throw new Error('Recovery case not found');
  const merchant = await getMerchant(merchantId);
  const policy = evaluatePolicy(current, new Date(), merchant?.policy || {});
  const decision = policy.allowedActions.length ? await recommendRecoveryAction(current, policy.allowedActions) : null;
  let finalDecision = decision;
  let experimentAssignment = current.experiment || null;
  let experiment = null;

  if (experimentAssignment?.id) {
    experiment = (await listExperiments(merchantId)).find((item) => String(item.id) === String(experimentAssignment.id));
  } else {
    experiment = await listActiveExperiment(merchantId);
    if (experiment) {
      const arm = pickArm(current.id, experiment);
      if (arm) {
        experimentAssignment = { id: experiment.id, arm: arm.name };
        await updateCase(merchantId, caseId, { experiment: experimentAssignment });
      }
    }
  }

  if (experimentAssignment?.arm && experiment) {
    const arm = experiment.arms?.find((item) => item.name === experimentAssignment.arm);
    if (arm && policy.allowedActions.includes(arm.action)) {
      finalDecision = { ...(decision || {}), recommendedAction: arm.action, source: `${decision?.source || 'local-model'}+experiment`, experimentId: experiment.id, experimentArm: arm.name, explanation: `${decision?.explanation || 'Policy-eligible recovery decision.'} Treatment arm selected by the active recovery experiment.` };
    }
  }

  const updated = await updateCase(merchantId, caseId, { riskScore: finalDecision?.riskScore ?? current.riskScore, recoverabilityScore: finalDecision?.recoverabilityScore ?? current.recoverabilityScore, ai: finalDecision, explanation: finalDecision?.explanation || policy.reasons.join(', '), state: finalDecision?.recommendedAction === 'wait' ? 'awaiting_window' : finalDecision ? 'planned' : current.state });
  await writeAudit({ merchantId, caseId, eventName: 'ai_recovery_decision_created', details: { policy, decision: finalDecision, experiment: experimentAssignment } });
  return { case: updated, policy, decision: finalDecision, summary: await summarize(merchantId) };
}
