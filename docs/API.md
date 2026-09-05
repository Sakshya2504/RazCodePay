# API Reference

Base URL (local):

```text
http://127.0.0.1:3000/api
```

## Authentication

Production-oriented mode (`DEMO_MODE=false`) uses a Bearer access token:

```http
Authorization: Bearer <access-token>
```

The frontend stores the session token locally and attaches it to API requests. Merchant identity and role are enforced server-side.

Demo mode uses the synthetic `demo-merchant` workspace and does not require authentication.

## Authentication endpoints

### `POST /auth/register`

Create a merchant workspace and owner account.

```json
{
  "name": "Asha Sharma",
  "email": "asha@example.com",
  "password": "at-least-10-characters",
  "merchantName": "Acme SaaS"
}
```

### `POST /auth/login`

Authenticate an existing merchant user. Returns an access token and authenticated user context.

### `GET /auth/me`

Return the authenticated user/merchant identity and role context.

## Dashboard and recovery cases

### `GET /dashboard`

Returns merchant-scoped recovery KPIs, visible cases and current policy information.

### `GET /cases`

List merchant-scoped recovery cases.

### `GET /cases/:id`

Return one recovery case.

### `POST /cases/:id/evaluate`

Runs the policy-aware AI evaluation for a case. The response can contain recovery score, risk score, expected recovery value, confidence, uncertainty, model version, reason signals and the bounded recommendation.

### `POST /cases/:id/execute`

Re-loads the latest case, re-checks policy and attempts the recommended action when eligible. In production-oriented mode, Payment Link creation uses the verified merchant Razorpay connection.

### `POST /cases/:id/stop`

Stops future automation for a recovery case. Operator-facing mutations are role protected.

### `POST /cases/:id/simulate-success`

**Demo-only.** Injects a synthetic provider-success path to demonstrate the `recovered` state transition without moving real money. Returns `403` in production-oriented mode.

## Policy and audit

### `GET /policy`

Return the merchant's current recovery guardrails.

### `PUT /policy`

Update merchant recovery controls. Typical controls include recovery window, quiet hours, attempt limit, automatic-contact cap, human-approval threshold and communication channels.

### `GET /audit`

Return the merchant-scoped audit trail.

### `GET /merchant`

Return merchant profile/configuration data available to the authenticated user.

## Razorpay integration

### `GET /integrations/razorpay`

Return connection status without exposing provider secrets.

### `POST /integrations/razorpay`

Connect a merchant-controlled Razorpay account.

```json
{
  "keyId": "rzp_test_...",
  "keySecret": "...",
  "webhookSecret": "...",
  "mode": "test"
}
```

The backend verifies the supplied credentials before persisting the encrypted connection.

### `DELETE /integrations/razorpay`

Revoke the stored Razorpay connection.

### `GET /integrations/razorpay/oauth/start`
### `GET /integrations/razorpay/oauth/callback`

OAuth integration endpoints for a Technology Partner-style deployment.

## Webhooks

### `POST /webhooks/razorpay/:merchantId`

Merchant-specific provider webhook endpoint.

Expected headers:

```http
X-Razorpay-Signature: <hmac-sha256>
x-razorpay-event-id: <unique-provider-event-id>
```

The handler validates the signature against the raw request body, de-duplicates repeated deliveries, persists webhook processing state, and passes only verified events into the recovery workflow.

Typical event roles in the implementation:

```text
payment.failed  → recovery opportunity
payment.captured / order.paid → recovery verification
```

## Phase 2 / operations

### `GET /phase2/queue`

Return background queue health.

### `GET /phase2/experiments`
### `POST /phase2/experiments`
### `POST /phase2/experiments/:id/start`
### `POST /phase2/experiments/:id/stop`
### `GET /phase2/experiments/metrics`

Manage and inspect recovery experiments and outcome metrics.

### `GET /phase2/cases/:caseId/communications`

Return communication history for a recovery case.

## Demo endpoints

### `POST /demo/reset`

**Demo-only.** Reset/load the reproducible synthetic cohort. Blocked in production-oriented mode.

## Health

### `GET /health`

Return service/deployment mode and basic health information.

## Security invariants

The important server-side invariants are:

```text
Authentication → merchant scoping → policy → AI decision → policy re-check → side effect → provider verification
```

No frontend control is treated as an authorization boundary. Provider secrets are never returned by the integration status endpoint. Demo-only mutation endpoints are unavailable in production-oriented mode.
