# Operations and Advanced Recovery Capabilities

Phase 2 extends the core Track 03 workflow into an operational recovery platform while preserving a strict separation between durable business state and background infrastructure.

## 1. Background recovery jobs

Redis + BullMQ provides asynchronous execution for recovery evaluation and delayed work.

Implemented:

- dedicated recovery queue
- delayed jobs
- retry/backoff behavior
- concurrent worker execution
- queue health endpoint: `GET /api/phase2/queue`

MongoDB remains the source of truth. If Redis is unavailable, the HTTP API can still expose durable application state; queue-backed execution simply becomes unavailable until infrastructure recovers.

## 2. Communication adapter

SMTP-backed email delivery is implemented through `server/src/services/mailer.js`.

The system records communication attempts. When SMTP is not configured, it suppresses the outbound send rather than pretending that a customer message was delivered.

This distinction is important for auditability.

## 3. Recovery experiments

Experiments are persisted in MongoDB and can contain treatment/control arms and outcome data.

Endpoints:

```text
GET  /api/phase2/experiments
POST /api/phase2/experiments
POST /api/phase2/experiments/:id/start
POST /api/phase2/experiments/:id/stop
GET  /api/phase2/experiments/metrics
```

Assignment is deterministic by case identity so a recovery case stays in the same experiment bucket.

## 4. Outcome feedback loop

Verified recoveries persist the intervention, experiment arm when applicable, recovered amount, recovery timing and model version.

This creates the data foundation for future calibration and model training. The current repository does not claim that `local-recovery-v2` was trained on a production dataset.

## 5. Razorpay OAuth capability

The integration layer contains OAuth authorization-code flow support for a Technology Partner-style deployment, including protected token persistence and refresh handling where configured.

For the current single-merchant hackathon workflow, direct merchant API-key integration in Test Mode is the practical path. A multi-merchant SaaS should use the provider-approved partner/OAuth onboarding model rather than collecting merchant API secrets directly.

## 6. Payment Link recovery

Eligible cases can create a real Razorpay Payment Link in provider-connected mode.

The recovery case stores the provider correlation/reference so subsequent events can be matched. Creating the link does not close the case.

Only verified provider success can produce a recovered outcome.

## 7. Communication history

Communication events are stored in MongoDB and are queryable by recovery case:

```text
GET /api/phase2/cases/:caseId/communications
```

The record distinguishes outbound status and provider references when available.

## 8. Operational controls

The merchant console exposes:

- Razorpay connection state
- recovery policy
- experiment controls
- queue health
- communication history
- account/profile state

The frontend is not the security boundary; policy and authorization are enforced by the backend.

## 9. Environment groups

Core production-oriented configuration:

```env
DEMO_MODE=false
MONGODB_URI=...
REDIS_URL=...
JWT_SECRET=...
ENCRYPTION_KEY=...
```

Optional LLM:

```env
AI_API_KEY=...
AI_MODEL=gpt-4o-mini
```

Optional SMTP:

```env
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
MAIL_FROM=...
```

Optional Razorpay OAuth:

```env
RAZORPAY_OAUTH_CLIENT_ID=...
RAZORPAY_OAUTH_CLIENT_SECRET=...
RAZORPAY_OAUTH_REDIRECT_URI=https://<domain>/api/integrations/razorpay/oauth/callback
```

## 10. Remaining go-live work

The buildathon implementation is production-oriented, but a public Live Mode service would still require:

- managed infrastructure and database backups
- centralized logs, metrics and alerting
- production secret management and rotation
- HTTPS and hardened network configuration
- messaging delivery/bounce/complaint handling
- penetration testing and formal security review
- dependency and vulnerability management
- model calibration against sufficient real outcomes
- operational incident/runbook coverage
- Razorpay Technology Partner/OAuth onboarding for the intended multi-merchant business model
