import test from 'node:test';
import assert from 'node:assert/strict';
import { resetStore, summarize } from '../src/store.js';
import { processVerifiedEvent } from '../src/services/recovery.js';

test.beforeEach(() => resetStore());

test('failed payment creates a recovery case and success closes the matching case', async () => {
  const failure = { event: 'payment.failed', created_at: 1767600000, payload: { payment: { entity: { id: 'pay_test_1', order_id: 'order_test_1', amount: 49900, currency: 'INR', error_code: 'PAYMENT_FAILED', error_description: 'Issuer declined' } } } };
  const opened = await processVerifiedEvent({ merchantId: 'merchant-a', eventType: 'payment.failed', providerEventId: 'evt-fail-1', payload: failure, dedupeKey: 'evt-fail-1', payloadSha256: 'hash-1' });
  assert.ok(opened.caseId);
  assert.equal((await summarize('merchant-a')).activeCases, 1);

  const success = { event: 'payment.captured', created_at: 1767600300, payload: { payment: { entity: { id: 'pay_test_2', order_id: 'order_test_1', amount: 49900, currency: 'INR' } } } };
  const closed = await processVerifiedEvent({ merchantId: 'merchant-a', eventType: 'payment.captured', providerEventId: 'evt-success-1', payload: success, dedupeKey: 'evt-success-1', payloadSha256: 'hash-2' });
  assert.equal(closed.recovered, true);
  assert.equal((await summarize('merchant-a')).recoveredCases, 1);
});

test('duplicate provider events are idempotent', async () => {
  const payload = { event: 'payment.failed', payload: { payment: { entity: { id: 'pay_test_2', order_id: 'order_test_2', amount: 25000, currency: 'INR' } } } };
  const first = await processVerifiedEvent({ merchantId: 'merchant-b', eventType: 'payment.failed', providerEventId: 'evt-same', payload, dedupeKey: 'evt-same', payloadSha256: 'hash' });
  const second = await processVerifiedEvent({ merchantId: 'merchant-b', eventType: 'payment.failed', providerEventId: 'evt-same', payload, dedupeKey: 'evt-same', payloadSha256: 'hash' });
  assert.ok(first.caseId);
  assert.equal(second.duplicate, true);
  assert.equal((await summarize('merchant-b')).totalCases, 1);
});
