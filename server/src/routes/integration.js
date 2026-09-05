import { Router } from 'express';
import { config } from '../config.js';
import { encryptSecret, requireAuth, requireRole } from '../services/security.js';
import { getRazorpayConnection, saveRazorpayConnection } from '../store.js';
import { verifyConnection } from '../services/razorpay.js';

export function registerIntegrationRoutes(app) {
  const router = Router();
  router.use(requireAuth);

  router.get('/razorpay', async (req, res) => {
    if (config.demoMode) return res.json({ connected: false, demoMode: true, message: 'Connect a real Razorpay account in production mode.' });
    const connection = await getRazorpayConnection(req.auth.merchantId);
    return res.json({ connected: Boolean(connection), mode: connection?.mode || null, keyId: connection?.keyId || null, status: connection?.status || null, lastVerifiedAt: connection?.lastVerifiedAt || null });
  });

  router.post('/razorpay', requireRole('owner', 'admin'), async (req, res, next) => {
    try {
      if (config.demoMode) return res.status(409).json({ error: 'Set DEMO_MODE=false to connect a real merchant account.' });
      const { keyId, keySecret, mode = 'test' } = req.body || {};
      if (!keyId || !keySecret || !['test', 'live'].includes(mode)) return res.status(400).json({ error: 'keyId, keySecret and mode=test|live are required.' });
      await saveRazorpayConnection(req.auth.merchantId, { keyId, encryptedSecret: encryptSecret(keySecret), mode, status: 'connected', connectedAt: new Date() });
      await verifyConnection({ merchantId: req.auth.merchantId });
      await saveRazorpayConnection(req.auth.merchantId, { lastVerifiedAt: new Date(), status: 'connected' });
      return res.json({ connected: true, mode, keyId, message: 'Razorpay credentials verified and encrypted at rest.' });
    } catch (error) {
      await saveRazorpayConnection(req.auth.merchantId, { status: 'error' }).catch(() => {});
      return next(error);
    }
  });

  router.delete('/razorpay', requireRole('owner', 'admin'), async (req, res, next) => {
    try {
      await saveRazorpayConnection(req.auth.merchantId, { status: 'revoked' });
      return res.json({ connected: false });
    } catch (error) { return next(error); }
  });

  app.use('/api/integrations', router);
}
