import { Router } from 'express';
import { listCases, getCase, updateCase, resetDemo, summarize, listAudits } from '../store.js';
import { evaluateCase } from '../services/recovery.js';
import { executeRecoveryAttempt } from '../services/executor.js';
import { getPolicy } from '../services/policy.js';
import { writeAudit } from '../services/audit.js';

export function registerApiRoutes(app) {
  const router = Router();
  const merchant = (req) => req.get('X-RazCodePay-Merchant-Id') || 'demo-merchant';

  router.get('/dashboard', (req, res) => {
    res.json({ summary: summarize(merchant(req)), cases: listCases(merchant(req)).slice(0, 24), policy: getPolicy() });
  });

  router.get('/cases', (req, res) => res.json({ cases: listCases(merchant(req)) }));
  router.get('/cases/:id', (req, res) => {
    const item = getCase(merchant(req), req.params.id);
    if (!item) return res.status(404).json({ error: 'Case not found' });
    return res.json({ case: item });
  });

  router.post('/cases/:id/evaluate', async (req, res, next) => {
    try { return res.json(await evaluateCase(merchant(req), req.params.id)); } catch (error) { return next(error); }
  });

  router.post('/cases/:id/execute', async (req, res, next) => {
    try { return res.json(await executeRecoveryAttempt(merchant(req), req.params.id)); } catch (error) { return next(error); }
  });

  router.post('/cases/:id/stop', async (req, res, next) => {
    try {
      const current = getCase(merchant(req), req.params.id);
      if (!current) return res.status(404).json({ error: 'Case not found' });
      if (['recovered', 'stopped', 'expired'].includes(current.state)) return res.status(409).json({ error: `Case is terminal: ${current.state}` });
      const updated = updateCase(merchant(req), req.params.id, { state: 'stopped', stopReason: req.body?.reason || 'merchant_requested', nextActionAt: null, closedAt: new Date().toISOString() });
      await writeAudit({ merchantId: merchant(req), caseId: req.params.id, eventName: 'case_stopped_by_merchant', details: { reason: updated.stopReason } });
      return res.json({ case: updated });
    } catch (error) { return next(error); }
  });

  router.post('/demo/reset', async (req, res) => {
    const cases = resetDemo(merchant(req));
    return res.json({ message: 'Synthetic 60-case cohort reset.', summary: summarize(merchant(req)), cases: cases.length });
  });

  router.get('/audit', (req, res) => res.json({ audit: listAudits(merchant(req)) }));
  router.get('/policy', (_req, res) => res.json(getPolicy()));

  app.use('/api', router);
}
