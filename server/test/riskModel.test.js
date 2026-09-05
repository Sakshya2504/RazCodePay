import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFeatures, scoreRecoveryPotential } from '../src/ai/riskModel.js';

test('recovery model v2 exposes interpretable features and bounded scores', () => {
  const result = scoreRecoveryPotential({
    type: 'checkout_abandonment',
    amountMinor: 10000,
    currency: 'INR',
    customer: { name: 'Test Customer', email: 'test@example.com' },
    consent: { email: true },
    failure: { code: 'CUSTOMER_ACTION_REQUIRED', description: 'Customer action required.' },
    attemptCount: 0,
    openedAt: new Date().toISOString(),
  });

  assert.equal(result.modelVersion, 'local-recovery-v2');
  assert.ok(result.recoverabilityScore >= 0 && result.recoverabilityScore <= 1);
  assert.ok(result.riskScore >= 0 && result.riskScore <= 1);
  assert.ok(result.confidence >= 0 && result.confidence <= 1);
  assert.ok(result.uncertainty >= 0 && result.uncertainty <= 1);
  assert.ok(result.dataQuality >= 0 && result.dataQuality <= 1);
  assert.ok(result.expectedRecoveryMinor >= 0);
  assert.ok(Array.isArray(result.signals) && result.signals.length >= 5);
});

test('fresh consented checkout with strong failure signal scores above a stale repeated case', () => {
  const now = new Date();
  const strong = {
    type: 'checkout_abandonment',
    amountMinor: 25000,
    currency: 'INR',
    customer: { name: 'Test Customer', email: 'test@example.com' },
    consent: { email: true },
    failure: { code: 'CUSTOMER_ACTION_REQUIRED', description: 'Customer action required.' },
    attemptCount: 0,
    openedAt: now.toISOString(),
  };
  const weak = {
    ...strong,
    failure: { code: 'BAD_REQUEST_ERROR' },
    attemptCount: 2,
    openedAt: new Date(now.getTime() - 120 * 3600000).toISOString(),
    consent: { email: false },
    customer: { name: null, email: null },
  };

  const strongScore = scoreRecoveryPotential(strong, now);
  const weakScore = scoreRecoveryPotential(weak, now);
  assert.ok(strongScore.recoverabilityScore > weakScore.recoverabilityScore);
});

test('feature builder makes missing customer context explicit', () => {
  const features = buildFeatures({ type: 'invoice_overdue', amountMinor: 50000, attemptCount: 0 }, new Date());
  assert.equal(features.providerContext, 0);
  assert.equal(features.emailReachable, 0);
  assert.equal(features.contactReachable, 0);
  assert.equal(features.consent, 0);
});
