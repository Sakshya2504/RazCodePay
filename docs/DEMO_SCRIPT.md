# 3-minute judge demo

## 0:00 — Problem

“Failed payments create revenue leakage. Merchants need the next safe recovery action, not another dashboard.”

## 0:20 — Open the product

Open `http://127.0.0.1:5173`.

Point to revenue at risk, recovered revenue, active cases and expected recoverable value.

Say: “This console is connected to Razorpay Test Mode. MongoDB is the application source of truth and Redis/BullMQ handles background recovery work.”

## 0:50 — Show a real provider event

Open the **Recovery queue**.

Use a Test Mode Payment Link and trigger a failed payment. Razorpay sends `payment.failed` to the public webhook endpoint, which RazCodePay verifies before creating the recovery case.

Say: “The case is not manually invented in the dashboard. A verified provider event creates it.”

## 1:10 — Show the AI

Open **AI decisions** and inspect the new case.

Say: “The local-recovery-v2 scorer combines failure profile, event freshness, customer intent, consent, contact reachability, amount opportunity, provider context and prior-attempt pressure.”

Point out recoverability, risk, expected recovery value, confidence, uncertainty and feature signals.

Say: “The optional LLM can add language reasoning, but it cannot escape the already-approved action set.”

## 1:35 — Show the guardrails

Open **Guardrails**.

Point out the configurable recovery grace period, quiet hours, attempt cap, automatic-contact cap and human-review threshold.

Say: “Policy is independent from the model. It is checked before planning and again before the action executes.”

## 1:55 — Execute safely

Inspect a policy-eligible case with `send_payment_reminder` or `create_payment_link`.

Click **Execute recovery**.

Say: “The executor performs a provider-side action with an idempotency key. A successful action is not automatically counted as recovered revenue.”

## 2:15 — Prove the closed loop

Complete the recovery payment in Razorpay Test Mode.

Razorpay emits a success event such as `payment.captured`. RazCodePay verifies the signed event, matches it to the open recovery case, records the recovery outcome and closes the case.

## 2:40 — Provider truth

Say: “Razorpay is the monetary source of truth. Webhook signatures are validated, duplicate events are deduplicated, and only verified provider success can close the case.”

## 2:55 — Closing line

“RazCodePay is selective by design: AI recommends, deterministic policy controls, the executor acts, and Razorpay verifies.”
