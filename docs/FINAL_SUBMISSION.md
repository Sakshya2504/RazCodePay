# Final Hackathon Submission Checklist

This is the final repository handoff for the RazCodePay buildathon submission.

## 1. Product identity

- **Product:** RazCodePay
- **Descriptor:** AI Revenue Recovery Platform
- **Track:** Razorpay AI Buildathon · Track 03
- **Core message:** **AI recommends. Policy controls. Executor acts. Razorpay verifies.**

## 2. What the submission demonstrates

```text
Razorpay failure
      ↓
Verified webhook
      ↓
MongoDB recovery case
      ↓
local-recovery-v2 scoring
      ↓
Deterministic policy filter
      ↓
Bounded recommendation
      ↓
Eligible recovery action
      ↓
Verified Razorpay success
      ↓
Recovered outcome
```

The implementation demonstrates:

- merchant registration/login and merchant-scoped access
- Razorpay Test Mode connection through merchant-controlled credentials
- signed, merchant-specific webhook ingestion
- recovery-case creation and correlation
- interpretable `local-recovery-v2` scoring
- expected recovery opportunity for prioritization
- deterministic merchant guardrails
- bounded optional LLM reasoning
- idempotent recovery execution
- Razorpay Payment Link creation for eligible cases
- communication/audit history where configured
- provider-grounded recovery attribution
- operations, experiments and queue visibility
- merchant profile and sign-out controls

## 3. Judge flow

```text
Login
  ↓
Merchant workspace
  ↓
Razorpay Test Mode status
  ↓
Command Center
  ↓
Recovery Case
  ↓
Decision Intelligence
  ↓
Policy & Controls
  ↓
Execute eligible action
  ↓
Verified provider success
  ↓
Recovered outcome
```

See [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) for the exact recording flow and spoken script.

## 4. Repository review order

1. [`README.md`](../README.md) — product overview and setup.
2. [`architecture.md`](../architecture.md) — components, lifecycle and trust boundaries.
3. [`AI.md`](./AI.md) — scoring and bounded reasoning.
4. [`API.md`](./API.md) — API surface and invariants.
5. [`SECURITY.md`](./SECURITY.md) — security model.
6. [`PHASE2.md`](./PHASE2.md) — operations, queues, experiments and communications.
7. [`PRODUCTION.md`](./PRODUCTION.md) — Live Mode deployment boundary.
8. [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) — final judge demo.

## 5. Claims discipline

Use these terms consistently:

### Accurate

- production-oriented implementation
- Razorpay Test Mode integration
- deterministic interpretable recovery model
- expected recovery opportunity
- optional bounded LLM reasoning
- merchant-defined policy guardrails
- provider-grounded recovery attribution

### Do not claim

- fully operated public SaaS
- guaranteed recovery
- trained on proprietary production data unless independently evidenced
- autonomous AI control over payments
- live-money recovery for the buildathon demo

## 6. Recording checklist

- [ ] Start from the Login page.
- [ ] Show the authenticated merchant workspace.
- [ ] Briefly show Razorpay Test Mode connection status.
- [ ] Show Command Center metrics.
- [ ] Open one strong failed-payment recovery case.
- [ ] Show recoverability, risk, confidence, uncertainty, data quality and expected recovery opportunity.
- [ ] Show reason signals and model version.
- [ ] Show Policy & Controls.
- [ ] Execute only an eligible recovery action.
- [ ] Show provider reference/attempt history where available.
- [ ] Show provider-confirmed recovered state or clearly marked demo simulation.
- [ ] End on Command Center.
- [ ] Keep all secrets and tokens off-screen.

## 7. Technical submission checklist

- [ ] MongoDB is documented as the application system of record.
- [ ] Redis/BullMQ is documented as asynchronous infrastructure only.
- [ ] `DEMO_MODE=false` requires authentication and merchant scope.
- [ ] Provider secrets are encrypted and never returned by status endpoints.
- [ ] Invalid webhook signatures are rejected.
- [ ] Duplicate provider events are idempotent.
- [ ] Policy is applied before planning and again before execution.
- [ ] Terminal/stopped cases are protected from repeated execution.
- [ ] Recovery is not counted from prediction, email or Payment Link creation alone.
- [ ] Demo-only reset/success endpoints are blocked outside demo mode.
- [ ] CI tests cover bounded AI decisioning and recovery-event idempotency.

## 8. Current implementation boundary

The final artifact is a complete buildathon demonstration of the recovery control plane in local and Razorpay Test Mode environments. It is intentionally described as **production-oriented** rather than an already-operated public Live Mode service.

A public Live Mode launch would still require operational hardening such as managed infrastructure, backups, centralized observability, secret rotation, formal security testing, production messaging delivery/bounce handling, outcome-based model calibration and any required Razorpay partner/OAuth onboarding for a multi-merchant service.

## 9. Final submission sentence

> **RazCodePay turns payment failure into a controlled recovery loop: detect the opportunity, explain the risk, respect merchant policy, execute the safest next step, and count the money only when Razorpay verifies it came back.**