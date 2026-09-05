# RazCodePay Phase 2

Phase 2 turns the Track 03 prototype into a production-oriented recovery platform while keeping MongoDB as the system of record.

## Added

### 1. Background recovery jobs
- Redis + BullMQ queue
- delayed recovery evaluation
- retry/backoff configuration
- concurrency-ready worker
- queue health endpoint: `GET /api/phase2/queue`

The API still works without Redis; the queue is enabled when `DEMO_MODE=false` and `REDIS_URL` is configured.

### 2. Real customer email adapter
SMTP-backed email delivery is available through `server/src/services/mailer.js`. Missing SMTP configuration suppresses the send instead of silently pretending a message was delivered.

### 3. Recovery experiments
MongoDB stores experiments, arms and outcome data.

Endpoints:
- `GET /api/phase2/experiments`
- `POST /api/phase2/experiments`
- `POST /api/phase2/experiments/:id/start`
- `POST /api/phase2/experiments/:id/stop`
- `GET /api/phase2/experiments/metrics`

Allocation is deterministic by case ID so a case stays in the same experiment bucket.

### 4. Outcome learning
Every verified recovery records the intervention, experiment arm, recovered amount, time to recovery and model version. This creates the feedback loop required to train future recovery models on real merchant outcomes.

### 5. Razorpay OAuth
The integration layer supports the Razorpay Technology Partner authorization-code flow, encrypted access/refresh tokens, expiry tracking and token refresh. Razorpay requires Technology Partners to use OAuth to access sub-merchant resources without requiring merchants to disclose their API-key secret.

### 6. Payment Link recovery
Eligible cases can create a real Razorpay Payment Link in production mode. The link uses a unique case-based `reference_id`, and the case is only marked recovered after a provider success event.

### 7. Merchant communication history
Communication events are persisted in MongoDB and can be queried per recovery case.

## Production environment

Required core variables:

```text
DEMO_MODE=false
MONGODB_URI=...
REDIS_URL=...
JWT_SECRET=...
ENCRYPTION_KEY=...
```

For OAuth:

```text
RAZORPAY_OAUTH_CLIENT_ID=...
RAZORPAY_OAUTH_CLIENT_SECRET=...
RAZORPAY_OAUTH_REDIRECT_URI=https://<your-domain>/api/integrations/razorpay/oauth/callback
```

For email:

```text
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
MAIL_FROM=...
```

## Remaining go-live work
- complete Razorpay Technology Partner approval/onboarding
- configure production HTTPS and webhook URLs
- production secret manager rather than `.env`
- real delivery-provider webhooks for delivery/bounce status
- centralized monitoring and alerting
- penetration testing and dependency remediation
- model calibration and training from sufficient production outcome volume
