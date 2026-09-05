import { Router } from 'express';
import { getCase, listCases, updateCase, resetDemo, summarize, listAudits } from '../store.js';
import { evaluateCase, processVerifiedEvent } from '../services/recovery.js';
import { executeRecoveryAttempt } from '../services/executor.js';
import { getPolicy } from '../services/policy.js';
import { writeAudit } from '../services/audit.js';

export function registerApiRoutes(app) {
  const router = Router();
  const merchant = (req) => req.get('X-RazCodePay-Merchant-Id') || 'demo-merchant';

  router.get('/dashboard', (req, res) => {
    const id = merchant(req);
    res.json({ summary: summarize(id), cases: listCases(id).slice(0, 24), policy: getPolicy() });
  });
  router.get('/cases', (req, res) => res.json({ cases: listCases(merchant(req)) }));
  router.get('/cases/:id', (req, res) => { const item = getCase(merchant(req), req.params.id); return item ? res.json({ case: item }) : res.status(404).json({ error: 'Case not found' }); });
  router.post('/cases/:id/evaluate', async (req, res, next) => { try { return res.json(await evaluateCase(merchant(req), req.params.id)); } catch (error) { return next(error); } });
  router.post('/cases/:id/execute', async (req, res, next) => { try { return res.json(await executeRecoveryAttempt(merchant(req), req.params.id)); } catch (error) { return next(error); } });
  router.post('/cases/:id/simulate-success', async (req, res, next) => {
    try {
      const id = merchant(req), current = getCase(id, req.params.id);
      if (!current) return res.status(404).json({ error: 'Case not found' });
      const payload = { event: 'payment.captured', created_at: Math.floor(Date.now() / 1000), payload: { payment: { entity: { id: current.providerEntityId || `pay_${current.id}`, order_id: current.providerOrderId || null, amount: current.amountMinor, currency: current.currency } } } };
      const result = await processVerifiedEvent({ merchantId: id, eventType: 'payment.captured', providerEventId: `demo-success-${current.id}-${Date.now()}`, payload, dedupeKey: `demo-success:${current.id}:${Date.now()}`, payloadSha256: 'demo' });
      return res.json({ ...result, case: getCase(id, current.id), summary: summarize(id) });
    } catch (error) { return next(error); }
  });
  router.post('/cases/:id/stop', async (req, res, next) => {
    try {
      const id = merchant(req), current = getCase(id, req.params.id);
      if (!current) return res.status(404).json({ error: 'Case not found' });
      if (['recovered', 'stopped', 'expired'].includes(current.state)) return res.status(409).json({ error: `Case is terminal: ${current.state}` });
      const updated = updateCase(id, req.params.id, { state: 'stopped', stopReason: req.body?.reason || 'merchant_requested', nextActionAt: null, closedAt: new Date().toISOString() });
      await writeAudit({ merchantId: id, caseId: req.params.id, eventName: 'case_stopped_by_merchant', details: { reason: updated.stopReason } });
      return res.json({ case: updated });
    } catch (error) { return next(error); }
  });
  router.post('/demo/reset', (req, res) => { const id = merchant(req); resetDemo(id); return res.json({ message: 'Synthetic 60-case cohort reset.', summary: summarize(id) }); });
  router.get('/audit', (req, res) => res.json({ audit: listAudits(merchant(req)) }));
  router.get('/policy', (_req, res) => res.json(getPolicy()));
  app.use('/api', router);
}
