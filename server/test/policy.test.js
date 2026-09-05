import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePolicy } from '../src/services/policy.js';

test('policy removes customer contact when consent is missing', () => {
  const result = evaluatePolicy({ state: 'planned', amountMinor: 25000, attemptCount: 0, consent: { email: false }, openedAt: new Date().toISOString() }, new Date(2026, 8, 5, 11));
  assert.equal(result.allowedActions.includes('send_payment_reminder'), false);
  assert.equal(result.reasons.includes('email_consent_missing'), true);
});

test('high value cases route to human review', () => {
  const result = evaluatePolicy({ state: 'planned', amountMinor: 500000, attemptCount: 0, consent: { email: true }, openedAt: new Date().toISOString() }, new Date(2026, 8, 5, 11));
  assert.equal(result.allowedActions.includes('create_human_task'), true);
  assert.equal(result.allowedActions.includes('send_payment_reminder'), false);
});

test('quiet hours block outbound contact', () => {
  const result = evaluatePolicy({ state: 'planned', amountMinor: 25000, attemptCount: 0, consent: { email: true }, openedAt: new Date().toISOString() }, new Date(2026, 8, 5, 22));
  assert.equal(result.allowedActions.includes('send_payment_reminder'), false);
});
