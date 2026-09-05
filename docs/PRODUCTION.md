# Production and Deployment Guide

This document defines the boundary between the buildathon implementation and a public Live Mode deployment.

## 1. Current buildathon architecture

```text
Browser
  ↓ HTTPS/local dev
React + Vite merchant console
  ↓ Bearer token in production-oriented mode
Express API
  ├── MongoDB — system of record
  ├── Redis + BullMQ — background work
  ├── local-recovery-v2 + policy engine
  ├── Razorpay adapter
  └── communication adapter

Razorpay
  ↓ signed webhook
Webhook verification
  ↓ verified event
Recovery case / outcome
  ↓
MongoDB
```

## 2. Configuration

Production-oriented mode:

```env
DEMO_MODE=false
MONGODB_URI=<mongodb-uri>
REDIS_URL=<redis-uri>
JWT_SECRET=<long-random-secret>
ENCRYPTION_KEY=<secret-key-material>
ALLOWED_ORIGIN=https://<console-domain>
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

Never commit these values.

## 3. MongoDB

MongoDB stores merchant identity/configuration, provider connections, recovery cases, webhook events, audit events, experiments, communications and recovery outcomes.

For a public deployment:

- use managed or hardened MongoDB
- configure backups and test restores
- restrict network access
- use least-privilege credentials
- monitor latency, storage and connections

## 4. Redis and BullMQ

Redis is queue infrastructure only. BullMQ provides delayed jobs, retries and worker execution.

Business state remains in MongoDB and provider events.

For public deployment:

- authenticate Redis connections
- keep Redis off the public network
- monitor queue depth and failed jobs
- retain enough operational history for debugging

## 5. Authentication and secrets

Production-oriented mode uses authenticated merchant users and roles. Passwords are bcrypt-hashed. Provider credentials are encrypted before MongoDB persistence.

Before public launch:

- use a dedicated secret manager
- rotate secrets under an operational policy
- protect authentication endpoints with rate limiting/monitoring
- enforce HTTPS
- finalize browser token/session storage for the deployed frontend

## 6. Razorpay onboarding

The demonstrated hackathon path is a merchant-controlled Razorpay API-key connection in Test Mode.

OAuth authorization-code support exists for the future Technology Partner-style multi-merchant model. The public multi-merchant onboarding flow should use the provider-approved model rather than collecting merchant API secrets unnecessarily.

## 7. Webhooks

Use a stable HTTPS route:

```text
POST https://<domain>/api/webhooks/razorpay/<merchant-id>
```

Required processing order:

```text
raw body
  ↓
signature verification
  ↓
deduplication
  ↓
persist event
  ↓
case correlation/update
  ↓
recovery processing
```

Before Live Mode, test invalid signatures, duplicate delivery and out-of-order events.

## 8. Recovery execution

Before any side effect:

```text
authentication
    ↓
merchant-scoped case
    ↓
policy-approved action
    ↓
execution-time policy re-check
    ↓
idempotent side effect
    ↓
persisted attempt/reference
```

A successful provider API response is not the same as recovered revenue.

## 9. Recovery verification

```text
Recovery action / Payment Link
          ↓
customer completes payment
          ↓
verified Razorpay success event
          ↓
case correlation
          ↓
RecoveryOutcome
          ↓
recovered amount attributed
          ↓
case = recovered
```

This is the monetary truth boundary used by the application.

## 10. Go-live checklist

### Application

- [ ] `DEMO_MODE=false`
- [ ] secrets supplied through a secret manager
- [ ] HTTPS enforced
- [ ] CORS restricted to the real console domain
- [ ] authentication/RBAC tested
- [ ] rate limiting and security headers verified

### Data and queues

- [ ] managed/hardened MongoDB configured
- [ ] backups and restores tested
- [ ] Redis access restricted
- [ ] worker monitoring configured
- [ ] retries and failure handling validated

### Razorpay

- [ ] Test Mode integration verified
- [ ] stable webhook endpoint configured
- [ ] signature verification tested
- [ ] duplicate/out-of-order events tested
- [ ] `payment.failed` case creation verified
- [ ] Payment Link → provider success → recovery attribution verified
- [ ] partner/OAuth onboarding completed for the intended multi-merchant model

### Communications

- [ ] authenticated SMTP/provider configured
- [ ] delivery/bounce/complaint handling available
- [ ] templates reviewed
- [ ] consent/suppression rules tested

### Security and operations

- [ ] dependency audit and remediation complete
- [ ] penetration/security review complete
- [ ] centralized logs/metrics configured
- [ ] alerts and incident runbooks prepared
- [ ] secret rotation documented
- [ ] restore procedure tested

## 11. Boundary statement

The buildathon artifact is a complete, provider-grounded recovery control plane demonstrated locally and in Razorpay Test Mode. It is **production-oriented**, not presented as an already-operated public Live Mode payment-recovery SaaS.

The remaining Live Mode work is operational hardening, security review, provider onboarding, observability, messaging reliability and production outcome calibration.