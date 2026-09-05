import { randomUUID } from 'node:crypto';

const merchants = new Map();
const events = new Map();
const audits = [];
const terminalStates = new Set(['recovered', 'stopped', 'expired']);
const clone = (value) => structuredClone(value);

function makeCase(index, overrides = {}) {
  const types = ['failed_subscription', 'invoice_overdue', 'checkout_abandonment'];
  const failures = ['PAYMENT_FAILED', 'CUSTOMER_ACTION_REQUIRED', 'NETWORK_ERROR', 'GATEWAY_ERROR'];
  const amounts = [249900, 499900, 129900, 799900, 199900, 349900, 899900, 159900];
  const risk = [0.72, 0.48, 0.63, 0.81, 0.55, 0.68, 0.91, 0.44];
  const recoverability = [0.84, 0.62, 0.71, 0.89, 0.66, 0.76, 0.21, 0.58];
  const now = Date.now();
  const state = index === 0 || index === 3 ? 'recovered' : index === 6 ? 'stopped' : 'planned';
  return {
    id: `case-${String(index + 1).padStart(3, '0')}-${randomUUID().slice(0, 6)}`, caseKey: `demo:${index}`, merchantId: 'demo-merchant', type: types[index % types.length], state,
    amountMinor: amounts[index], currency: 'INR', customerId: `cust_demo_${String(index + 1).padStart(3, '0')}`,
    providerEntityId: `pay_demo_${String(index + 1).padStart(3, '0')}`, providerOrderId: `order_demo_${String(index + 1).padStart(3, '0')}`,
    failureCode: failures[index % failures.length], failureDescription: index % 2 === 0 ? 'Payment attempt failed; a customer recovery path is still available.' : 'Customer action is required before payment can complete.',
    consent: { email: true, sms: false, whatsapp: false }, attemptCount: index === 0 ? 1 : 0,
    attempts: index === 0 ? [{ action: 'send_payment_reminder', channel: 'email', status: 'sent_test_mode', providerReference: 'demo-message-recovered' }] : [],
    riskScore: risk[index], recoverabilityScore: recoverability[index],
    ai: { source: 'local-model', modelVersion: 'local-recovery-v1', recommendation: state === 'stopped' ? 'create_human_task' : 'send_payment_reminder', confidence: [0.91, 0.86, 0.8, 0.93, 0.78, 0.88, 0.96, 0.82][index], reasonCodes: state === 'stopped' ? ['high_amount', 'low_recoverability', 'human_review_boundary'] : ['fresh_event', 'recoverable_failure', 'consent_available'], explanation: state === 'stopped' ? 'The model predicts low automated recoverability for this high-value case, so the safest next step is human review.' : 'The case is fresh, contact consent is available, and the failure profile still shows recovery potential.' },
    nextActionAt: new Date(now + 30 * 60 * 1000).toISOString(), recoveredAmountMinor: state === 'recovered' ? amounts[index] : 0,
    recoveredProviderId: state === 'recovered' ? `pay_demo_${String(index + 1).padStart(3, '0')}` : null,
    openedAt: new Date(now - (index + 1) * 60 * 60 * 1000).toISOString(), closedAt: terminalStates.has(state) ? new Date().toISOString() : null,
    stopReason: state === 'stopped' ? 'merchant_demo_stop' : null, updatedAt: new Date(now).toISOString(), ...overrides,
  };
}

function ensureMerchant(merchantId) {
  if (!merchants.has(merchantId)) merchants.set(merchantId, merchantId === 'demo-merchant' ? Array.from({ length: 8 }, (_, index) => makeCase(index)) : []);
  return merchants.get(merchantId);
}
export function addCase(merchantId, item) { ensureMerchant(merchantId).push(clone(item)); return clone(item); }
export function listCases(merchantId = 'demo-merchant') { return clone([...ensureMerchant(merchantId)].sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt))); }
export function getCase(merchantId, caseId) { return clone(ensureMerchant(merchantId).find((item) => item.id === caseId) || null); }
export function updateCase(merchantId, caseId, patch) { const target = ensureMerchant(merchantId).find((item) => item.id === caseId); if (!target) return null; Object.assign(target, clone(patch), { updatedAt: new Date().toISOString() }); return clone(target); }
export function resetDemo(merchantId = 'demo-merchant') {
  merchants.set(merchantId, Array.from({ length: 60 }, (_, index) => makeCase(index % 8, {
    id: `demo-${String(index + 1).padStart(3, '0')}`, caseKey: `demo-batch:${index}`,
    state: index % 10 === 0 ? 'recovered' : index % 17 === 0 ? 'stopped' : 'planned', amountMinor: [9900, 24900, 49900, 99900, 149900, 249900, 499900, 799900][index % 8],
    riskScore: Number((0.35 + ((index * 13) % 60) / 100).toFixed(2)), recoverabilityScore: Number((0.45 + ((index * 17) % 50) / 100).toFixed(2)),
    recoveredAmountMinor: index % 10 === 0 ? [9900, 24900, 49900][index % 3] : 0, closedAt: index % 10 === 0 || index % 17 === 0 ? new Date().toISOString() : null,
  })));
  return listCases(merchantId);
}
export function summarize(merchantId = 'demo-merchant') {
  const cases = ensureMerchant(merchantId), recovered = cases.filter((item) => item.state === 'recovered'), active = cases.filter((item) => !terminalStates.has(item.state));
  return { totalCases: cases.length, activeCases: active.length, recoveredCases: recovered.length, stoppedCases: cases.filter((item) => item.state === 'stopped').length, expiredCases: cases.filter((item) => item.state === 'expired').length, revenueAtRiskMinor: active.reduce((sum, item) => sum + item.amountMinor, 0), recoveredRevenueMinor: cases.reduce((sum, item) => sum + (item.recoveredAmountMinor || 0), 0), recoveryRate: cases.length ? recovered.length / cases.length : 0, attempts: cases.reduce((sum, item) => sum + (item.attemptCount || 0), 0), estimatedHoursSaved: Math.round(cases.length * 0.35 * 10) / 10 };
}
export function recordEvent(key, value) { if (events.has(key)) return false; events.set(key, clone(value)); return true; }
export function hasEvent(key) { return events.has(key); }
export function addAudit(entry) { audits.push({ id: randomUUID(), createdAt: new Date().toISOString(), ...clone(entry) }); }
export function listAudits(merchantId = 'demo-merchant') { return clone(audits.filter((item) => item.merchantId === merchantId).slice(-100).reverse()); }
export function resetStore() { merchants.clear(); events.clear(); audits.length = 0; }
