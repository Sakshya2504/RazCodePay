# API reference

Base URL: `http://127.0.0.1:3000/api`

## Authentication

Production mode (`DEMO_MODE=false`) uses a Bearer access token issued by the auth endpoints.

```text
Authorization: Bearer <access-token>
```

Demo mode bypasses authentication and uses the synthetic `demo-merchant` workspace.

## Auth

`POST /auth/register`

```json
{
  "name": "Asha Sharma",
  "email": "asha@example.com",
  "password": "at-least-10-characters",
  "merchantName": "Acme SaaS"
}
```

Creates a MongoDB-backed merchant workspace and owner account.

`POST /auth/login`

Returns a one-hour access token.

`GET /auth/me`

Returns the authenticated identity and merchant claims.

## Dashboard and cases

`GET /dashboard` returns summary KPIs, visible recovery cases and the active policy.

`GET /cases`

`GET /cases/:id`

`POST /cases/:id/evaluate`

Runs policy evaluation, the local recovery model and optional LLM reasoning. The LLM only receives actions already approved by policy.

`POST /cases/:id/execute`

Re-checks policy and executes the recommended action. In demo mode a synthetic transport is recorded. In production, `create_payment_link` uses the merchant's verified Razorpay connection.

`POST /cases/:id/stop`

Stops future automation. Operator-facing mutations require an owner, admin or operator role.

`POST /cases/:id/simulate-success`

Demo-only. Injects a synthetic `payment.captured` event so judges can see a case transition to `recovered` without touching real money. This endpoint returns `403` in production mode.

## Demo

`POST /demo/reset`

Demo-only. Creates a reproducible 60-case synthetic cohort. This endpoint returns `403` in production mode so synthetic data cannot accidentally be created in a live merchant workspace.

## Razorpay integration

`GET /integrations/razorpay`

Returns merchant connection status without exposing secrets.

`POST /integrations/razorpay`

Owner/admin only. Example:

```json
{
  "keyId": "rzp_test_...",
  "keySecret": "...",
  "webhookSecret": "...",
  "mode": "test"
}
```

The backend verifies the credentials against Razorpay before storing the encrypted secrets in MongoDB.

`DELETE /integrations/razorpay`

Revokes the stored provider connection.

## Policy and audit

`GET /policy`

`GET /audit`

`GET /merchant`

## Health

`GET /health`

## Razorpay webhook

Production endpoint:

```text
POST /webhooks/razorpay/<merchant-mongodb-id>
```

Headers:

```text
X-Razorpay-Signature: <hmac-sha256-of-raw-body>
x-razorpay-event-id: <unique-provider-event-id>
```

The webhook handler verifies the signature before parsing JSON, persists the event, deduplicates repeated deliveries, updates processing status, and feeds only verified events into the recovery engine.

Razorpay documents HMAC-SHA256 validation over the raw webhook body and recommends the unique event header for duplicate-event handling. citeturn540502search2turn540502search0

The recovery engine currently uses failure signals such as `payment.failed` and success signals such as `payment.captured` or `order.paid`. citeturn540502search1
