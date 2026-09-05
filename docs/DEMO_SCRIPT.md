# 3-minute judge demo

## 0:00 — Problem

“Failed payments create revenue leakage. Merchants need the next safe recovery action, not another dashboard.”

## 0:20 — Open the product

Open `http://127.0.0.1:5173`.

Point to the four headline metrics: revenue at risk, recovered revenue, active cases and operator time saved.

Say: “This is synthetic Test Mode data. The product mirrors the real event-to-recovery workflow without touching customer money.”

## 0:55 — Show the AI

Open **AI decisions** and inspect a case.

Say: “RazCodePay has an actual recovery scoring layer. It evaluates failure profile, freshness, customer intent, consent, amount exposure and prior attempts. The result is a recoverability score, risk score, signals, confidence and a ranked action.”

Then say: “An optional LLM can add natural-language reasoning, but it is only allowed to choose from the actions policy has already approved.”

## 1:30 — Show the guardrails

Open **Guardrails**.

Point out consent, quiet hours, attempt caps, automatic-contact limits and the human-review threshold.

Say: “The model does not own these controls. The executor checks policy again at the moment of action.”

## 1:55 — Execute safely

Inspect a case where the recommendation is `send_payment_reminder`.

Click **Run test-mode reminder**.

Say: “This records an idempotent test-mode outbound attempt. It deliberately does not claim that money was recovered.”

## 2:15 — Prove the closed loop

Click **Simulate verified Razorpay success**.

Say: “The simulator feeds the same recovery service with a synthetic `payment.captured` event. The case now moves to `recovered` and the recovered amount is updated.”

For the real integration, explain that the same recovery service consumes a signed Razorpay webhook.

## 2:40 — Provider truth

Say: “Razorpay is the monetary source of truth. The webhook signature is validated against the raw request body, duplicate events are deduplicated, and provider success closes the case.” Razorpay documents HMAC-SHA256 webhook validation and the `x-razorpay-event-id` identifier for deduplication. citeturn540502search2turn540502search0

## 2:55 — Closing line

“RazCodePay is selective by design: AI proposes, deterministic policy controls, the executor acts, and Razorpay verifies.”
