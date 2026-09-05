import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreRecoveryPotential } from '../src/ai/riskModel.js';
import { recommendRecoveryAction } from '../src/services/decisionEngine.js';

test('local AI scorer returns bounded probabilities and signals', () => {
  const result = scoreRecoveryPotential({ type: 'failed_subscription', amountMinor: 24900, failureCode: 'CUSTOMER_ACTION_REQUIRED', consent: { email: true }, attemptCount: 0, openedAt: new Date().toISOString() });
  assert.ok(result.riskScore >= 0 && result.riskScore <= 1);
  assert.ok(result.recoverabilityScore >= 0 && result.recoverabilityScore <= 1);
  assert.equal(result.signals.length, 6);
});

test('AI recommendation is always bounded by allowed actions', async () => {
  const result = await recommendRecoveryAction({ type: 'failed_subscription', amountMinor: 24900, failureCode: 'PAYMENT_FAILED', consent: { email: true }, attemptCount: 0, openedAt: new Date().toISOString() }, ['wait']);
  assert.equal(result.recommendedAction, 'wait');
});
