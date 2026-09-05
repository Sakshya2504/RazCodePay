const POLICY = {
  recoveryWindowHours: 168,
  quietHours: { start: 21, end: 9 },
  maxAttemptsPerCase: 2,
  maxAutoContactMinor: 500000,
  approvalRequiredAboveMinor: 100000,
  graceMinutes: 30,
  channels: { email: true, sms: false, whatsapp: false },
};

const terminalStates = new Set(['recovered', 'stopped', 'expired']);

export function evaluatePolicy(caseData, now = new Date()) {
  const allowed = new Set(['wait', 'send_payment_reminder', 'request_payment_method_update', 'create_human_task', 'stop_case']);
  const reasons = [];

  if (terminalStates.has(caseData.state)) return { allowedActions: [], reasons: ['terminal_case'] };

  const ageHours = Math.max(0, (now - new Date(caseData.openedAt || now)) / 36e5);
  if (ageHours > POLICY.recoveryWindowHours) {
    return { allowedActions: ['stop_case'], reasons: ['recovery_window_expired'] };
  }

  if ((caseData.attemptCount || 0) >= POLICY.maxAttemptsPerCase) {
    allowed.delete('send_payment_reminder');
    allowed.add('create_human_task');
    reasons.push('maximum_case_attempts_reached');
  }

  if (!caseData.consent?.email) {
    allowed.delete('send_payment_reminder');
    reasons.push('email_consent_missing');
  }

  const hour = now.getHours();
  if (hour >= POLICY.quietHours.start || hour < POLICY.quietHours.end) {
    allowed.delete('send_payment_reminder');
    reasons.push('merchant_quiet_hours');
  }

  if (caseData.amountMinor > POLICY.maxAutoContactMinor) {
    allowed.delete('send_payment_reminder');
    allowed.add('create_human_task');
    reasons.push('automatic_contact_cap_exceeded');
  } else if (caseData.amountMinor > POLICY.approvalRequiredAboveMinor) {
    allowed.delete('send_payment_reminder');
    allowed.add('create_human_task');
    reasons.push('human_approval_threshold');
  }

  if (caseData.nextActionAt && new Date(caseData.nextActionAt) > now) {
    return { allowedActions: ['wait', ...[...allowed].filter((action) => action === 'stop_case')], reasons: [...reasons, 'next_action_not_due'] };
  }

  return { allowedActions: [...allowed], reasons };
}

export function getPolicy() {
  return structuredClone(POLICY);
}
