# RazCodePay — AI Revenue Recovery

Razorpay AI Buildathon · Track 03

RazCodePay is an AI-assisted revenue recovery control plane. It turns failed or overdue payment signals into bounded recovery decisions, executes only policy-approved actions, and closes recovery only after a verified provider success event.

## Why this project is selectable

- **Visible AI:** every case gets risk, recoverability, signals, confidence, reason codes, and an action recommendation. An optional LLM adds reasoning on top of the local model.
- **Safe autonomy:** consent, quiet hours, monetary thresholds, attempt caps, idempotency, and terminal-state checks live outside AI.
- **Provider-grounded money:** a sent reminder never equals recovered money. Only a matching Razorpay success event closes a case.
- **Judge-friendly setup:** backend `3000`, frontend `5173`, and MongoDB/Razorpay/LLM are optional for the demo.

## Architecture

```text
Razorpay event → signature verification → normalized recovery case
                    ↓
         policy pre-filter → local AI model → optional LLM
                    ↓
             policy re-check → test-mode executor
                    ↓
            verified Razorpay success
                    ↓
                  RECOVERED
```

See [`architecture.md`](./architecture.md), [`docs/AI.md`](./docs/AI.md), and [`docs/DEMO_SCRIPT.md`](./docs/DEMO_SCRIPT.md).

## Run locally

### Backend — port 3000

```bash
cd server
npm install
copy .env.example .env
npm run dev
```

Health: `http://127.0.0.1:3000/api/health`

### Frontend — port 5173

Open a second terminal:

```bash
cd web
npm install
npm run dev
```

Console: `http://127.0.0.1:5173`

The backend uses an in-memory operational store by default, so MongoDB is not required to render or demo the product.

## Demo path

1. Open the console.
2. Use **AI decisions** to inspect ranked recovery opportunities.
3. Open **Recovery queue** and inspect a case.
4. Run the AI decision; the API applies policy, then scores the case.
5. Run **Run test-mode reminder** for a policy-approved case.
6. Run **Simulate verified Razorpay success** to demonstrate the authoritative recovery transition.
7. Open **Guardrails** to show exactly what AI cannot override.
8. Use **Reset demo cohort** to restore 60 synthetic cases.

## AI implementation

`server/src/ai/riskModel.js` contains the local recovery model. It combines failure recoverability, event freshness, customer intent, consent, amount exposure, and prior-attempt pressure into bounded risk/recoverability scores and interpretable signals.

`server/src/services/decisionEngine.js` then chooses only from the deterministic policy allow-list. When `AI_API_KEY` is present, an OpenAI-compatible LLM adds structured reasoning; invalid or unavailable LLM output falls back to the local model.

## Razorpay Test Mode

Webhook endpoint:

```text
POST /api/webhooks/razorpay
```

Headers:

```text
X-Razorpay-Signature: <hmac-sha256-of-raw-body>
x-razorpay-event-id: <unique-event-id>
```

Razorpay documents HMAC-SHA256 verification using the raw webhook body and recommends `x-razorpay-event-id` for de-duplication. citeturn540502search2turn540502search0

Payment success signals in the MVP include `payment.captured` and `order.paid`; Razorpay documents both as successful payment states/events. citeturn540502search1

## API map

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | API health |
| `GET /api/dashboard` | summary + cases + policy |
| `GET /api/cases` | recovery queue |
| `POST /api/cases/:id/evaluate` | policy + AI decision |
| `POST /api/cases/:id/execute` | test-mode reminder |
| `POST /api/cases/:id/simulate-success` | demo provider-success transition |
| `POST /api/cases/:id/stop` | merchant stop |
| `POST /api/demo/reset` | 60-case synthetic cohort |
| `GET /api/policy` | guardrails |
| `GET /api/audit` | audit trail |
| `POST /api/webhooks/razorpay` | signed provider events |

## Repository layout

```text
RazCodePay/
├─ architecture.md
├─ docs/
│  ├─ AI.md
│  ├─ API.md
│  └─ DEMO_SCRIPT.md
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

## Validation

GitHub Actions validates server tests, server syntax, and the React production build. The latest full rebuild passed those checks before the final end-to-end simulator refinement.

## Production hardening

The buildathon version intentionally does not send real customer messages. Production hardening should add authentication/RBAC, durable MongoDB collections, queue-backed workers, a real messaging provider, model monitoring, secret management, and merchant-specific configuration.
