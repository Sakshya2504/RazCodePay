import { Router } from 'express';
import { getCase, listCases, updateCase, resetDemo, summarize, listAudits, getMerchant } from '../store.js';
import { evaluateCase, processVerifiedEvent } from '../services/recovery.js';
import { executeRecoveryAttempt } from '../services/executor.js';
import { getPolicy } from '../services/policy.js';
import { writeAudit } from '../services/audit.js';
import { requireAuth, requireRole } from '../services/security.js';
import { config } from '../config.js';

export function registerApiRoutes(app) {
  const router = Router();
  const merchant = (req) => config.demoMode ? (req.get('X-RazCodePay-Merchant-Id') || 'demo-merchant') : req.auth.merchantId;
  router.use(requireAuth);

  router.get('/dashboard', async (req, res, next) => { try { const id = merchant(req); return res.json({ summary: await summarize(id), cases: (await listCases(id)).slice(0, 40), policy: getPolicy() }); } catch (e) { return next(e); } });
  router.get('/cases', async (req, res, next) => { try { return res.json({ cases: await listCases(merchant(req)) }); } catch (e) { return next(e); } });
  router.get('/cases/:id', async (req, res, next) => { try { const item = await getCase(merchant(req), req.params.id); return item ? res.json({ case: item }) : res.status(404).json({ error: 'Case not found' }); } catch (e) { return next(e); } });
  router.post('/cases/:id/evaluate', requireRole('owner', 'admin', 'operator'), async (req, res, next) => { try { return res.json(await evaluateCase(merchant(req), req.params.id)); } catch (e) { return next(e); } });
  router.post('/cases/:id/execute', requireRole('owner', 'admin', 'operator'), async (req, res, next) => { try { return res.json(await executeRecoveryAttempt(merchant(req), req.params.id)); } catch (e) { return next(e); } });
  router.post('/cases/:id/simulate-success', requireRole('owner', 'admin', 'operator'), async (req, res, next) => {
    try {
      if (!config.demoMode) return res.status(403).json({ error: 'The success simulator is available only in demo mode.' });
      const id = merchant(req), current = await getCase(id, req.params.id);
      if (!current) return res.status(404).json({ error: 'Case not found' });
      const payload = { event: 'payment.captured', created_at: Math.floor(Date.now() / 1000), payload: { payment: { entity: { id: current.provider?.entityId || `pay_${current.id}`, order_id: current.provider?.orderId || null, amount: current.amountMinor, currency: current.currency } } } };
      const result = await processVerifiedEvent({ merchantId: id, eventType: 'payment.captured', providerEventId: `demo-success-${current.id}-${Date.now()}`, payload, dedupeKey: `demo-success:${current.id}:${Date.now()}`, payloadSha256: 'demo', signatureVerified: true });
      return res.json({ ...result, case: await getCase(id, current.id), summary: await summarize(id) });
    } catch (e) { return next(e); }
  });
  router.post('/cases/:id/stop', requireRole('owner', 'admin', 'operator'), async (req, res, next) => {
    try {
      const id = merchant(req), current = await getCase(id, req.params.id);
      if (!current) return res.status(404).json({ error: 'Case not found' });
      if (['recovered', 'stopped', 'expired'].includes(current.state)) return res.status(409).json({ error: `Case is terminal: ${current.state}` });
      const updated = await updateCase(id, req.params.id, { state: 'stopped', stopReason: req.body?.reason || 'merchant_requested', nextActionAt: null, closedAt: new Date() });
      await writeAudit({ merchantId: id, caseId: req.params.id, actorType: 'user', actorId: req.auth?.sub, eventName: 'case_stopped_by_merchant', details: { reason: updated.stopReason } });
      return res.json({ case: updated });
    } catch (e) { return next(e); }
  });
  router.post('/demo/reset', requireRole('owner', 'admin'), async (req, res, next) => {
    try {
      if (!config.demoMode) return res.status(403).json({ error: 'Synthetic demo data is disabled in production mode.' });
      const id = merchant(req); await resetDemo(id); return res.json({ message: 'Synthetic cohort reset.', summary: await summarize(id) });
    } catch (e) { return next(e); }
  });
  router.get('/audit', async (req, res, next) => { try { return res.json({ audit: await listAudits(merchant(req)) }); } catch (e) { return next(e); } });
  router.get('/policy', (_req, res) => res.json(getPolicy()));
  router.get('/merchant', async (req, res, next) => { try { const value = await getMerchant(merchant(req)); return res.json({ merchant: value }); } catch (e) { return next(e); } });

  app.use('/api', router);
}
