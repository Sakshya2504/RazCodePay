import crypto from 'node:crypto';
import { config } from '../config.js';
import { getCase, updateCase } from '../store.js';
import { evaluatePolicy } from './policy.js';
import { writeAudit } from './audit.js';
import { createPaymentLink } from './razorpay.js';

export async function executeRecoveryAttempt(merchantId, caseId) {
  const current = await getCase(merchantId, caseId);
  if (!current) throw new Error('Recovery case not found');
  if (['recovered', 'stopped', 'expired'].includes(current.state)) throw new Error(`Case is terminal: ${current.state}`);

  const policy = evaluatePolicy(current, new Date());
  const requestedAction = current.ai?.recommendation || 'send_payment_reminder';
  if (!policy.allowedActions.includes(requestedAction)) throw new Error(`Policy denied ${requestedAction}: ${policy.reasons.join(', ') || 'not allowed'}`);

  const sequence = (current.attemptCount || 0) + 1;
  const actionKey = crypto.createHash('sha256').update(`${caseId}:${requestedAction}:${sequence}`).digest('hex');
  const idempotencyKey = actionKey.slice(0, 36);
  if (current.attempts?.some((attempt) => attempt.idempotencyKey === idempotencyKey)) return { case: current, duplicate: true };

  let attempt = { action: requestedAction, channel: 'email', status: 'simulated', idempotencyKey, scheduledFor: new Date(), sentAt: new Date() };

  if (requestedAction === 'create_payment_link' && !config.demoMode) {
    const link = await createPaymentLink({ merchantId, amountMinor: current.amountMinor, currency: current.currency, description: `Payment recovery for ${current.type.replaceAll('_', ' ')}`, customer: current.customer, expireBy: new Date(Date.now() + 48 * 3600000), referenceId: `RCP-${idempotencyKey}`.slice(0, 40) });
    attempt = { ...attempt, status: 'created', providerReference: link.id, paymentLink: link.short_url || null };
  } else if (requestedAction === 'send_payment_reminder' || config.demoMode) {
    attempt = { ...attempt, status: 'test_mode', providerReference: `demo-message-${actionKey.slice(0, 12)}` };
  } else {
    attempt = { ...attempt, status: 'queued_for_operator' };
  }

  const updated = await updateCase(merchantId, caseId, { attemptCount: sequence, attempts: [...(current.attempts || []), attempt], state: requestedAction === 'create_human_task' ? 'planned' : 'monitoring', nextActionAt: new Date(Date.now() + 24 * 3600000) });
  await writeAudit({ merchantId, caseId, eventName: 'recovery_action_executed', details: attempt });
  return { case: updated, attempt, duplicate: false };
}
