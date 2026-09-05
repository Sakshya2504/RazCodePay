# API Reference

**Razorpay AI Buildathon · Track 03**

Local base URL:

```text
http://127.0.0.1:3000/api
```

## 1. Authentication

Production-oriented mode (`DEMO_MODE=false`) uses a Bearer access token:

```http
Authorization: Bearer <access-token>
```

Authentication establishes the merchant and user role. Database access and mutations are merchant-scoped on the server.

Demo mode uses the synthetic `demo-merchant` workspace and does not require authentication.

## 2. Authentication endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/register` | Create merchant workspace and owner account |
| POST | `/auth/login` | Authenticate user and return access context |
| GET | `/auth/me` | Return authenticated identity and role |

Example registration body:

```json
{
  "name": "Asha Sharma",
  "email": "asha@example.com",
  "password": "at-least-10-characters",
  "merchantName": "Acme SaaS"
}
```

## 3. Dashboard and recovery cases

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/dashboard` | Merchant KPIs, visible cases and active policy |
| GET | `/cases` | Merchant-scoped recovery queue |
| GET | `/cases/:id` | Recovery case detail |
| POST | `/cases/:id/evaluate` | Run policy-aware AI evaluation |
| POST | `/cases/:id/execute` | Execute an eligible bounded recovery action |
| POST | `/cases/:id/stop` | Stop future automation for a case |

`POST /cases/:id/evaluate` can return:

```text
riskScore
recoverabilityScore
expectedRecoveryMinor
confidence
uncertainty
dataQuality
modelVersion
reason signals
recommendedAction
```

## 4. Policy and audit

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/policy` | Read merchant recovery controls |
| PUT | `/policy` | Update merchant recovery controls |
| GET | `/audit` | Read merchant-scoped audit events |
| GET | `/merchant` | Read merchant profile/configuration |

Policy controls include recovery timing, quiet hours, attempt limits, automatic-contact caps, human-review thresholds, channels and consent-sensitive behavior.

## 5. Razorpay integration

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/integrations/razorpay` | Return connection status without secrets |
| POST | `/integrations/razorpay` | Connect and verify merchant Razorpay credentials |
| DELETE | `/integrations/razorpay` | Revoke stored Razorpay connection |
| GET | `/integrations/razorpay/oauth/start` | Start future OAuth/partner flow |
| GET | `/integrations/razorpay/oauth/callback` | OAuth callback |

Example connection payload shape:

```json
{
  "keyId": "rzp_test_...",
  "keySecret": "...",
  "webhookSecret": "...",
  "mode": "test"
}
```

The backend verifies the connection and encrypts provider secrets before persistence. Status responses do not return secret material.

## 6. Razorpay webhooks

### `POST /webhooks/razorpay/:merchantId`

The endpoint is merchant-specific.

Expected headers include:

```http
X-Razorpay-Signature: <hmac-sha256>
x-razorpay-event-id: <provider-event-id>
```

Processing order:

```text
raw request body
      ↓
signature verification
      ↓
deduplication
      ↓
persist webhook event
      ↓
correlate/create recovery case
      ↓
schedule recovery work
```

Typical event roles:

```text
payment.failed / relevant failure event → recovery opportunity
payment.captured / order.paid / other success event → recovery verification
```

Only verified provider events can change provider-grounded recovery state.

## 7. Operations and experiments

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/phase2/queue` | Queue health |
| GET | `/phase2/experiments` | List experiments |
| POST | `/phase2/experiments` | Create experiment |
| POST | `/phase2/experiments/:id/start` | Start experiment |
| POST | `/phase2/experiments/:id/stop` | Stop experiment |
| GET | `/phase2/experiments/metrics` | Outcome metrics |
| GET | `/phase2/cases/:caseId/communications` | Communication history |

Experiments are persisted in MongoDB and assignments are deterministic by case identity.

## 8. Demo-only endpoints

These endpoints exist only to make the safe buildathon demo reproducible:

| Method | Endpoint | Boundary |
|---|---|---|
| POST | `/demo/reset` | Synthetic cohort reset; blocked outside demo mode |
| POST | `/cases/:id/simulate-success` | Synthetic recovery-success transition; blocked outside demo mode |

No real money is moved by the demo simulator.

## 9. Health

### `GET /health`

Returns basic service health and deployment-mode information.

## 10. Security and consistency invariants

The intended server-side flow is:

```text
authenticate
   ↓
merchant scope
   ↓
policy pre-filter
   ↓
AI / decisioning
   ↓
execution-time policy re-check
   ↓
idempotent side effect
   ↓
verified provider outcome
```

Important guarantees:

- frontend controls are not authorization boundaries
- invalid webhook signatures are rejected
- repeated provider events are deduplicated
- terminal/stopped cases are not blindly executed again
- provider credentials are not returned by status APIs
- a prediction or Payment Link creation is not counted as recovered revenue
- demo-only mutation endpoints are unavailable in production-oriented mode