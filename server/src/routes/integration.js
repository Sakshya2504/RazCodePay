import { Router } from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { encryptSecret, requireAuth, requireRole } from '../services/security.js';
import { getRazorpayConnection, saveRazorpayConnection } from '../store.js';
import { verifyConnection, buildRazorpayAuthorizeUrl, exchangeOauthCode } from '../services/razorpay.js';

export function registerIntegrationRoutes(app) {
  const router = Router();
  router.use(requireAuth);

  router.get('/razorpay', async (req, res) => {
    if (config.demoMode) return res.json({ connected: false, demoMode: true, message: 'Connect a real Razorpay account in production mode.' });
    const connection = await getRazorpayConnection(req.auth.merchantId);
    return res.json({ connected: Boolean(connection), authType: connection?.authType || null, mode: connection?.mode || null, accountId: connection?.accountId || null, keyId: connection?.keyId || null, status: connection?.status || null, webhookConfigured: Boolean(connection?.encryptedWebhookSecret), expiresAt: connection?.expiresAt || null, lastVerifiedAt: connection?.lastVerifiedAt || null });
  });

  router.get('/razorpay/oauth/start', requireRole('owner', 'admin'), (req, res, next) => {
    try {
      if (config.demoMode) return res.status(409).json({ error: 'OAuth is disabled in demo mode.' });
      const state = jwt.sign({ purpose: 'razorpay_oauth', merchantId: req.auth.merchantId, nonce: crypto.randomUUID() }, config.jwtSecret, { issuer: 'razcodepay-oauth', expiresIn: '10m' });
      return res.json({ authorizationUrl: buildRazorpayAuthorizeUrl({ state, mode: req.query.mode === 'live' ? 'live' : 'test' }) });
    } catch (error) { return next(error); }
  });

  router.get('/razorpay/oauth/callback', async (req, res, next) => {
    try {
      if (!config.razorpayOauthClientId || !config.razorpayOauthClientSecret) return res.status(503).send('Razorpay OAuth is not configured.');
      const { code, state, error } = req.query;
      if (error) return res.status(400).send(`Razorpay authorization denied: ${error}`);
      if (!code || !state) return res.status(400).send('Missing OAuth code or state.');
      const payload = jwt.verify(state, config.jwtSecret, { issuer: 'razcodepay-oauth' });
      if (payload.purpose !== 'razorpay_oauth' || !payload.merchantId) return res.status(400).send('Invalid OAuth state.');
      const tokens = await exchangeOauthCode({ code: decodeURIComponent(code), mode: req.query.mode === 'live' ? 'live' : 'test' });
      await saveRazorpayConnection(payload.merchantId, { authType: 'oauth', mode: req.query.mode === 'live' ? 'live' : 'test', encryptedAccessToken: encryptSecret(tokens.access_token), encryptedRefreshToken: encryptSecret(tokens.refresh_token), publicToken: tokens.public_token, accountId: tokens.razorpay_account_id, expiresAt: new Date(Date.now() + Number(tokens.expires_in || 7776000) * 1000), status: 'connected', connectedAt: new Date(), lastVerifiedAt: new Date() });
      return res.redirect(`${config.allowedOrigin}/?razorpay=connected`);
    } catch (error) { return next(error); }
  });

  router.post('/razorpay', requireRole('owner', 'admin'), async (req, res, next) => {
    try {
      if (config.demoMode) return res.status(409).json({ error: 'Set DEMO_MODE=false to connect a real merchant account.' });
      const { keyId, keySecret, webhookSecret, mode = 'test' } = req.body || {};
      if (!keyId || !keySecret || !['test', 'live'].includes(mode)) return res.status(400).json({ error: 'keyId, keySecret and mode=test|live are required.' });
      await saveRazorpayConnection(req.auth.merchantId, { authType: 'api_key', keyId, encryptedSecret: encryptSecret(keySecret), ...(webhookSecret ? { encryptedWebhookSecret: encryptSecret(webhookSecret) } : {}), mode, status: 'connected', connectedAt: new Date() });
      await verifyConnection({ merchantId: req.auth.merchantId });
      await saveRazorpayConnection(req.auth.merchantId, { lastVerifiedAt: new Date(), status: 'connected' });
      return res.json({ connected: true, authType: 'api_key', mode, keyId, webhookConfigured: Boolean(webhookSecret) });
    } catch (error) { await saveRazorpayConnection(req.auth.merchantId, { status: 'error' }).catch(() => {}); return next(error); }
  });

  router.delete('/razorpay', requireRole('owner', 'admin'), async (req, res, next) => {
    try { await saveRazorpayConnection(req.auth.merchantId, { status: 'revoked' }); return res.json({ connected: false }); } catch (error) { return next(error); }
  });

  app.use('/api/integrations', router);
}
