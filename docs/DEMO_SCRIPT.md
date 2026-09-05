# 3-minute demo script

## 0:00 — Problem

“Failed payments create revenue leakage. Merchants do not just need another dashboard — they need the next safe action, ranked by recovery potential.”

## 0:20 — Show the console

Open `http://127.0.0.1:5173`.

Point to:

- revenue at risk
- recovered revenue
- active cases
- operator time saved

Say: “Everything here is synthetic test data, but the workflow mirrors a real provider event → case → decision → execution → verified recovery loop.”

## 0:55 — Show AI

Open **AI decisions**.

Open one case.

Say: “This is not a static chatbot. The local recovery model scores risk and recoverability from payment signals. An optional LLM can explain the choice, but it only receives actions the policy has already allowed.”

## 1:35 — Show guardrails

Open **Guardrails**.

Highlight:

- consent
- quiet hours
- monetary thresholds
- attempt caps
- duplicate-event handling

Say: “AI cannot override these rules. The executor runs the same policy again immediately before contact.”

## 2:05 — Show action

For an allowed case, click **Run test-mode reminder**.

Say: “The executor records an idempotent test-mode outbound attempt. It does not claim recovery.”

## 2:25 — Show provider truth

Explain that `payment.captured` or another configured paid event is the event that closes the case. Razorpay documents payment capture and order-paid events as successful payment signals. citeturn540502search1

## 2:45 — Close

“RazCodePay is selective because it optimizes for recovered money, not automation volume. AI proposes. Policy controls. Razorpay verifies.”
