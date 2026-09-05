# Operations and Advanced Recovery Capabilities

This document describes the operational layer around the core Track 03 recovery workflow.

## 1. Background recovery

Redis + BullMQ handles asynchronous recovery evaluation and delayed/retried work.

Implemented capabilities:

- dedicated recovery queue
- delayed evaluation jobs
- retry/backoff behavior
- concurrent worker execution
- queue-health visibility via `GET /api/phase2/queue`

MongoDB remains the durable system of record. Redis is orchestration infrastructure, not business state.

## 2. Communication adapter

SMTP-backed email delivery is implemented through `server/src/services/mailer.js`.

The system records communication attempts. When SMTP is unavailable, the send is suppressed rather than represented as successfully delivered.

This keeps the audit trail honest.

## 3. Recovery experiments

Experiments are persisted in MongoDB and can contain control/treatment arms and outcome data.

```text
GET  /api/phase2/experiments
POST /api/phase2/experiments
POST /api/phase2/experiments/:id/start
POST /api/phase2/experiments/:id/stop
GET  /api/phase2/experiments/metrics
```

Assignment is deterministic by case identity so a case remains in the same experiment arm.

## 4. Outcome feedback

Verified recovery outcomes record the intervention, experiment arm when applicable, recovered amount, time to recovery and model version.

This creates the foundation for future calibration and training. The current repository does not claim `local-recovery-v2` was trained on proprietary production labels.

## 5. Razorpay integration modes

The current hackathon path uses a merchant-controlled API-key connection in Razorpay Test Mode.

OAuth authorization-code support is retained for a future Technology Partner-style multi-merchant onboarding model. It should not be confused with the current demo's API-key path.

## 6. Payment Link recovery

Eligible provider-connected cases can create a real Razorpay Payment Link.

The recovery case stores provider correlation/reference data so later events can be matched.

```text
Payment Link created ≠ revenue recovered
```

Only a verified provider-success event closes the monetary loop.

## 7. Communication history

Communication events are stored in MongoDB and are queryable by case:

```text
GET /api/phase2/cases/:caseId/communications
```

The record captures send status and provider references when available.

## 8. Merchant operations console

The Operations experience exposes:

- Razorpay connection state
- merchant recovery policy
- experiments
- queue health
- communication history
- merchant account/profile state

The frontend is not the security boundary. Authorization, policy and execution controls are enforced by the backend.

## 9. Configuration groups

Core:

```env
DEMO_MODE=false
MONGODB_URI=...
REDIS_URL=...
JWT_SECRET=...
ENCRYPTION_KEY=...
```

Optional AI:

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

Optional future OAuth:

```env
RAZORPAY_OAUTH_CLIENT_ID=...
RAZORPAY_OAUTH_CLIENT_SECRET=...
RAZORPAY_OAUTH_REDIRECT_URI=https://<domain>/api/integrations/razorpay/oauth/callback
```

## 10. What is complete for the buildathon

```text
Webhook → case → AI score → policy → execution → provider verification
```

The buildathon artifact also includes queueing, retries, communication auditing, experiments, payment-link correlation, account/profile controls and recovery-outcome persistence.

## 11. Future Live Mode hardening

A public Live Mode service would additionally require:

- managed infrastructure and database backups
- centralized logs, metrics and alerting
- production secret management and rotation
- hardened HTTPS/network configuration
- messaging delivery, bounce and complaint handling
- dependency and vulnerability management
- penetration/security testing
- model calibration against sufficient real outcomes
- incident and recovery runbooks
- required Razorpay Technology Partner/OAuth onboarding for the intended multi-merchant model