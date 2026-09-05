# AI and Decision Intelligence

RazCodePay deliberately separates **prediction**, **reasoning**, and **authorization**.

> **AI recommends. Policy controls. Executor acts. Razorpay verifies.**

## 1. End-to-end decision pipeline

```text
Verified provider / case facts
          ↓
Feature construction
          ↓
local-recovery-v2
          ↓
Risk + recoverability + expected recovery opportunity
          ↓
Deterministic policy filter
          ↓
Bounded decision engine
     ┌────┴────┐
   local     optional LLM
     └────┬────┘
          ↓
Execution-time policy re-check
          ↓
Approved provider / communication action
          ↓
Verified Razorpay outcome
```

The model never receives authority to bypass policy or directly perform arbitrary payment operations.

## 2. `local-recovery-v2`

Implementation:

```text
server/src/ai/riskModel.js
```

The buildathon model is deterministic and interpretable. The repository does **not** claim that it was trained on proprietary production transaction labels.

### Signals/features

The scorer derives signals from available case and provider context, including:

- failure-code prior
- recovery-type prior
- event freshness
- customer intent
- customer contact reachability
- communication consent
- amount opportunity
- provider-context completeness
- previous-attempt pressure

### Outputs

A model evaluation can expose:

```text
riskScore
recoverabilityScore
expectedRecoveryMinor
confidence
uncertainty
dataQuality
modelVersion
features
signals
```

### Expected recovery opportunity

`expectedRecoveryMinor` estimates the opportunity value of a case for prioritization. It is not accounting revenue.

```text
expected recovery opportunity ≠ recovered revenue
```

A case is never marked `recovered` from a prediction alone.

## 3. Decision engine

The decision engine first receives an action set that has already been restricted by merchant policy.

Current actions:

```text
wait
send_payment_reminder
create_payment_link
request_payment_method_update
create_human_task
stop_case
```

Decisioning combines recovery potential, transaction opportunity, failure context, confidence and safety conditions.

Examples:

- customer-action/authentication failures can favor `request_payment_method_update` when eligible
- strong recovery potential can favor `create_payment_link`
- recent recoverable signals with valid consent can favor `send_payment_reminder`
- high-value, low-confidence or high-uncertainty cases can move to `create_human_task`
- repeated low-value/low-probability cases can eventually favor `stop_case`

The result is always checked against the supplied allowed action set.

## 4. Optional LLM reasoning

The LLM is optional and configured with:

```env
AI_API_KEY=...
AI_MODEL=gpt-4o-mini
```

The LLM receives normalized case facts plus the action set that policy has already approved.

It is constrained from inventing:

- provider operations
- payment links
- discounts
- deadlines
- customer facts
- disallowed actions

The server validates the returned action. If the model is unavailable, produces malformed output, or proposes an action outside the safe set, the deterministic local decision remains the fallback.

## 5. Why the hybrid design

A payment-recovery system needs both predictive intelligence and hard operational boundaries.

| Layer | Responsibility | Authority |
|---|---|---|
| `local-recovery-v2` | Score recovery potential/risk | Advisory |
| Decision engine | Select one bounded next action | Advisory |
| Optional LLM | Add structured reasoning/explanation | Advisory |
| Policy engine | Allow/block actions | Authoritative |
| Executor | Perform approved side effects | Operational |
| Razorpay | Confirm monetary outcome | External source of truth |

This separation makes the AI inspectable without turning it into an unrestricted payment operator.

## 6. Policy boundaries around AI

Policy can restrict:

- recovery window
- grace period
- quiet hours
- maximum attempts
- automatic-contact cap
- human-review threshold
- allowed channels
- customer consent
- terminal case state

Policy is evaluated before decisioning and again immediately before execution.

```text
policy pre-filter
      ↓
AI decision
      ↓
policy re-check
      ↓
side effect
```

## 7. What operators should see

The Decision Intelligence UI is intended to expose enough evidence to understand a recommendation:

- recommended action
- model version
- recoverability
- risk
- confidence
- uncertainty
- data quality
- expected recovery opportunity
- feature/reason signals
- policy status

Missing model metadata should be represented as unavailable rather than silently converted into a misleading zero.

## 8. How to explain the AI to judges

> “We use a deterministic, interpretable recovery model to estimate risk, recoverability and expected recovery opportunity. Merchant policy defines what actions are allowed. An optional LLM can improve structured reasoning, but it cannot leave that action set. The executor re-checks policy before acting, and revenue is counted only after Razorpay verifies success.”