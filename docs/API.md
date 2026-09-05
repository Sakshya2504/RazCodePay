# API reference

Base URL: `http://127.0.0.1:3000/api`

## Dashboard

`GET /dashboard` returns the summary, visible recovery cases, and current policy.

## Cases

`GET /cases`

`GET /cases/:id`

`POST /cases/:id/evaluate`

Runs deterministic policy evaluation, the local AI scorer and optional LLM reasoning. The response includes the updated case, policy reasons, decision and dashboard summary.

`POST /cases/:id/execute`

Records one test-mode reminder attempt after a fresh policy check. It never sends a real customer message.

`POST /cases/:id/simulate-success`

Runs the same recovery transition used by the signed provider-success path, but with a synthetic `payment.captured` event. This exists only for the buildathon demo and lets judges see the final `monitoring → recovered` transition without touching real money.

`POST /cases/:id/stop`

Stops future automation.

Body:

```json
{ "reason": "merchant_demo_stop" }
```

## Demo

`POST /demo/reset`

Creates a reproducible 60-case synthetic cohort containing active, recovered and stopped examples.

## Policy and audit

`GET /policy`

`GET /audit`

## Health

`GET /health`

## Razorpay webhook

`POST /webhooks/razorpay`

Headers:

```text
X-Razorpay-Signature
x-razorpay-event-id
X-RazCodePay-Merchant-Id
```

The signature is computed over the raw request body with HMAC-SHA256. Razorpay recommends the unique event header for de-duplication. citeturn540502search2turn540502search0

The MVP listens for failure signals such as `payment.failed`, and closes matching cases on success signals such as `payment.captured` or `order.paid`. citeturn540502search1
