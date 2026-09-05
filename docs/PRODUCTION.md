# Production and Deployment Guide

This document defines the boundary between the buildathon implementation and a public Live Mode deployment.

## 1. Reference architecture

```text
Browser
  ↓ HTTPS
React / Vite console
  ↓ Bearer token
Express API
  ├── MongoDB (system of record)
  ├── Redis / BullMQ (background work)
  ├── Recovery model + policy engine
  ├── Razorpay adapter
  └── Communication adapter

Razorpay
  ↓ signed webhook
Webhook gateway
  ↓ verified event
Recovery verification
  ↓
MongoDB recovery outcome
```

## 2. Required production-oriented configuration

```env
DEMO_MODE=false
MONGODB_URI=<managed-or-hardened-mongodb-uri>
REDIS_URL=<redis-uri>
JWT_SECRET=<long-random-secret>
ENCRYPTION_KEY=<32-byte-secret-or-provider-compatible-key>
ALLOWED_ORIGIN=https://<your-console-domain>
```

Optional AI:

```env
AI_API_KEY=<provider-secret>
AI_MODEL=<approved-model>
```

Optional SMTP:

```env
SMTP_HOST=<smtp-host>
SMTP_PORT=587
SMTP_USER=<smtp-user>
SMTP_PASSWORD=<smtp-password>
MAIL_FROM=<verified-sender>
```

Never commit these values to source control.

## 3. MongoDB

MongoDB is the durable application system of record. It stores merchant identity/configuration, provider connections, recovery cases, webhook events, audit events, experiments, communications and recovery outcomes.

For a public deployment:

- use managed or hardened MongoDB
- enable backups and point-in-time recovery where available
- restrict network access
- use least-privilege database credentials
- monitor storage, latency and connection usage

## 4. Redis / BullMQ

Redis is infrastructure for asynchronous work, not the business database.

The worker uses BullMQ for delayed/retried recovery jobs. Business state must remain reconstructable from MongoDB and provider events.

For a public deployment:

- use authenticated Redis access
- isolate Redis from the public network
- monitor queue depth and failed jobs
- retain enough failure history for incident debugging

## 5. Authentication and secrets

Production-oriented mode authenticates merchants and applies role checks. Passwords are bcrypt-hashed and provider credentials are encrypted before MongoDB persistence.

For public deployment:

- place secrets in a dedicated secret manager
- rotate JWT and encryption secrets according to an operational policy
- protect authentication endpoints with rate limits and monitoring
- use HTTPS everywhere
- use secure cookie/token storage appropriate to the final frontend architecture

## 6. Razorpay connection

For the current buildathon workflow, an owner-controlled merchant can connect Razorpay Test Mode using API credentials. The application verifies the connection before reporting it as healthy and stores the secret material encrypted.

For a multi-merchant Technology Partner platform, the intended long-term onboarding mechanism is the provider-approved OAuth flow rather than asking merchants to disclose API-key secrets.

## 7. Webhooks

Use a stable HTTPS endpoint:

```text
POST https://<your-domain>/api/webhooks/razorpay/<merchant-id>
```

The handler must:

1. receive the raw request body
2. validate the provider signature
3. identify/de-duplicate the provider event
4. persist the webhook record
5. apply only verified events to the recovery state machine

Test duplicate delivery and malformed/invalid signatures before Live Mode.

## 8. Recovery execution

Before a side effect, the executor reloads the current case and evaluates current merchant policy.

The action must satisfy:

```text
authenticated merchant
        ↓
merchant-scoped case
        ↓
policy-approved action
        ↓
execution-time re-check
        ↓
idempotent side effect
        ↓
persisted attempt/provider reference
```

A successful API response from Razorpay is still not equivalent to recovered revenue.

## 9. Recovery verification

The monetary metric is provider-grounded:

```text
Payment Link / recovery action
          ↓
customer completes payment
          ↓
verified Razorpay success event
          ↓
case correlation
          ↓
recovered outcome
```

This prevents the dashboard from counting attempted interventions as revenue recovered.

## 10. Go-live checklist

### Application

- [ ] `DEMO_MODE=false`
- [ ] production secrets supplied through a secret manager
- [ ] HTTPS enforced
- [ ] correct CORS origin configured
- [ ] authentication and role permissions tested
- [ ] rate limiting and security headers verified

### Data and queues

- [ ] managed/hardened MongoDB configured
- [ ] backups tested
- [ ] Redis access restricted
- [ ] worker monitoring configured
- [ ] retry/failure behavior validated

### Razorpay

- [ ] Test Mode integration completed
- [ ] merchant webhook endpoint configured
- [ ] signature validation tested
- [ ] duplicate and out-of-order events tested
- [ ] `payment.failed` → case creation verified
- [ ] Payment Link → success event → recovery attribution verified
- [ ] required Technology Partner/OAuth onboarding completed for the multi-merchant model

### Communications

- [ ] authenticated SMTP/provider configured
- [ ] delivery/bounce/complaint handling available before broad customer outreach
- [ ] templates reviewed
- [ ] suppression/consent rules tested

### Security and operations

- [ ] dependency audit completed
- [ ] vulnerability remediation completed
- [ ] penetration/security review completed
- [ ] logs and metrics centralized
- [ ] alerts and incident runbooks prepared
- [ ] secret rotation procedure documented
- [ ] restore-from-backup procedure tested

## 11. Current buildathon boundary

The repository is ready to demonstrate the complete workflow locally and in Razorpay Test Mode. It is intentionally not described as an already-operated public payment-recovery SaaS.

The remaining production work above is operational hardening, provider onboarding, observability and security—not a requirement to understand the core recovery architecture demonstrated by this submission.
