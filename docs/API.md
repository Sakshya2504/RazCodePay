# API reference

Base URL: `http://127.0.0.1:3000/api`

## Dashboard

`GET /dashboard`

Returns:

```json
{
  "summary": {},
  "cases": [],
  "policy": {}
}
```

## Cases

`GET /cases`

`GET /cases/:id`

`POST /cases/:id/evaluate`

Runs the policy pre-filter and AI decision. The response contains the updated case, policy reasons, decision and summary.

`POST /cases/:id/execute`

Records one test-mode reminder attempt after a fresh policy check. It does not send a real message.

`POST /cases/:id/stop`

Body:

```json
{ "reason": "merchant_demo_stop" }
```

## Demo

`POST /demo/reset`

Replaces the active merchant cohort with 60 synthetic cases.

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

The signature is computed over the raw request body with HMAC-SHA256. Razorpay recommends the unique event header for de-duplication. citeturn540502search2
