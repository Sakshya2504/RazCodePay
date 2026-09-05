const WEIGHTS = {
  amount: 0.22,
  failureRecoverability: 0.26,
  freshness: 0.16,
  customerIntent: 0.14,
  consent: 0.08,
  priorAttemptsPenalty: -0.14,
};

const FAILURE_PRIORS = {
  BAD_REQUEST_ERROR: 0.72,
  GATEWAY_ERROR: 0.62,
  NETWORK_ERROR: 0.76,
  CUSTOMER_ACTION_REQUIRED: 0.88,
  PAYMENT_FAILED: 0.68,
  AUTHENTICATION_ERROR: 0.48,
  SERVER_ERROR: 0.61,
};

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

export function buildFeatures(caseData, now = new Date()) {
  const amount = clamp((caseData.amountMinor || 0) / 1000000);
  const prior = FAILURE_PRIORS[caseData.failureCode] ?? 0.58;
  const opened = new Date(caseData.openedAt || now);
  const ageHours = Math.max(0, (now - opened) / 36e5);
  const freshness = 1 - clamp(ageHours / 168);
  const attempts = Number(caseData.attemptCount || caseData.attempts?.length || 0);
  const customerIntent = caseData.type === 'checkout_abandonment' ? 0.82 : caseData.failureCode === 'CUSTOMER_ACTION_REQUIRED' ? 0.9 : 0.68;
  const consent = caseData.consent?.email ? 1 : 0;
  return { amount, prior, freshness, attempts, customerIntent, consent };
}

export function scoreRecoveryPotential(caseData, now = new Date()) {
  const f = buildFeatures(caseData, now);
  const linear =
    (f.prior * WEIGHTS.failureRecoverability) +
    (f.freshness * WEIGHTS.freshness) +
    (f.customerIntent * WEIGHTS.customerIntent) +
    (f.consent * WEIGHTS.consent) +
    ((1 - f.amount) * WEIGHTS.amount) +
    Math.max(0, 1 - f.attempts) * 0.16 +
    Math.max(0, f.attempts - 1) * WEIGHTS.priorAttemptsPenalty;
  const recoverability = clamp(sigmoid((linear - 0.45) * 6));
  const risk = clamp(0.36 + f.amount * 0.34 + (1 - f.prior) * 0.2 + f.attempts * 0.08);

  const signals = [
    { label: 'failure profile', value: f.prior, direction: f.prior >= 0.65 ? 'positive' : 'negative' },
    { label: 'event freshness', value: f.freshness, direction: f.freshness >= 0.7 ? 'positive' : 'negative' },
    { label: 'customer intent', value: f.customerIntent, direction: 'positive' },
    { label: 'contact consent', value: f.consent, direction: f.consent ? 'positive' : 'negative' },
    { label: 'attempt pressure', value: clamp(f.attempts / 3), direction: f.attempts > 0 ? 'negative' : 'positive' },
  ];

  return {
    riskScore: Number(risk.toFixed(3)),
    recoverabilityScore: Number(recoverability.toFixed(3)),
    modelVersion: 'local-recovery-v1',
    features: f,
    signals,
  };
}
