# Security and Trust Model

RazCodePay handles payment-recovery workflows, so the design separates **decision intelligence** from **authorization and provider truth**.

## Security principles

### 1. AI is not an authority

The model and optional LLM can recommend an action, but they cannot bypass deterministic merchant policy or directly perform arbitrary provider operations.

```text
AI recommendation
      ↓
Policy authorization
      ↓
Execution-time policy re-check
      ↓
Provider side effect
```

### 2. Provider events are verified

Razorpay webhook signatures are validated against the raw request body before the application trusts the event.

Duplicate deliveries are handled using the provider event identifier when available, with deterministic fallback hashing.

### 3. Merchant isolation

Production-oriented requests are associated with an authenticated merchant identity. Database reads and writes are merchant-scoped, and role checks protect operator-facing mutations.

### 4. Provider secrets are protected

Merchant provider credentials are encrypted before MongoDB persistence using AES-256-GCM. Provider secrets are not returned through the connection-status API or rendered in the merchant console.

For a multi-merchant partner platform, the intended long-term model is provider-approved OAuth onboarding rather than collecting merchant API-key secrets.

### 5. Demo mode is isolated

`DEMO_MODE=true` is designed for safe demonstrations:

- synthetic workspace/data
- no provider credentials required
- no real provider calls
- synthetic success simulation

Demo-only endpoints are blocked in production-oriented mode.

## Sensitive values

Never commit or paste into public issues/screenshots:

```text
.env files
Razorpay key secrets
Razorpay webhook secrets
JWT secrets
Encryption keys
SMTP passwords
LLM/API provider secrets
```

## Webhook security

The expected provider path is:

```text
HTTPS endpoint
   ↓
raw body captured
   ↓
HMAC verification
   ↓
event de-duplication
   ↓
persist verified webhook
   ↓
recovery state transition
```

An invalid signature must not create or close a recovery case.

## Idempotency

Recovery actions use deterministic operation identities and the executor re-checks case state before side effects. This protects against duplicate UI clicks, worker retries and repeated provider delivery.

## Monetary truth

The dashboard deliberately distinguishes:

```text
prediction ≠ recommendation ≠ attempted action ≠ recovered revenue
```

Only a verified Razorpay success event can establish the monetary recovery outcome used by the platform.

## Operational hardening before Live Mode

A public deployment should additionally complete:

- managed secret storage and rotation
- HTTPS and network isolation
- authentication/session hardening appropriate to the deployed frontend
- centralized logging and security monitoring
- dependency/vulnerability scanning
- penetration/security testing
- database backup/restore testing
- incident response procedures
- messaging delivery/bounce/complaint controls
- model monitoring and calibration

## Security review checklist

- [ ] invalid webhook signature rejected
- [ ] duplicate webhook does not create duplicate business state
- [ ] demo-only mutation endpoints reject production mode
- [ ] unauthorized merchant cannot access another merchant's cases
- [ ] viewer cannot perform operator mutations
- [ ] provider secrets never appear in API responses
- [ ] execution re-checks current policy
- [ ] stopped/terminal cases cannot be executed again
- [ ] recovery is credited only after verified provider success
