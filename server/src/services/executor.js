import crypto from 'node:crypto';
import { RecoveryCase } from '../models/RecoveryCase.js';
import { evaluatePolicy } from './policy.js';
import { writeAudit } from './audit.js';

/**
 * The demo executor is deliberately a test-mode adapter. It records the
 * outbound intent instead of contacting real customers, which makes the
 * buildathon demo reproducible and safe while preserving the real workflow.
 */
export async function executeRecoveryAttempt(caseId, merchantId = 'demo-merchant') {
  const recoveryCase = await RecoveryCase.findOne({ _id: caseId, merchantId });
  if (!recoveryCase) throw new Error('Recovery case not found');

  if (['recovered', 'stopped', 'expired'].includes(recoveryCase.state)) {
    throw new Error(`Case is terminal: ${recoveryCase.state}`);
  }

  // Re-read the policy at the moment of the side effect. A scheduled decision
  // is a plan, not permission to bypass a rule that changed afterward.
  const policy = evaluatePolicy(recoveryCase, new Date());
  if (!policy.allowedActions.includes('send_payment_reminder')) {
    throw new Error(`Policy denied contact: ${policy.reasons.join(', ') || 'no eligible action'}`);
  }

  const sequence = recoveryCase.attemptCount + 1;
  const idempotencyKey = crypto
    .createHash('sha256')
    .update(`${recoveryCase._id}:send_payment_reminder:${sequence}`)
    .digest('hex');

  const existingAttempt = recoveryCase.attempts.find((attempt) => attempt.idempotencyKey === idempotencyKey);
  if (existingAttempt) return { recoveryCase, attempt: existingAttempt, duplicate: true };

  const attempt = {
    action: 'send_payment_reminder',
    channel: 'email',
    status: 'sent',
    idempotencyKey,
    scheduledFor: new Date(),
    sentAt: new Date(),
    providerReference: `demo-message-${idempotencyKey.slice(0, 12)}`,
  };

  recoveryCase.attempts.push(attempt);
  recoveryCase.attemptCount = sequence;
  recoveryCase.state = 'monitoring';
  await recoveryCase.save();

  await writeAudit({
    merchantId,
    caseId: recoveryCase._id,
    eventName: 'recovery_attempt_executed_test_mode',
    details: {
      action: attempt.action,
      channel: attempt.channel,
      idempotencyKey,
      providerReference: attempt.providerReference,
    },
  });

  return { recoveryCase, attempt, duplicate: false };
}
