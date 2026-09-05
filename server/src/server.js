import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { config, validateConfiguration } from './config.js';
import { connectDatabase } from './db.js';
import { registerWebhookRoutes } from './routes/webhooks.js';
import { registerCaseRoutes } from './routes/cases.js';
import { RecoveryCase } from './models/RecoveryCase.js';

const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: config.allowedOrigin }));

// Webhooks must receive the exact bytes Razorpay signed. JSON parsing happens later.
app.use('/api/webhooks/razorpay', express.raw({ type: 'application/json', limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    service: 'RazCodePay Recovery API',
    status: 'ok',
    track: '03',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

app.get('/api/recovery/summary', async (req, res) => {
  const merchantId = req.get('X-RazCodePay-Merchant-Id') || 'demo-merchant';
  const [summary] = await RecoveryCase.aggregate([
    { $match: { merchantId } },
    {
      $group: {
        _id: null,
        revenueAtRisk: { $sum: { $cond: [{ $ne: ['$state', 'recovered'] }, '$amountMinor', 0] } },
        recoveredRevenue: { $sum: '$recoveredAmountMinor' },
        totalCases: { $sum: 1 },
        openCases: { $sum: { $cond: [{ $in: ['$state', ['detected', 'enriched', 'awaiting_window', 'planned', 'executing', 'monitoring']] }, 1, 0] } },
        recoveredCases: { $sum: { $cond: [{ $eq: ['$state', 'recovered'] }, 1, 0] } },
      },
    },
  ]);

  const data = summary || { revenueAtRisk: 0, recoveredRevenue: 0, totalCases: 0, openCases: 0, recoveredCases: 0 };
  res.json({
    revenueAtRisk: data.revenueAtRisk,
    recoveredRevenue: data.recoveredRevenue,
    recoveryRate: data.totalCases ? data.recoveredCases / data.totalCases : 0,
    openCases: data.openCases,
    totalCases: data.totalCases,
  });
});

registerWebhookRoutes(app);
registerCaseRoutes(app);

app.use((error, _req, res, _next) => {
  console.error('Unhandled API error:', error.message);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  const warnings = validateConfiguration();
  warnings.forEach((warning) => console.warn(`Configuration warning: ${warning}`));

  await connectDatabase();
  app.listen(config.port, () => {
    console.log(`RazCodePay Recovery API running on port ${config.port}`);
  });
}

start().catch((error) => {
  console.error('Server startup failed:', error);
  process.exit(1);
});

process.on('SIGINT', async () => {
  await mongoose.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await mongoose.disconnect();
  process.exit(0);
});
