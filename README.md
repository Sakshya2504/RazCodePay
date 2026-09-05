# RazCodePay — AI Revenue Recovery Platform

**Razorpay AI Buildathon · Track 03**

RazCodePay is a merchant-facing recovery platform that detects payment failures, predicts recovery potential, recommends the safest high-value intervention, executes only inside deterministic policy boundaries, and verifies recovered money from Razorpay events.

## What is production-ready in this repository

- **MongoDB is the application system of record** in `DEMO_MODE=false`.
- **Redis/BullMQ is used only for background jobs**; it is not the application database.
- **No Docker dependency** is required for local development. Run MongoDB and Redis as native Windows services.
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
   ├── Email / Payment Link
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

## Local development without Docker

Install **MongoDB Community Server** and **Redis-compatible Redis service** such as Memurai on Windows, then make sure both services are running.

### Verify MongoDB

```powershell
mongosh
```

MongoDB should be reachable at `127.0.0.1:27017`.

### Verify Redis

```powershell
redis-cli ping
```

Expected response:

```text
PONG
```

### Terminal 1 — API

```powershell
cd server
npm install
copy .env.example .env
npm run dev
```

API: `http://127.0.0.1:3000`

Health: `http://127.0.0.1:3000/api/health`

The default `.env.example` keeps `DEMO_MODE=true`, so MongoDB and Redis are optional for the demo UI.

### Terminal 2 — background worker

```powershell
cd server
npm run worker
```

The worker consumes Redis/BullMQ jobs when `DEMO_MODE=false`.

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
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=<long-random-secret>
ENCRYPTION_KEY=<long-random-secret>
ALLOWED_ORIGIN=https://your-console.example.com
AI_API_KEY=<optional>
```

Create an account through the production console. The backend creates a merchant workspace and owner account in MongoDB.

### Connect Razorpay

Use the production Razorpay connection controls in the merchant console. Razorpay OAuth is preferred for a multi-merchant Technology Partner integration; direct API-key connection remains available as a fallback.

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

The production executor can create a real Razorpay Payment Link for an eligible case and can send a real recovery email when SMTP is configured.

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
| `PUT /api/policy` | Update merchant guardrails |
| `GET /api/integrations/razorpay` | Razorpay connection status |
| `POST /api/integrations/razorpay` | Connect and verify Razorpay |
| `DELETE /api/integrations/razorpay` | Revoke stored connection |
| `GET /api/integrations/razorpay/oauth/start` | Start Razorpay OAuth |
| `GET /api/integrations/razorpay/oauth/callback` | Complete Razorpay OAuth |
| `GET /api/phase2/experiments` | List experiments and active treatment |
| `POST /api/phase2/experiments` | Create recovery experiment |
| `POST /api/phase2/experiments/:id/start` | Start an experiment |
| `POST /api/phase2/experiments/:id/stop` | Stop an experiment |
| `GET /api/phase2/experiments/metrics` | Experiment outcome metrics |
| `GET /api/phase2/cases/:caseId/communications` | Communication audit for a case |
| `GET /api/phase2/queue` | Background queue health |
| `POST /api/webhooks/razorpay/:merchantId` | Signed provider events |

## Repository structure

```text
RazCodePay/
├── architecture.md
├── docs/
│   ├── AI.md
│   ├── API.md
│   ├── DEMO_SCRIPT.md
│   ├── PHASE2.md
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
