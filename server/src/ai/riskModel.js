const FAILURE_PRIORS = {
  BAD_REQUEST_ERROR: 0.38,
  GATEWAY_ERROR: 0.56,
  NETWORK_ERROR: 0.68,
  CUSTOMER_ACTION_REQUIRED: 0.89,
  PAYMENT_FAILED: 0.66,
  AUTHENTICATION_ERROR: 0.48,
  SERVER_ERROR: 0.58,
};

const TYPE_PRIORS = {
  failed_subscription: 0.66,
  invoice_overdue: 0.58,
  checkout_abandonment: 0.82,
};

const MODEL_VERSION = 'local-recovery-v2';
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const round = (value, digits = 3) => Number(value.toFixed(digits));
const sigmoid = (value) => 1 / (1 + Math.exp(-value));

function freshnessScore(ageHours) {
  if (ageHours <= 0.25) return 1;
  if (ageHours <= 2) return 0.96;
  if (ageHours <= 12) return 0.88;
  if (ageHours <= 24) return 0.78;
  if (ageHours <= 72) return 0.58;
  return clamp(0.42 - Math.max(0, ageHours - 72) / 240);
}

function amountOpportunity(amountMinor) {
  const amount = Math.max(0, Number(amountMinor || 0));
  if (amount <= 5000) return 0.98;
  if (amount <= 50000) return 0.92;
  if (amount <= 200000) return 0.78;
  if (amount <= 500000) return 0.62;
  if (amount <= 1000000) return 0.46;
  return 0.30;
}

function customerSignal(caseData, failureCode) {
  if (caseData.type === 'checkout_abandonment') return 0.92;
  if (failureCode === 'CUSTOMER_ACTION_REQUIRED') return 0.95;
  if (caseData.customer?.email && caseData.customer?.name) return 0.74;
  if (caseData.customer?.email || caseData.customer?.contact) return 0.66;
  return 0.52;
}

export function buildFeatures(caseData, now = new Date()) {
  const failureCode = caseData.failure?.code || caseData.failureCode || 'UNKNOWN';
  const opened = new Date(caseData.openedAt || now);
  const ageHours = Math.max(0, (now - opened) / 36e5);
  const attempts = Math.max(0, Number(caseData.attemptCount ?? caseData.attempts?.length ?? 0));
  const email = Boolean(caseData.customer?.email);
  const contact = Boolean(caseData.customer?.contact);
  const consent = Boolean(caseData.consent?.email || caseData.consent?.sms || caseData.consent?.whatsapp);

  return {
    failurePrior: FAILURE_PRIORS[failureCode] ?? 0.55,
    typePrior: TYPE_PRIORS[caseData.type] ?? 0.60,
    freshness: freshnessScore(ageHours),
    ageHours: round(ageHours, 2),
    customerIntent: customerSignal(caseData, failureCode),
    amountOpportunity: amountOpportunity(caseData.amountMinor),
    consent: consent ? 1 : 0,
    emailReachable: email ? 1 : 0,
    contactReachable: contact ? 1 : 0,
    attempts,
    attemptPressure: clamp(attempts / 3),
    providerContext: caseData.failure?.description ? 1 : 0,
  };
}

export function scoreRecoveryPotential(caseData, now = new Date()) {
  const f = buildFeatures(caseData, now);
  const missingDataPenalty = f.providerContext === 0 ? 0.035 : 0;
  const attemptDecay = Math.exp(-0.34 * f.attempts);
  const interaction = f.customerIntent * f.consent * 0.12 + f.failurePrior * f.freshness * 0.16;

  const linear =
    -0.22 +
    f.failurePrior * 1.12 +
    f.typePrior * 0.46 +
    f.freshness * 0.92 +
    f.customerIntent * 0.68 +
    f.amountOpportunity * 0.36 +
    f.consent * 0.52 +
    f.emailReachable * 0.12 +
    f.contactReachable * 0.08 +
    attemptDecay * 0.34 +
    interaction -
    f.attemptPressure * 0.58 -
    missingDataPenalty;

  const recoverability = clamp(sigmoid((linear - 1.75) * 1.8));
  const risk = clamp(
    0.24 +
      (1 - f.failurePrior) * 0.26 +
      f.attemptPressure * 0.20 +
      (1 - f.freshness) * 0.18 +
      (1 - f.amountOpportunity) * 0.12,
  );

  const dataQuality = clamp(
    0.42 +
      f.providerContext * 0.16 +
      f.consent * 0.14 +
      f.emailReachable * 0.10 +
      f.contactReachable * 0.06 +
      (caseData.failure?.code ? 0.06 : 0),
  );
  const uncertainty = clamp(1 - dataQuality + Math.abs(0.5 - recoverability) * 0.18);
  const confidence = clamp(0.56 + dataQuality * 0.28 + Math.abs(recoverability - 0.5) * 0.22 - uncertainty * 0.10);
  const expectedRecoveryMinor = Math.round(Math.max(0, Number(caseData.amountMinor || 0)) * recoverability * (0.72 + dataQuality * 0.20));

  const signals = [
    { label: 'failure profile', value: f.failurePrior, direction: f.failurePrior >= 0.64 ? 'positive' : 'negative' },
    { label: 'event freshness', value: f.freshness, direction: f.freshness >= 0.70 ? 'positive' : 'negative' },
    { label: 'customer intent', value: f.customerIntent, direction: f.customerIntent >= 0.72 ? 'positive' : 'negative' },
    { label: 'contact consent', value: f.consent, direction: f.consent > 0 ? 'positive' : 'negative' },
    { label: 'amount opportunity', value: f.amountOpportunity, direction: f.amountOpportunity >= 0.55 ? 'positive' : 'negative' },
    { label: 'attempt pressure', value: f.attemptPressure, direction: f.attemptPressure <= 0.34 ? 'positive' : 'negative' },
  ];

  return {
    riskScore: round(risk),
    recoverabilityScore: round(recoverability),
    confidence: round(confidence),
    uncertainty: round(uncertainty),
    dataQuality: round(dataQuality),
    expectedRecoveryMinor,
    modelVersion: MODEL_VERSION,
    features: f,
    signals,
  };
}
