# Security and Trust Model

RazCodePay handles payment-recovery workflows, so the design separates **decision intelligence**, **authorization**, and **provider truth**.

> **AI recommends. Policy controls. Executor acts. Razorpay verifies.**

## 1. Security principles

### AI is advisory, not authoritative

The local model and optional LLM can recommend an action. They cannot bypass merchant policy or directly perform arbitrary provider operations.

```text
AI recommendation
      ↓
Policy authorization
      ↓
Execution-time policy re-check
      ↓
Provider side effect
```

### Provider events are verified

Razorpay webhook signatures are validated against the raw request body before the event can affect recovery state. Duplicate provider deliveries are handled idempotently.

### Merchant data is isolated

Production-oriented requests are associated with an authenticated merchant identity and role. Application reads/writes are merchant-scoped, and operator mutations are role protected.

### Provider secrets are protected

Merchant provider credentials are encrypted before MongoDB persistence using AES-256-GCM. Secret values are not returned through connection-status APIs or rendered in the UI.

### Demo mode is isolated

`DEMO_MODE=true` uses synthetic data, does not require provider credentials, performs no real provider API calls, and exposes demo-only success/reset controls. Those mutation endpoints are blocked outside demo mode.

## 2. Request and execution trust chain

```text
Authentication
      ↓
Merchant scoping
      ↓
Verified provider event / case
      ↓
Policy pre-filter
      ↓
AI decision
      ↓
Policy re-check
      ↓
Idempotent side effect
      ↓
Verified Razorpay outcome
```

The frontend is never treated as an authorization boundary.

## 3. Sensitive values

Never commit or place in public screenshots/issues:

```text
.env files
Razorpay API secrets
Razorpay webhook secrets
JWT secrets
Encryption keys
SMTP passwords
LLM/API provider secrets
```

## 4. Webhook security

```text
HTTPS request
   ↓
raw body captured
   ↓
HMAC verification
   ↓
deduplication
   ↓
persist event
   ↓
state transition
```

Invalid signatures must not create or close recovery cases.

## 5. Idempotency and consistency

The system protects against duplicate UI clicks, worker retries and provider re-delivery using:

- merchant-scoped case keys
- provider-event deduplication
- deterministic operation identities
- terminal-state checks
- current-case reload before side effects
- execution-time policy re-check
- persisted webhook processing status
- BullMQ retry/backoff

## 6. Monetary truth

The application deliberately distinguishes:

```text
prediction ≠ recommendation ≠ attempted action ≠ recovered revenue
```

Only a verified Razorpay success event can establish the recovery outcome used for recovered revenue attribution.

## 7. Demo vs production-oriented security boundary

| Control | Demo mode | Production-oriented mode |
|---|---|---|
| Authentication | Synthetic workspace | JWT + RBAC |
| Provider credentials | Not required | Encrypted at rest |
| Provider API calls | Disabled | Available when configured |
| Signed provider events | Not required for synthetic data | Required |
| Demo reset/success | Available | Blocked |
| Merchant data | Synthetic | Merchant-scoped |

## 8. Security checklist

- [ ] Invalid webhook signature rejected.
- [ ] Duplicate provider event does not create duplicate business state.
- [ ] Demo-only mutations reject production-oriented mode.
- [ ] Cross-merchant data access is blocked.
- [ ] Viewer cannot perform protected operator mutations.
- [ ] Provider secrets never appear in API responses.
- [ ] Execution re-checks current policy.
- [ ] Stopped/terminal cases cannot be blindly executed again.
- [ ] Recovery is credited only after verified provider success.
- [ ] Authentication endpoints are protected appropriately for deployment.

## 9. Live Mode hardening still required

Before public Live Mode operation, complete:

- managed secret storage and rotation
- HTTPS/network isolation and hardened deployment configuration
- centralized security/audit monitoring
- dependency/vulnerability management
- penetration/security review
- MongoDB backup/restore validation
- messaging delivery/bounce/complaint controls
- model monitoring and outcome calibration
- incident response and operational runbooks
- required Razorpay Technology Partner/OAuth onboarding for the intended multi-merchant model