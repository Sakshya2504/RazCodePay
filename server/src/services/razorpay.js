import { getRazorpayConnection } from '../store.js';
import { decryptSecret } from './security.js';

const API = 'https://api.razorpay.com/v1';

async function request(path, { merchantId, method = 'GET', body, idempotencyKey } = {}) {
  const connection = await getRazorpayConnection(merchantId);
  if (!connection) throw new Error('Razorpay is not connected for this merchant.');
  const secret = decryptSecret(connection.encryptedSecret);
  const authorization = Buffer.from(`${connection.keyId}:${secret}`).toString('base64');
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${authorization}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'X-Razorpay-Request-Id': idempotencyKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.description || data?.error?.message || `Razorpay request failed (${response.status})`);
  return data;
}

export async function verifyConnection({ merchantId }) {
  const data = await request('/payments?count=1', { merchantId });
  return { connected: true, sampleCount: data.count || 0 };
}

export async function createPaymentLink({ merchantId, amountMinor, currency, description, customer, expireBy, idempotencyKey }) {
  return request('/payment_links', {
    merchantId,
    method: 'POST',
    idempotencyKey,
    body: {
      amount: amountMinor,
      currency,
      accept_partial: false,
      description,
      customer: { name: customer?.name, email: customer?.email, contact: customer?.contact },
      notify: { sms: false, email: false },
      reminder_enable: true,
      ...(expireBy ? { expire_by: Math.floor(new Date(expireBy).getTime() / 1000) } : {}),
    },
  });
}

export async function fetchPayment({ merchantId, paymentId }) {
  return request(`/payments/${encodeURIComponent(paymentId)}`, { merchantId });
}
