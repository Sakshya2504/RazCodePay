import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get('/api/health', (_req, res) => {
  res.json({ service: 'RazCodePay Recovery API', status: 'ok', track: '03' });
});

app.get('/api/recovery/summary', (_req, res) => {
  res.json({
    revenueAtRisk: 0,
    recoveredRevenue: 0,
    recoveryRate: 0,
    openCases: 0,
    message: 'Recovery engine scaffold ready for Razorpay test-mode events.'
  });
});

app.post('/api/webhooks/razorpay', (req, res) => {
  // Signature verification and durable event persistence will be added next.
  res.status(202).json({ received: true });
});

app.listen(PORT, () => {
  console.log(`RazCodePay Recovery API running on port ${PORT}`);
});
