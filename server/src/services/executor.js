import crypto from 'node:crypto';
import { getCase, updateCase } from '../store.js';
import { evaluatePolicy } from './policy.js';
import { writeAudit } from './audit.js';

export async function executeRecoveryAttempt(merchantId, caseId) {
  const current = getCase(merchantId, caseId);
  if (!current) throw new Error('Recovery case not found');
  if (['recovered', 'stopped', 'expired'].includes(current.state)) throw new Error(`Case is terminal: ${current.state}`);

  const policy = evaluatePolicy(current, new Date());
  if (!policy.allowedActions.includes('send_payment_reminder')) throw new Error(`Policy denied contact: ${policy.reasons.join(', ') || 'not allowed'}`);

  const sequence = (current.attemptCount || 0) + 1;
  const idempotencyKey = crypto.createHash('sha256').update(`${current.id}:send_payment_reminder:${sequence}`).digest('hex');
  if (current.attempts?.some((attempt) => attempt.idempotencyKey === idempotencyKey)) return { case: current, duplicate: true };

  const attempt = {
    action: 'send_payment_reminder',
    channel: 'email',
    status: 'sent_test_mode',
    idempotencyKey,
    scheduledFor: new Date().toISOString(),
    sentAt: new Date().toISOString(),
    providerReference: `demo-message-${idempotencyKey.slice(0, 12)}`,
  };
  const updated = updateCase(merchantId, caseId, {
    attemptCount: sequence,
    attempts: [...(current.attempts || []), attempt],
    state: 'monitoring',
    nextActionAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
  await writeAudit({ merchantId, caseId, eventName: 'recovery_attempt_executed_test_mode', details: attempt });
  return { case: updated, attempt, duplicate: false };
}
