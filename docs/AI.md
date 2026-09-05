# AI and Decision Intelligence

RazCodePay separates **prediction**, **reasoning**, and **authorization**.

> **AI recommends. Policy controls. Executor acts. Razorpay verifies.**

## 1. Decision pipeline

```text
Verified provider / case facts
          ↓
Feature construction
          ↓
local-recovery-v2
   ├─ risk score
   ├─ recoverability score
   ├─ expected recovery value
   ├─ confidence / uncertainty
   └─ feature signals
          ↓
Policy-approved action set
          ↓
Decision engine
          ├─ local deterministic recommendation
          └─ optional LLM reasoning
          ↓
Execution-time policy re-check
          ↓
Provider / communication action
          ↓
Verified Razorpay outcome
```

## 2. Local recovery model

The implementation lives at `server/src/ai/riskModel.js` and is versioned as:

```text
local-recovery-v2
```

The model is intentionally deterministic and interpretable for the buildathon. It does **not** claim to be trained on proprietary production labels.

### Features

The scorer derives signals from:

- failure-code priors
- recovery-type priors
- event freshness / age
- customer intent
- contact reachability
- communication consent
- amount opportunity
- provider-context completeness
- previous-attempt pressure

### Outputs

Each evaluation can expose:

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

`expectedRecoveryMinor` is an estimated opportunity value used to prioritize cases. It is **not** the amount recovered and is never used to close a case.

## 3. Decision logic

The decision engine only considers actions that survive deterministic policy evaluation. The current action vocabulary is:

```text
wait
send_payment_reminder
create_payment_link
request_payment_method_update
create_human_task
stop_case
```

Decisioning considers recovery potential, transaction opportunity, failure context and safety boundaries. High-value, low-confidence or otherwise uncertain cases can be routed toward human review instead of forcing automation.

Failure evidence can also influence the recommendation toward a payment-method update when that is more appropriate than a generic reminder.

## 4. Optional LLM reasoning

LLM reasoning is optional. It is configured through:

```env
AI_API_KEY=...
AI_MODEL=gpt-4o-mini
```

The LLM receives normalized case facts and the **already policy-approved action set**. It is explicitly constrained from inventing:

- arbitrary provider operations
- discounts
- payment links
- deadlines
- customer facts
- actions outside the approved set

The application validates the returned action. If the LLM is unavailable, times out, produces malformed output or proposes a disallowed action, the deterministic local path remains the safe fallback.

## 5. Why the hybrid design

A payment-recovery system needs more than a high score. It needs to explain why a case was prioritized and prevent a model from becoming an unrestricted operator.

RazCodePay therefore separates responsibilities:

| Layer | Responsibility |
|---|---|
| Local model | Predict recovery potential and risk |
| Decision engine | Select a bounded next action |
| LLM | Optional language-level reasoning/explanation |
| Policy engine | Authorize or block actions |
| Executor | Perform approved side effects |
| Razorpay | Confirm monetary outcome |

## 6. Guardrails around AI

Policy is evaluated before planning and again immediately before execution.

Relevant controls include:

- communication consent
- recovery window
- grace period
- quiet hours
- maximum attempts
- automatic-contact cap
- human-approval threshold
- allowed channels
- terminal case state

An AI recommendation therefore cannot bypass merchant controls.

## 7. How to explain it to judges

A good 20-second explanation is:

> “We use a deterministic, interpretable recovery model to estimate risk, recoverability and expected recovery value. An optional LLM can add reasoning, but it only sees actions already approved by deterministic merchant policy. The executor re-checks policy before acting, and we count recovery only after Razorpay verifies success.”

Then open **Decision Intelligence** and point to:

1. recoverability
2. risk
3. expected recovery value
4. confidence and uncertainty
5. feature-level reason signals
6. model version
7. the Policy & Controls screen
