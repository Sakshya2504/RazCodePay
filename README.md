# RazCodePay — AI Revenue Recovery

Razorpay AI Buildathon · Track 03

RazCodePay is an AI-assisted revenue recovery control plane. It turns failed or overdue payment signals into bounded recovery decisions, executes only policy-approved actions, and closes recovery only after a verified provider success event.

## What makes the project selectable

**AI is visible, not decorative.** Every case has an interpretable recovery score, ranked signals, a confidence value, recommended action, and reason codes. When `AI_API_KEY` is present, an LLM adds a second reasoning layer. The LLM can only choose from the deterministic policy allow-list.

**The demo is hard to break.** The backend runs on port `3000` without requiring MongoDB, Razorpay credentials, or an LLM key. The frontend runs on `5173`. This means a judge can clone, install, and open the dashboard immediately.

**Automation has brakes.** Consent, quiet hours, attempt caps, monetary thresholds, terminal-state checks, webhook signature verification, and idempotency are all handled outside the AI layer.

**The money metric is provider-grounded.** The UI never claims a message caused recovery. A case is marked recovered only when a matching Razorpay success event is processed.

## Architecture

```text
Razorpay Webhook
      │ signed + verified
      ▼
Event Normalizer ────────► Immutable event/audit trail
      │
      ▼
Recovery Case
      │
      ├── deterministic policy pre-filter
      │
      ├── local AI recovery model
      │       └── optional LLM reasoning
      │
      └── deterministic policy re-check
              │
              ▼
       Test-mode executor
              │
              ▼
     customer/provider signal
              │
              ▼
      verified Razorpay success
              │
              ▼
         Case = recovered
```

## Local run

### 1. Backend

```bash
cd server
npm install
copy .env.example .env
npm run dev
```

Backend: `http://127.0.0.1:3000`

Health check: `http://127.0.0.1:3000/api/health`

### 2. Frontend

Open a second terminal:

```bash
cd web
npm install
npm run dev
```

Frontend: `http://127.0.0.1:5173`

The Vite server is explicitly configured for `5173`; the API defaults to `3000`.

## Demo flow

1. Open the dashboard.
2. Open **AI decisions** to see the ranked recovery opportunities and model logic.
3. Open **Recovery queue** and inspect a case.
4. Click **Inspect**. The API runs the AI decision and policy evaluation.
5. For an allowed case, run **Run test-mode reminder**. The event is recorded with an idempotency key.
6. Send a verified Razorpay `payment.captured` or `order.paid` webhook to demonstrate the final recovery transition.
7. Open **Guardrails** to show the hard business boundaries.
8. Click **Reset demo cohort** to restore a fresh 60-case cohort.

## Optional AI upgrade

Set `AI_API_KEY` in `server/.env`. RazCodePay will use the local model to establish the numeric baseline and the configured LLM to add bounded reasoning. If the LLM is unavailable, the local model continues working without changing the safety policy.

## Optional MongoDB

Set `MONGODB_URI` to enable MongoDB connectivity for future persistence work. The current demo intentionally keeps the operational path independent from MongoDB so setup failures cannot make the dashboard blank.

## Razorpay Test Mode

The webhook endpoint is:

```text
POST /api/webhooks/razorpay
```

Required header for a signed event:

```text
X-Razorpay-Signature: <hmac-sha256-of-raw-body>
```

Optional event de-duplication header:

```text
x-razorpay-event-id: <unique-event-id>
```

Razorpay documents HMAC-SHA256 validation over the **raw webhook request body** and recommends de-duplicating using `x-razorpay-event-id`. The implementation follows that pattern. citeturn540502search2turn540502search0

Useful Track 03 events include `payment.failed` and `payment.captured`; Razorpay also documents `order.paid` as the paid-order event. citeturn540502search1

## API map

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | API health and operating mode |
| `GET /api/dashboard` | Summary, cases, and current policy |
| `GET /api/cases` | Recovery queue |
| `GET /api/cases/:id` | One case |
| `POST /api/cases/:id/evaluate` | Run policy + AI decision |
| `POST /api/cases/:id/execute` | Record a test-mode outbound attempt |
| `POST /api/cases/:id/stop` | Merchant stop |
| `POST /api/demo/reset` | Create 60 synthetic cases |
| `GET /api/policy` | Current guardrails |
| `GET /api/audit` | Recent audit entries |
| `POST /api/webhooks/razorpay` | Signed provider events |

## Repository layout

```text
RazCodePay/
├─ architecture.md
├─ docs/
│  ├─ AI.md
│  ├─ API.md
│  └─ DEMO_SCRIPT.md
├─ ml/
├─ server/
│  ├─ src/
│  │  ├─ ai/riskModel.js
│  │  ├─ routes/api.js
│  │  ├─ services/
│  │  │  ├─ audit.js
│  │  │  ├─ decisionEngine.js
│  │  │  ├─ executor.js
│  │  │  ├─ policy.js
│  │  │  └─ recovery.js
│  │  ├─ store.js
│  │  └─ server.js
│  └─ test/
└─ web/
   ├─ src/App.jsx
   ├─ src/main.jsx
   ├─ src/styles.css
   └─ vite.config.js
```

## Validation checklist

- Backend defaults to `3000`.
- Frontend defaults to `5173`.
- Frontend never requires MongoDB merely to render.
- AI recommendations are allow-list constrained.
- Execution re-checks policy at action time.
- Provider success is the only recovery confirmation path.
- Webhook signatures use raw request bytes.
- Duplicate provider events are idempotent.
- Tests cover policy boundaries and AI bounds.

## Scope note

This repository is a buildathon-grade reference implementation. The test-mode executor records a synthetic outbound action instead of sending real customer communications. Production deployment still needs authentication/RBAC, durable persistence, secret management, observability, and a real messaging provider adapter.
