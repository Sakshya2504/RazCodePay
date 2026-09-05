const DEFAULT_POLICY = {
  recoveryWindowHours: 168,
  quietHours: { start: 21, end: 9 },
  maxAttemptsPerCase: 2,
  maxAutoContactMinor: 500000,
  approvalRequiredAboveMinor: 100000,
  graceMinutes: 30,
  channels: { email: true, sms: false, whatsapp: false },
};

const terminalStates = new Set(['recovered', 'stopped', 'expired']);

export function normalizePolicy(policy = {}) {
  const quietStart = policy.quietStartHour ?? policy.quietHours?.start;
  const quietEnd = policy.quietEndHour ?? policy.quietHours?.end;
  return {
    recoveryWindowHours: Number.isFinite(Number(policy.recoveryWindowHours)) ? Number(policy.recoveryWindowHours) : DEFAULT_POLICY.recoveryWindowHours,
    quietHours: {
      start: Number.isFinite(Number(quietStart)) ? Number(quietStart) : DEFAULT_POLICY.quietHours.start,
      end: Number.isFinite(Number(quietEnd)) ? Number(quietEnd) : DEFAULT_POLICY.quietHours.end,
    },
    maxAttemptsPerCase: Number.isFinite(Number(policy.maxAttemptsPerCase)) ? Number(policy.maxAttemptsPerCase) : DEFAULT_POLICY.maxAttemptsPerCase,
    maxAutoContactMinor: Number.isFinite(Number(policy.maxAutoContactMinor)) ? Number(policy.maxAutoContactMinor) : DEFAULT_POLICY.maxAutoContactMinor,
    approvalRequiredAboveMinor: Number.isFinite(Number(policy.humanApprovalAboveMinor ?? policy.approvalRequiredAboveMinor)) ? Number(policy.humanApprovalAboveMinor ?? policy.approvalRequiredAboveMinor) : DEFAULT_POLICY.approvalRequiredAboveMinor,
    graceMinutes: DEFAULT_POLICY.graceMinutes,
    channels: { ...DEFAULT_POLICY.channels, ...(policy.channels || {}) },
  };
}

export function validateMerchantPolicy(policy = {}) {
  const next = normalizePolicy(policy);
  const integerFields = ['recoveryWindowHours', 'maxAttemptsPerCase', 'maxAutoContactMinor', 'approvalRequiredAboveMinor'];
  for (const field of integerFields) {
    if (!Number.isFinite(next[field]) || next[field] < 0) throw new Error(`Invalid policy field: ${field}`);
  }
  if (!Number.isInteger(next.quietHours.start) || next.quietHours.start < 0 || next.quietHours.start > 23) throw new Error('Invalid quietStartHour');
  if (!Number.isInteger(next.quietHours.end) || next.quietHours.end < 0 || next.quietHours.end > 23) throw new Error('Invalid quietEndHour');
  if (next.maxAttemptsPerCase > 20) throw new Error('maxAttemptsPerCase cannot exceed 20');
  if (next.maxAutoContactMinor > 100000000) throw new Error('maxAutoContactMinor is too high');
  if (next.approvalRequiredAboveMinor > next.maxAutoContactMinor) throw new Error('humanApprovalAboveMinor must not exceed maxAutoContactMinor');
  return next;
}

export function evaluatePolicy(caseData, now = new Date(), merchantPolicy = {}) {
  const POLICY = normalizePolicy(merchantPolicy);
  const allowed = new Set(['wait', 'send_payment_reminder', 'create_payment_link', 'request_payment_method_update', 'create_human_task', 'stop_case']);
  const reasons = [];

  if (terminalStates.has(caseData.state)) return { allowedActions: [], reasons: ['terminal_case'], policy: POLICY };

  const ageHours = Math.max(0, (now - new Date(caseData.openedAt || now)) / 36e5);
  if (ageHours > POLICY.recoveryWindowHours) return { allowedActions: ['stop_case'], reasons: ['recovery_window_expired'], policy: POLICY };

  if ((caseData.attemptCount || 0) >= POLICY.maxAttemptsPerCase) {
    allowed.delete('send_payment_reminder');
    allowed.delete('create_payment_link');
    allowed.add('create_human_task');
    reasons.push('maximum_case_attempts_reached');
  }

  if (!caseData.consent?.email) {
    allowed.delete('send_payment_reminder');
    allowed.delete('create_payment_link');
    reasons.push('email_consent_missing');
  }

  const hour = now.getHours();
  if (hour >= POLICY.quietHours.start || hour < POLICY.quietHours.end) {
    allowed.delete('send_payment_reminder');
    allowed.delete('create_payment_link');
    reasons.push('merchant_quiet_hours');
  }

  if (caseData.amountMinor > POLICY.maxAutoContactMinor) {
    allowed.delete('send_payment_reminder');
    allowed.delete('create_payment_link');
    allowed.add('create_human_task');
    reasons.push('automatic_contact_cap_exceeded');
  } else if (caseData.amountMinor > POLICY.approvalRequiredAboveMinor) {
    allowed.delete('send_payment_reminder');
    allowed.delete('create_payment_link');
    allowed.add('create_human_task');
    reasons.push('human_approval_threshold');
  }

  if (caseData.nextActionAt && new Date(caseData.nextActionAt) > now) {
    return { allowedActions: ['wait', ...[...allowed].filter((action) => action === 'stop_case')], reasons: [...reasons, 'next_action_not_due'], policy: POLICY };
  }

  return { allowedActions: [...allowed], reasons, policy: POLICY };
}

export function getPolicy() { return structuredClone(DEFAULT_POLICY); }
