import { Router } from 'express';
import { requireAuth, requireRole } from '../services/security.js';
import { createRecoveryExperiment, listActiveExperiment, listExperiments, metrics, startExperiment, stopExperiment } from '../services/experiments.js';
import { getCommunicationEvents } from '../store.js';
import { getRecoveryQueue } from '../queue.js';

export function registerPhase2Routes(app) {
  const router = Router();
  router.use(requireAuth);
  const merchantId = (req) => req.auth.merchantId;

  router.get('/experiments', async (req, res, next) => { try { return res.json({ experiments: await listExperiments(merchantId(req)), active: await listActiveExperiment(merchantId(req)) }); } catch (e) { return next(e); } });
  router.post('/experiments', requireRole('owner', 'admin'), async (req, res, next) => {
    try {
      const { name, primaryMetric = 'recovered_amount', arms } = req.body || {};
      if (!name || !Array.isArray(arms) || arms.length < 2) return res.status(400).json({ error: 'name and at least two arms are required.' });
      const experiment = await createRecoveryExperiment(merchantId(req), { name, primaryMetric, arms });
      return res.status(201).json({ experiment });
    } catch (e) { return next(e); }
  });
  router.post('/experiments/:id/start', requireRole('owner', 'admin'), async (req, res, next) => { try { const experiment = await startExperiment(merchantId(req), req.params.id); return experiment ? res.json({ experiment }) : res.status(404).json({ error: 'Experiment not found.' }); } catch (e) { return next(e); } });
  router.post('/experiments/:id/stop', requireRole('owner', 'admin'), async (req, res, next) => { try { const experiment = await stopExperiment(merchantId(req), req.params.id); return experiment ? res.json({ experiment }) : res.status(404).json({ error: 'Experiment not found.' }); } catch (e) { return next(e); } });
  router.get('/experiments/metrics', async (req, res, next) => { try { return res.json({ metrics: await metrics(merchantId(req)) }); } catch (e) { return next(e); } });
  router.get('/cases/:caseId/communications', async (req, res, next) => { try { return res.json({ communications: await getCommunicationEvents(merchantId(req), req.params.caseId) }); } catch (e) { return next(e); } });
  router.get('/queue', async (_req, res) => {
    const queue = getRecoveryQueue();
    if (!queue) return res.json({ enabled: false, waiting: 0, active: 0, delayed: 0, failed: 0 });
    const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed');
    return res.json({ enabled: true, ...counts });
  });

  app.use('/api/phase2', router);
}
