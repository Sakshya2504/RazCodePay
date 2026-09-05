# Final Judge Demo Script

**Target:** 4:45–5:00

**Format:** approximately 20% explanation and 80% real product demonstration.

**Environment:** Razorpay Test Mode. Do not expose credentials or describe the demo as live-money recovery.

## 0:00–0:25 — Login

**Screen:** RazCodePay login page.

**Say:**

> “This is RazCodePay, an AI-assisted revenue recovery platform for Razorpay merchants. When a payment fails, the merchant needs more than an alert — they need to know what is worth recovering, what to do next, and whether the action actually recovered revenue.”

**Action:** Sign in to the merchant workspace.

## 0:25–0:45 — Merchant workspace and profile

**Screen:** Command Center.

**Say:**

> “The workspace is merchant-scoped. Authentication establishes the user and role, and the account profile provides identity, connection status, and sign-out.”

**Action:** Briefly open the profile menu only if it fits naturally. Do not spend time on account settings.

## 0:45–1:05 — Razorpay integration

**Screen:** Operations → Razorpay connection.

**Say:**

> “This workspace is connected to Razorpay Test Mode. Provider credentials stay server-side, the webhook is merchant-specific, and inbound provider events are verified before they can change recovery state.”

**Action:** Point to Connected, Test Mode, and webhook status. Never show secrets.

## 1:05–1:25 — Command Center

**Screen:** Command Center.

**Point to:**

- Revenue at risk
- Recovered revenue
- Active recovery cases
- Expected recovery opportunity
- Recovery funnel

**Say:**

> “This is the merchant command center. We do not prioritize only by transaction amount. The system estimates expected recovery opportunity so operators can focus on the failures most worth pursuing.”

## 1:25–2:05 — Recovery Case

**Screen:** Recovery Cases → failed Test Mode case → Inspect.

**Say:**

> “This case came from a verified Razorpay failure event. The case keeps the provider failure context, amount, customer context, lifecycle state, and execution history together.”

**Action:** Point to amount, failure code, state, customer context, and the execution timeline.

## 2:05–2:45 — Decision Intelligence

**Screen:** Decision Intelligence / case AI card.

**Say:**

> “The intelligence layer uses local-recovery-v2. It combines failure profile, recovery type, event freshness, customer intent, consent, reachability, amount opportunity, provider context and previous-attempt pressure.”

**Point to:** recoverability, risk, confidence, uncertainty, data quality, expected recovery opportunity, reason signals, model version.

**Continue:**

> “Expected recovery opportunity is an estimate used for prioritization. It is not recovered revenue.”

Then:

> “An optional LLM can add structured reasoning, but it only sees actions already approved by deterministic merchant policy.”

## 2:45–3:20 — Policy & Controls

**Screen:** Policy & Controls.

**Say:**

> “The safety layer is separate from the model. Merchants control the recovery window, grace period, quiet hours, maximum attempts, automatic-contact cap, human-review threshold, channels and consent behavior.”

**Point to examples:**

```text
missing consent → no customer contact
quiet hours      → wait
grace period     → wait
high value       → human review
low confidence   → human review
duplicate event  → idempotent path
invalid webhook  → reject
```

**Key line:**

> “AI recommends. Policy controls.”

## 3:20–4:10 — Execute recovery

**Screen:** Return to the selected eligible case.

**Say:**

> “Before any side effect, the executor reloads the latest case, re-checks the current merchant policy, applies an idempotent operation identity, and then performs only the approved action.”

If a Payment Link action is eligible:

> “For this case, the executor can create a Razorpay Payment Link and persist the provider reference.”

**Action:** Execute only an eligible action and show the attempt/provider reference.

### If the case says WAIT

> “This is intentional. The merchant grace window has not elapsed, so policy is preventing customer-facing action. The system is following the control rather than bypassing it.”

Do not force a blocked action for the recording.

## 4:10–4:35 — Provider-confirmed recovery

**Screen:** Razorpay Test Mode result or clearly marked demo-only success simulation, depending on the path being demonstrated.

**Say:**

> “A recommendation is not revenue. A Payment Link is not revenue. An email is not revenue. The platform credits recovery only after a verified provider-success event is correlated to the case.”

**Action:** Show the case becoming `Recovered` and the attributed recovered amount.

## 4:35–5:00 — Closing

**Screen:** Return to Command Center.

**Say:**

> “RazCodePay combines a React merchant console, Express API, MongoDB as the application system of record, Redis and BullMQ for background jobs, deterministic recovery intelligence, optional bounded LLM reasoning, merchant guardrails, signed Razorpay webhooks, idempotent execution and provider-grounded recovery attribution.”

Final line:

> “RazCodePay does not just detect failed payments. It identifies what is worth recovering, decides what to do next, acts within merchant-defined boundaries, and proves when revenue actually comes back. AI proposes, policy controls, the executor acts, and Razorpay verifies.”

## Demo discipline

- Use Razorpay Test Mode only.
- Keep one strong case on screen.
- Never expose `.env` files, API keys, JWTs, webhook secrets, SMTP passwords or LLM provider secrets.
- Never call a prediction, email, Payment Link or outbound attempt “recovered revenue.”
- Do not use demo reset/simulation in the production-oriented workflow.
- If a case is waiting, explain the guardrail instead of bypassing it.
- End on the Command Center for the final frame.