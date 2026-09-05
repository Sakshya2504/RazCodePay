import { getRazorpayConnection, saveRazorpayConnection } from '../store.js';
import { config } from '../config.js';
import { decryptSecret, encryptSecret } from './security.js';

const API = 'https://api.razorpay.com/v1';
const OAUTH = 'https://auth.razorpay.com';

async function refreshOauthToken(connection) {
  if (!connection.encryptedRefreshToken || !config.razorpayOauthClientId || !config.razorpayOauthClientSecret) throw new Error('Razorpay OAuth refresh configuration is incomplete.');
  const refreshToken = decryptSecret(connection.encryptedRefreshToken);
  const response = await fetch(`${OAUTH}/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: config.razorpayOauthClientId, client_secret: config.razorpayOauthClientSecret, grant_type: 'refresh_token', refresh_token: refreshToken, mode: connection.mode }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.description || data?.error?.message || `Razorpay OAuth refresh failed (${response.status})`);
  await saveRazorpayConnection(connection.merchantId, { encryptedAccessToken: encryptSecret(data.access_token), encryptedRefreshToken: encryptSecret(data.refresh_token), publicToken: data.public_token, expiresAt: new Date(Date.now() + Number(data.expires_in || 7776000) * 1000), accountId: data.razorpay_account_id, status: 'connected' });
  return data.access_token;
}

async function authHeader(connection) {
  if (connection.authType === 'oauth') {
    const expiresSoon = !connection.expiresAt || new Date(connection.expiresAt).getTime() - Date.now() < 5 * 60 * 1000;
    const token = expiresSoon ? await refreshOauthToken(connection) : decryptSecret(connection.encryptedAccessToken);
    return `Bearer ${token}`;
  }
  const secret = decryptSecret(connection.encryptedSecret);
  return `Basic ${Buffer.from(`${connection.keyId}:${secret}`).toString('base64')}`;
}

async function request(path, { merchantId, method = 'GET', body } = {}) {
  const connection = await getRazorpayConnection(merchantId);
  if (!connection) throw new Error('Razorpay is not connected for this merchant.');
  const response = await fetch(`${API}${path}`, { method, headers: { Authorization: await authHeader(connection), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.description || data?.error?.message || `Razorpay request failed (${response.status})`);
  return data;
}

export function buildRazorpayAuthorizeUrl({ state, mode = 'test' }) {
  if (!config.razorpayOauthClientId) throw new Error('RAZORPAY_OAUTH_CLIENT_ID is not configured.');
  const params = new URLSearchParams({ client_id: config.razorpayOauthClientId, response_type: 'code', redirect_uri: config.razorpayOauthRedirectUri, scope: 'read_write', state, mode });
  return `${OAUTH}/authorize?${params.toString()}`;
}

export async function exchangeOauthCode({ code, mode = 'test' }) {
  const response = await fetch(`${OAUTH}/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: config.razorpayOauthClientId, client_secret: config.razorpayOauthClientSecret, grant_type: 'authorization_code', redirect_uri: config.razorpayOauthRedirectUri, code, mode }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.description || data?.error?.message || `Razorpay OAuth exchange failed (${response.status})`);
  return data;
}

export async function verifyConnection({ merchantId }) {
  const data = await request('/payments?count=1', { merchantId });
  return { connected: true, sampleCount: data.count || 0 };
}

export async function createPaymentLink({ merchantId, amountMinor, currency, description, customer, expireBy, referenceId }) {
  return request('/payment_links', { merchantId, method: 'POST', body: { amount: amountMinor, currency, accept_partial: false, description, reference_id: referenceId, customer: { name: customer?.name, email: customer?.email, contact: customer?.contact }, notify: { sms: false, email: false }, reminder_enable: true, ...(expireBy ? { expire_by: Math.floor(new Date(expireBy).getTime() / 1000) } : {}) } });
}

export async function fetchPayment({ merchantId, paymentId }) {
  return request(`/payments/${encodeURIComponent(paymentId)}`, { merchantId });
}
