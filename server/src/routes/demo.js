import { RecoveryCase } from '../models/RecoveryCase.js';
import { IncomingEvent } from '../models/IncomingEvent.js';
import { AuditLog } from '../models/AuditLog.js';
import { writeAudit } from '../services/audit.js';

const DEMO_MERCHANT = 'demo-merchant';

function buildCase(index) {
  const recovered = index < 24;
  const stopped = index >= 48;
  const amountMinor = 25000 + ((index * 17300) % 450000);
  const failureCodes = ['insufficient_funds', 'network_error', 'authentication_required', 'payment_failed'];
  const type = index % 3 === 0 ? 'failed_subscription' : index % 3 === 1 ? 'invoice_overdue' : 'checkout_abandonment';

  return {
    merchantId: DEMO_MERCHANT,
    caseKey: `demo:${index}`,
    type,
    state: recovered ? 'recovered' : stopped ? 'stopped' : index % 4 === 0 ? 'planned' : 'awaiting_window',
    amountMinor,
    currency: 'INR',
    customerId: `demo-customer-${index + 1}`,
    providerEntityId: `pay_demo_${index + 1}`,
    providerEntityType: 'payment',
    failureCode: failureCodes[index % failureCodes.length],
    failureDescription: 'Synthetic demo failure generated locally.',
    riskScore: Math.min(1, 0.35 + (index % 7) * 0.08),
    recoverabilityScore: Math.min(1, 0.45 + (index % 6) * 0.08),
    consent: { email: index % 9 !== 8, sms: false, whatsapp: false },
    attemptCount: index % 3,
    nextActionAt: recovered || stopped ? null : new Date(Date.now() + (index % 5) * 15 * 60 * 1000),
    recoveredAmountMinor: recovered ? amountMinor : 0,
    recoveredProviderId: recovered ? `pay_demo_${index + 1}` : null,
    openedAt: new Date(Date.now() - (index + 1) * 60 * 60 * 1000),
    closedAt: recovered || stopped ? new Date() : null,
    stopReason: stopped ? 'synthetic_customer_opt_out' : null,
    explanation: recovered
      ? 'Recovered from a verified synthetic success event.'
      : stopped
        ? 'Automation stopped by a synthetic opt-out condition.'
        : 'Awaiting the next policy-approved recovery step.',
  };
}

export function registerDemoRoutes(app) {
  app.post('/api/demo/seed', async (_req, res) => {
    const merchantId = DEMO_MERCHANT;
    await Promise.all([
      RecoveryCase.deleteMany({ merchantId }),
      IncomingEvent.deleteMany({ merchantId }),
      AuditLog.deleteMany({ merchantId }),
    ]);

    const cases = Array.from({ length: 60 }, (_, index) => buildCase(index));
    const inserted = await RecoveryCase.insertMany(cases, { ordered: true });

    await writeAudit({
      merchantId,
      eventName: 'demo_batch_seeded',
      details: { caseCount: inserted.length, recoveredCount: 24, stoppedCount: 12 },
    });

    res.json({ seeded: inserted.length, merchantId });
  });
}
