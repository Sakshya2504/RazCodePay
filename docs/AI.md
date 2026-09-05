# AI implementation

## Decision pipeline

RazCodePay uses an interpretable local scoring model, optional LLM reasoning, and a deterministic policy layer.

```text
provider facts
   │
   ├── local-recovery-v2
   │      ├── calibrated recoverability score
   │      ├── operational risk score
   │      ├── expected recovery value
   │      ├── confidence / uncertainty
   │      └── feature-level signals
   │
   ├── optional OpenAI LLM
   │      └── structured reasoning over allowed actions
   │
   └── deterministic policy
          └── final action set + execution re-check
```

## Local model

`server/src/ai/riskModel.js` is an interpretable hybrid scorer. It is deliberately small and deterministic enough to audit in a hackathon review; it does **not** claim to be trained on proprietary production labels.

The model combines:

- failure-code priors and recovery type priors
- event freshness with time-decay behavior
- customer intent and contact reachability
- consent availability
- amount opportunity
- prior-attempt pressure
- provider-context completeness

It exposes `riskScore`, `recoverabilityScore`, `expectedRecoveryMinor`, `confidence`, `uncertainty`, `dataQuality`, model version and feature signals. This makes the recommendation explainable instead of presenting an opaque probability.

## Action selection

The local decision layer chooses only from the policy-approved action set. It considers both recoverability and expected recovered value, while routing high-value, low-confidence or high-uncertainty cases toward human review.

Known failure profiles can also steer the action toward a payment-method update rather than a generic reminder when the provider evidence supports that choice.

## LLM mode

Set:

```env
AI_API_KEY=...
AI_MODEL=gpt-4o-mini
```

The LLM receives normalized case facts plus the already-approved action set. The prompt forbids inventing discounts, provider operations, deadlines, payment links, or customer facts.

The response is accepted only when its action is in the allowed set. Invalid output or API failure falls back to the local model.

## Guardrails

The LLM and local model never override deterministic merchant policy. Consent, quiet hours, attempt caps, value thresholds and recovery-window rules are enforced before planning and checked again immediately before execution.

The recovery grace period is merchant-configurable. A new failure is placed into a protected waiting window before customer-facing action is eligible.

## What to show judges

Open **AI decisions** and inspect a case. Point out:

1. recoverability and risk
2. expected recovery value
3. confidence, uncertainty and data quality
4. feature-level reason codes
5. the selected action and model version
6. the policy boundaries shown in Guardrails

The core operating contract remains:

```text
AI recommends
Policy authorizes
Executor acts
Razorpay verifies
```
