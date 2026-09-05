# Final Hackathon Submission Checklist

This checklist is for the final RazCodePay repository, demo and submission form.

## Product identity

- Product: **RazCodePay**
- Descriptor: **AI Revenue Recovery Platform**
- Track: **Razorpay AI Buildathon — Track 03**
- Core message: **AI recommends. Policy controls. Executor acts. Razorpay verifies.**

## What the submission demonstrates

- Failed Razorpay payment enters the recovery workflow through a verified webhook.
- Recovery case is persisted in MongoDB.
- `local-recovery-v2` scores recovery potential, risk and expected recovery value.
- Deterministic merchant policy constrains the action space.
- Optional LLM reasoning operates only inside the approved action set.
- Execution performs only an eligible, policy-approved action.
- Razorpay Payment Link creation can be demonstrated in Test Mode.
- Recovery is credited only after verified provider success.
- Merchant dashboard exposes the case lifecycle, AI reasoning and policy controls.

## Recommended judge flow

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
Execute eligible recovery
  ↓
Verified provider success
  ↓
Recovered outcome
```

See [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) for the full spoken script.

## Repository review path

For judges reviewing code, start here:

1. [`README.md`](../README.md) — product overview, stack, setup and API map.
2. [`architecture.md`](../architecture.md) — system architecture and trust boundaries.
3. [`AI.md`](./AI.md) — model and bounded reasoning design.
4. [`API.md`](./API.md) — HTTP/API surface.
5. [`SECURITY.md`](./SECURITY.md) — security invariants and hardening boundary.
6. [`PHASE2.md`](./PHASE2.md) — asynchronous jobs, experiments and operations.
7. [`PRODUCTION.md`](./PRODUCTION.md) — deployment/go-live boundary.
8. [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) — judge recording flow.

## Final recording checklist

- [ ] Login page visible in the opening frame.
- [ ] Product name and AI Revenue Recovery descriptor visible.
- [ ] Razorpay Test Mode clearly indicated.
- [ ] One real/verified Test Mode failure case shown.
- [ ] AI decision metrics shown: recoverability, risk, expected value, confidence/uncertainty.
- [ ] Policy guardrails shown.
- [ ] Execution history/provider reference shown when available.
- [ ] Verified recovery state shown.
- [ ] Final frame returned to the Command Center.
- [ ] No secrets, tokens or environment values visible anywhere.

## Claims discipline

Use precise language in the submission:

### Say

- “production-oriented implementation”
- “Razorpay Test Mode integration”
- “deterministic interpretable recovery model”
- “optional bounded LLM reasoning”
- “provider-grounded recovery attribution”

### Avoid saying

- “fully production SaaS”
- “trained on millions of real transactions” unless independently evidenced
- “guaranteed recovery”
- “AI autonomously controls payments”
- “live-money recovery” for the current hackathon demonstration

## Final technical checks

- [ ] `DEMO_MODE=false` path requires authentication.
- [ ] Merchant data is scoped to the authenticated workspace.
- [ ] Razorpay connection status never exposes provider secrets.
- [ ] Invalid webhook signatures are rejected.
- [ ] Duplicate provider events are safely handled.
- [ ] Policy is checked before planning and before execution.
- [ ] Demo-only endpoints are blocked outside demo mode.
- [ ] Recovery is not credited from prediction or action creation alone.
- [ ] Redis/BullMQ is described as queue infrastructure, not the database.
- [ ] MongoDB is consistently described as the application system of record.

## Final submission sentence

> **RazCodePay turns payment failure into a controlled recovery loop: detect the opportunity, explain the risk, respect merchant policy, execute the safest next step, and count the money only when Razorpay verifies it came back.**
