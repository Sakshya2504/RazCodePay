# RazCodePay — AI Revenue Recovery Platform

**Razorpay AI Buildathon · Track 03**

RazCodePay is a merchant-facing recovery platform that detects payment failures, predicts recovery potential, recommends the safest high-value intervention, executes only inside deterministic policy boundaries, and verifies recovered money from Razorpay events.

## What is production-ready in this repository

- **MongoDB is the application system of record** in `DEMO_MODE=false`.
- **Merchant authentication** with bcrypt password hashing, JWT access tokens and owner/admin/operator/viewer roles.
- **Encrypted provider credentials** using AES-256-GCM before storage in MongoDB.
- **Real Razorpay adapter** using Basic Auth for merchant API keys and real Payment Link creation.
- **Merchant-specific webhook secrets** with HMAC-SHA256 verification over the raw body.
- **Idempotent webhook ingestion** using provider event IDs or deterministic payload hashes.
- **AI/ML layer** with an interpretable local recovery model plus optional OpenAI reasoning, constrained by policy.
- **Policy enforcement twice**: once before planning and again immediately before execution.
- **Provider-grounded recovery attribution**: an AI decision or a created Payment Link never counts as recovered revenue by itself.
- **Safe demo mode** that renders without MongoDB or provider secrets and never calls live APIs.

## Architecture

```text
Razorpay
   │ signed webhook
   ▼
Webhook Gateway ───────────────► MongoDB webhook event
   │                                   │
   ▼                                   ▼
Recovery Case ◄────────────── Audit Event Store
   │
   ├── Policy pre-filter
   │
   ├── Local recovery model
   │      └── optional LLM reasoning
   │
   ├── Policy re-check
   │
   ▼
Action Executor
   │
   ├── Test-mode transport
   └── Real Razorpay Payment Link
   │
   ▼
Customer payment
   │
   ▼
Verified Razorpay success event
   │
   ▼
Recovered case + attributed amount
```

## Local demo

### Terminal 1 — MongoDB

```bash
docker compose up -d mongodb
```

MongoDB runs on `127.0.0.1:27017`.

### Terminal 2 — API

```powershell
cd server
npm install
copy .env.example .env
npm run dev
```

API: `http://127.0.0.1:3000`

Health: `http://127.0.0.1:3000/api/health`

The default `.env.example` keeps `DEMO_MODE=true`, so MongoDB is optional for the demo.

### Terminal 3 — React console

```powershell
cd web
npm install
npm run dev
```

Console: `http://127.0.0.1:5173`

## Real deployment

Set these values in `server/.env`:

```env
DEMO_MODE=false
MONGODB_URI=mongodb://127.0.0.1:27017/razcodepay
JWT_SECRET=<long-random-secret>
ENCRYPTION_KEY=<long-random-secret>
ALLOWED_ORIGIN=https://your-console.example.com
AI_API_KEY=<optional>
```

Create an account through the production console. The backend creates a merchant workspace and owner account in MongoDB.

### Connect Razorpay

The production connection endpoint is:

```text
POST /api/integrations/razorpay
```

Body:

```json
{
  "keyId": "rzp_test_...",
  "keySecret": "...",
  "webhookSecret": "...",
  "mode": "test"
}
```

RazCodePay verifies the credentials against Razorpay before confirming the connection, then stores the API secret and webhook secret encrypted in MongoDB. Razorpay's APIs use Basic Auth with the Key ID and Key Secret. citeturn365918search0

For a multi-merchant Technology Partner product, implement Razorpay OAuth rather than asking businesses to share their API secret. Razorpay documents OAuth as the partner access mechanism for this scenario. citeturn365918search2turn365918search5

### Webhook

Configure the merchant-specific endpoint:

```text
POST https://your-domain.example.com/api/webhooks/razorpay/<merchant-mongodb-id>
```

Required header:

```text
X-Razorpay-Signature: <hmac-sha256>
```

Recommended deduplication header:

```text
x-razorpay-event-id: <unique-event-id>
```

Razorpay documents HMAC-SHA256 validation over the raw webhook body and the unique event identifier for duplicate handling. citeturn365918search0

## AI system

Every case is scored on failure profile, event freshness, customer intent, contact consent, amount exposure and prior-attempt pressure. The local model outputs risk, recoverability and feature signals. The optional LLM receives only the already-approved action set.

The important boundary is:

```text
AI recommends
Policy authorizes
Executor acts
Razorpay verifies
```

See [`docs/AI.md`](./docs/AI.md).

## Real recovery action

The production executor can create a real Razorpay Payment Link for an eligible case. Razorpay documents Payment Links as URLs that can be used to collect payment and provides APIs for creating and managing them. citeturn365918search8turn365918search15

The action is idempotency-keyed and still does not mark money as recovered. A later verified success event is required.

## API surface

| Endpoint | Purpose |
|---|---|
| `POST /api/auth/register` | Create merchant workspace + owner |
| `POST /api/auth/login` | Authenticate owner/admin/operator |
| `GET /api/auth/me` | Inspect authenticated identity |
| `GET /api/dashboard` | Recovery KPIs, cases and policy |
| `GET /api/cases` | Recovery queue |
| `POST /api/cases/:id/evaluate` | Run AI + policy decision |
| `POST /api/cases/:id/execute` | Execute bounded recovery action |
| `POST /api/cases/:id/stop` | Merchant stop |
| `POST /api/cases/:id/simulate-success` | Safe demo-only recovery verification |
| `POST /api/demo/reset` | Reset synthetic cohort |
| `GET /api/audit` | Audit trail |
| `GET /api/policy` | Current guardrails |
| `GET /api/integrations/razorpay` | Razorpay connection status |
| `POST /api/integrations/razorpay` | Connect and verify Razorpay |
| `DELETE /api/integrations/razorpay` | Revoke stored connection |
| `POST /api/webhooks/razorpay/:merchantId` | Signed provider events |

## Repository structure

```text
RazCodePay/
├── architecture.md
├── docs/
│   ├── AI.md
│   ├── API.md
│   ├── DEMO_SCRIPT.md
│   └── PRODUCTION.md
├── ml/
├── server/
│   ├── src/
│   │   ├── ai/riskModel.js
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── store.js
│   │   └── server.js
│   └── test/
└── web/
    └── src/
```

## Production gap checklist

The repository is now a real-world-oriented implementation rather than a purely synthetic dashboard, but a public SaaS launch still needs managed deployment, database backups, centralized logs/metrics, secret rotation, penetration testing, a real customer-messaging provider, and Razorpay Technology Partner/OAuth approval for a multi-merchant platform. 
