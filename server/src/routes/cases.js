import { RecoveryCase } from '../models/RecoveryCase.js';
import { evaluateCase } from '../services/recovery.js';
import { executeRecoveryAttempt } from '../services/executor.js';
import { writeAudit } from '../services/audit.js';

function toCaseView(item) {
  return {
    id: item._id,
    type: item.type,
    state: item.state,
    amountMinor: item.amountMinor,
    currency: item.currency,
    failureCode: item.failureCode,
    failureDescription: item.failureDescription,
    riskScore: item.riskScore,
    recoverabilityScore: item.recoverabilityScore,
    attempts: item.attempts,
    explanation: item.explanation,
    nextActionAt: item.nextActionAt,
    recoveredAmountMinor: item.recoveredAmountMinor,
    openedAt: item.openedAt,
    closedAt: item.closedAt,
    stopReason: item.stopReason,
  };
}

export function registerCaseRoutes(app) {
  app.get('/api/recovery/cases', async (req, res, next) => {
    try {
      const merchantId = req.get('X-RazCodePay-Merchant-Id') || 'demo-merchant';
      const state = req.query.state;
      const query = { merchantId };
      if (typeof state === 'string' && state) query.state = state;

      const cases = await RecoveryCase.find(query).sort({ openedAt: -1 }).limit(100).lean();
      return res.json({ cases: cases.map(toCaseView) });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/recovery/cases/:id', async (req, res, next) => {
    try {
      const merchantId = req.get('X-RazCodePay-Merchant-Id') || 'demo-merchant';
      const item = await RecoveryCase.findOne({ _id: req.params.id, merchantId }).lean();
      if (!item) return res.status(404).json({ error: 'Recovery case not found' });
      return res.json({ case: toCaseView(item) });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/api/recovery/cases/:id/evaluate', async (req, res, next) => {
    try {
      const merchantId = req.get('X-RazCodePay-Merchant-Id') || 'demo-merchant';
      const item = await RecoveryCase.findOne({ _id: req.params.id, merchantId });
      if (!item) return res.status(404).json({ error: 'Recovery case not found' });

      const result = await evaluateCase(item);
      return res.json({
        case: toCaseView(result.case.toObject()),
        policy: result.policy,
        decision: result.decision,
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/api/recovery/cases/:id/execute', async (req, res, next) => {
    try {
      const merchantId = req.get('X-RazCodePay-Merchant-Id') || 'demo-merchant';
      const result = await executeRecoveryAttempt(req.params.id, merchantId);
      return res.json({
        testMode: true,
        duplicate: result.duplicate,
        attempt: result.attempt,
        case: toCaseView(result.recoveryCase.toObject()),
      });
    } catch (error) {
      return res.status(409).json({ error: error.message });
    }
  });

  app.post('/api/recovery/cases/:id/stop', async (req, res, next) => {
    try {
      const merchantId = req.get('X-RazCodePay-Merchant-Id') || 'demo-merchant';
      const reason = String(req.body?.reason || 'merchant_requested_stop').slice(0, 200);
      const item = await RecoveryCase.findOne({ _id: req.params.id, merchantId });
      if (!item) return res.status(404).json({ error: 'Recovery case not found' });

      if (['recovered', 'stopped', 'expired'].includes(item.state)) {
        return res.status(409).json({ error: 'Case is already terminal', state: item.state });
      }

      item.state = 'stopped';
      item.stopReason = reason;
      item.closedAt = new Date();
      item.nextActionAt = null;
      await item.save();

      await writeAudit({
        merchantId,
        caseId: item._id,
        actorType: 'merchant',
        eventName: 'case_stopped_by_merchant',
        details: { reason },
      });

      return res.json({ case: toCaseView(item.toObject()) });
    } catch (error) {
      return next(error);
    }
  });
}
