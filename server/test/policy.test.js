import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePolicy } from '../src/services/policy.js';

function baseCase(overrides = {}) {
  return {
    state: 'awaiting_window',
    amountMinor: 49900,
    attemptCount: 0,
    consent: { email: true, sms: false, whatsapp: false },
    nextActionAt: null,
    ...overrides,
  };
}

test('allows email recovery for an eligible case', () => {
  const result = evaluatePolicy(baseCase(), new Date('2026-09-05T12:00:00Z'));
  assert.ok(result.allowedActions.includes('send_payment_reminder'));
});

test('blocks contact without consent', () => {
  const result = evaluatePolicy(
    baseCase({ consent: { email: false, sms: false, whatsapp: false } }),
    new Date('2026-09-05T12:00:00Z'),
  );
  assert.equal(result.allowedActions.includes('send_payment_reminder'), false);
  assert.ok(result.reasons.includes('email_consent_missing'));
});

test('routes high-value cases to human review', () => {
  const result = evaluatePolicy(baseCase({ amountMinor: 200000 }), new Date('2026-09-05T12:00:00Z'));
  assert.equal(result.allowedActions.includes('send_payment_reminder'), false);
  assert.ok(result.allowedActions.includes('create_human_task'));
});

test('terminal cases have no allowed actions', () => {
  const result = evaluatePolicy(baseCase({ state: 'recovered' }), new Date('2026-09-05T12:00:00Z'));
  assert.deepEqual(result.allowedActions, []);
  assert.ok(result.reasons.includes('terminal_case'));
});
