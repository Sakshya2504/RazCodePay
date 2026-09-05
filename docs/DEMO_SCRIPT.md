# Final Judge Demo Script

**Target length:** 4:45–5:00

**Recommended format:** real product demo first; use one architecture slide only if needed.

**Demo environment:** Razorpay Test Mode. Never expose credentials or claim live-money recovery.

## 0:00–0:25 — Login

Open the RazCodePay login page.

Say:

> “This is RazCodePay, an AI-assisted revenue recovery platform for Razorpay merchants. When a payment fails, the merchant needs more than an alert — they need to know what is worth recovering, what to do next, and whether the action actually recovered revenue.”

Sign in to the merchant workspace.

## 0:25–0:45 — Merchant identity

Show the authenticated command center.

Say:

> “The application is merchant-scoped. Authentication establishes the merchant identity and role, and the workspace loads the merchant’s recovery and integration context.”

Optionally open the profile menu briefly to show the signed-in merchant identity and sign-out control. Do not spend time on it.

## 0:45–1:05 — Razorpay integration

Open **Operations** and show the Razorpay connection status.

Say:

> “This workspace is connected to Razorpay Test Mode. Provider credentials are protected server-side, the webhook is merchant-specific, and inbound provider events are verified before they can affect recovery state.”

Never show the actual key ID, key secret or webhook secret.

## 1:05–1:25 — Command Center

Open **Command Center**.

Point to:
- Revenue at risk
- Recovered revenue
- Active cases
- Expected recoverable value
- Recovery funnel

Say:

> “This is the merchant command center. The important metric is not just transaction volume. We estimate expected recoverable value so operators can focus on the failures with the highest recovery opportunity.”

## 1:25–2:05 — Recovery Case

Open **Recovery Cases** and inspect the failed Test Mode case.

Say:

> “This case was created from a verified Razorpay failure event. It contains the provider failure context, transaction value, lifecycle state and execution history.”

Point to the failure code, amount, status and customer context.

Then move to the AI decision card.

## 2:05–2:45 — Decision Intelligence

Open **Decision Intelligence** or the case AI panel.

Say:

> “The intelligence layer uses the local-recovery-v2 model. It combines failure profile, recovery type, event freshness, customer intent, consent, contact reachability, amount opportunity, provider context and previous-attempt pressure.”

Point to:
- recoverability
- risk
- confidence
- uncertainty
- data quality
- expected recovery value
- reason signals
- model version

Continue:

> “Expected recovery value is an opportunity estimate for prioritization. It is not accounting revenue.”

Then:

> “An optional LLM can add structured reasoning, but it only sees actions already approved by deterministic policy.”

## 2:45–3:20 — Policy & Controls

Open **Policy & Controls**.

Say:

> “The safety layer is independent from the model. Merchants define the recovery window, grace period, quiet hours, maximum attempts, automatic-contact cap and human-review threshold.”

Point to the fail-safe examples.

Say:

> “Missing consent can block contact. Quiet hours can force a wait. High-value or uncertain cases can be routed to a human. Duplicate webhooks are handled idempotently, and invalid signatures are rejected.”

Then deliver the key line:

> “AI recommends. Policy controls.”

## 3:20–4:10 — Execute recovery

Return to the selected eligible case.

If the action is available, click **Execute recovery**.

Say:

> “The executor reloads the current case, re-checks merchant policy, applies an idempotency key, and then performs the approved recovery action.”

For Payment Link recovery:

> “For an eligible case, this can create a Razorpay Payment Link and persist the provider reference.”

Show the execution history/provider reference when available.

### If the case says WAIT

Say:

> “This is intentional. The merchant grace window has not elapsed, so policy is preventing customer-facing action. The system is following the control, not bypassing it.”

Do not force a blocked action just for the recording.

## 4:10–4:35 — Verified provider outcome

Use the available Razorpay Test Mode success path or the clearly marked demo-only success simulator when demonstrating the synthetic path.

Say:

> “The recovery is not counted just because we created a link or sent a message. A verified Razorpay success event is required.”

Point to the case moving to **Recovered** and the attributed recovered amount.

Then:

> “That closes the loop from provider failure to provider-confirmed recovery.”

## 4:35–5:00 — Close

Return to **Command Center**.

Say:

> “RazCodePay combines a React merchant console, Express API, MongoDB as the application source of truth, Redis and BullMQ for background jobs, deterministic recovery intelligence, optional bounded LLM reasoning, merchant guardrails, signed Razorpay webhooks, idempotent execution and provider-grounded recovery attribution.”

Final line:

> “RazCodePay does not just detect failed payments. It identifies what is worth recovering, decides what to do next, acts within merchant-defined boundaries, and proves when revenue actually comes back. AI proposes, policy controls, the executor acts, and Razorpay verifies.”

## Demo discipline

- Use Razorpay Test Mode only.
- Keep one strong case on screen rather than opening many cases.
- Never expose environment files, API keys, JWTs, webhook secrets or SMTP passwords.
- Never describe a recommendation, Payment Link or email as recovered revenue.
- Do not use the demo reset endpoint in production-oriented mode.
- If a case is intentionally waiting, explain the policy state.
- End on the polished Command Center for the final frame.
