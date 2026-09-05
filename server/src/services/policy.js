const DEFAULT_POLICY = {
  recoveryWindowHours: 168,
  quietHours: { start: 21, end: 9 },
  maxAttemptsPerCase: 2,
  maxAttemptsPerCustomer7d: 3,
  maxAutoContactMinor: 500000,
  approvalRequiredAboveMinor: 100000,
  graceMinutes: 30,
  allowedActions: [
    'wait',
    'send_payment_reminder',
    'request_payment_method_update',
    'create_human_task',
    'stop_case',
  ],
  channels: { email: true, sms: false, whatsapp: false },
};

/**
 * The policy engine is deliberately boring. Financial and consent boundaries
 * should be deterministic and reviewable rather than hidden inside an AI call.
 */
export function evaluatePolicy(caseData, now = new Date()) {
  const policy = DEFAULT_POLICY;
  const reasons = [];
  const allowedActions = new Set(policy.allowedActions);

  if (caseData.state === 'recovered' || caseData.state === 'stopped' || caseData.state === 'expired') {
    return { allowedActions: [], reasons: ['terminal_case'] };
  }

  if (caseData.amountMinor > policy.maxAutoContactMinor) {
    allowedActions.delete('send_payment_reminder');
    reasons.push('amount_above_automatic_contact_cap');
  }

  if (caseData.attemptCount >= policy.maxAttemptsPerCase) {
    allowedActions.delete('send_payment_reminder');
    allowedActions.add('create_human_task');
    reasons.push('maximum_case_attempts_reached');
  }

  const hour = now.getHours();
  const isQuiet = hour >= policy.quietHours.start || hour < policy.quietHours.end;
  if (isQuiet) {
    allowedActions.delete('send_payment_reminder');
    reasons.push('merchant_quiet_hours');
  }

  if (!caseData.consent?.email) {
    allowedActions.delete('send_payment_reminder');
    reasons.push('email_consent_missing');
  }

  if (caseData.nextActionAt && new Date(caseData.nextActionAt) > now) {
    return { allowedActions: [], reasons: ['recovery_window_not_reached'] };
  }

  if (caseData.amountMinor > policy.approvalRequiredAboveMinor) {
    allowedActions.delete('send_payment_reminder');
    allowedActions.add('create_human_task');
    reasons.push('amount_requires_human_approval');
  }

  return { allowedActions: [...allowedActions], reasons };
}

export function getDefaultPolicy() {
  return structuredClone(DEFAULT_POLICY);
}
