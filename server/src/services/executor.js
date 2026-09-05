import crypto from 'node:crypto';
import { config } from '../config.js';
import { getCase, getMerchant, updateCase } from '../store.js';
import { evaluatePolicy } from './policy.js';
import { writeAudit } from './audit.js';
import { createPaymentLink } from './razorpay.js';
import { sendRecoveryEmail } from './mailer.js';

function recoverySubject(caseData) {
  return `Payment recovery for ${caseData.currency} ${(caseData.amountMinor / 100).toFixed(2)}`;
}

function recoveryMessage(caseData, paymentLink) {
  const name = caseData.customer?.name || 'there';
  return `Hi ${name},\n\nWe could not complete your recent payment. Please use the secure payment link below to finish it:\n\n${paymentLink}\n\nIf you have already paid, you can ignore this message.\n\nRazCodePay`;
}

export async function executeRecoveryAttempt(merchantId, caseId) {
  const current = await getCase(merchantId, caseId);
  if (!current) throw new Error('Recovery case not found');
  if (['recovered', 'stopped', 'expired'].includes(current.state)) throw new Error(`Case is terminal: ${current.state}`);

  const merchant = await getMerchant(merchantId);
  const policy = evaluatePolicy(current, new Date(), merchant?.policy || {});
  const requestedAction = current.ai?.recommendation || 'send_payment_reminder';
  if (!policy.allowedActions.includes(requestedAction)) throw new Error(`Policy denied ${requestedAction}: ${policy.reasons.join(', ') || 'not allowed'}`);

  const sequence = (current.attemptCount || 0) + 1;
  const actionKey = crypto.createHash('sha256').update(`${caseId}:${requestedAction}:${sequence}`).digest('hex');
  const idempotencyKey = actionKey.slice(0, 36);
  if (current.attempts?.some((attempt) => attempt.idempotencyKey === idempotencyKey)) return { case: current, duplicate: true };

  let attempt = { action: requestedAction, channel: 'email', status: 'planned', idempotencyKey, scheduledFor: new Date() };
  let patch = { attemptCount: sequence, attempts: [...(current.attempts || [])], state: 'monitoring', nextActionAt: new Date(Date.now() + 24 * 3600000) };

  if (config.demoMode) {
    attempt = { ...attempt, status: 'test_mode', providerReference: `demo-message-${actionKey.slice(0, 12)}`, sentAt: new Date() };
  } else if (requestedAction === 'create_payment_link' || requestedAction === 'send_payment_reminder') {
    const link = await createPaymentLink({ merchantId, amountMinor: current.amountMinor, currency: current.currency, description: `Payment recovery for ${String(current.type).replaceAll('_', ' ')}`, customer: current.customer, expireBy: new Date(Date.now() + 48 * 3600000), referenceId: `RCP-${idempotencyKey}`.slice(0, 40) });
    patch.provider = { ...(current.provider || {}), paymentLinkId: link.id };
    attempt = { ...attempt, status: requestedAction === 'create_payment_link' ? 'created' : 'payment_link_created', providerReference: link.id, paymentLink: link.short_url || null };

    if (requestedAction === 'send_payment_reminder') {
      const email = await sendRecoveryEmail({ merchantId, caseId, to: current.customer?.email, subject: recoverySubject(current), text: recoveryMessage(current, link.short_url || link.url || link.id) });
      attempt = { ...attempt, status: email.sent ? 'sent' : 'suppressed', communicationReference: email.providerReference || null, error: email.reason || null, sentAt: email.sent ? new Date() : undefined };
      if (!email.sent) {
        patch.state = 'planned';
        patch.nextActionAt = new Date(Date.now() + 30 * 60000);
      }
    }
  } else if (requestedAction === 'create_human_task') {
    attempt = { ...attempt, status: 'queued_for_operator', sentAt: new Date() };
  } else {
    attempt = { ...attempt, status: 'unsupported_action' };
    patch.state = 'planned';
    patch.nextActionAt = new Date(Date.now() + 30 * 60000);
  }

  patch.attempts = [...patch.attempts, attempt];
  const updated = await updateCase(merchantId, caseId, patch);
  await writeAudit({ merchantId, caseId, eventName: 'recovery_action_executed', details: { attempt, policy } });
  return { case: updated, attempt, duplicate: false };
}
