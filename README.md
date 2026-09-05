# RazCodePay

**Razorpay AI Buildathon — Track 03: AI Revenue Recovery**

RazCodePay is an AI-assisted revenue recovery control plane for merchants. It detects payment-related revenue at risk, uses deterministic policy to define the safe action space, lets an AI model rank those allowed actions, and records the complete recovery journey.

> **Important:** the project runs in Razorpay Test Mode for the buildathon. Synthetic demo data is never represented as real merchant revenue.

## Current stack

- **Frontend:** React.js, HTML, CSS, Vite
- **Backend:** Node.js, Express.js
- **Database:** MongoDB with Mongoose
- **AI/ML:** Python, Pandas, NumPy, Scikit-learn
- **AI reasoning:** optional LLM API with a deterministic fallback
- **Payment integration:** Razorpay Test APIs and signed webhooks
- **Version control:** Git + GitHub

## Architecture

The system follows the documented `detect → diagnose → choose → execute → verify → measure` loop.

```text
Razorpay webhook
      ↓
Signature verification
      ↓
MongoDB immutable event record
      ↓
Recovery case creation / correlation
      ↓
Deterministic policy gate
      ↓
AI recommendation (bounded to allowed actions)
      ↓
Guarded test-mode executor
      ↓
Later Razorpay success event
      ↓
Verified recovery attribution + audit trail
      ↓
React merchant console
```

See [`architecture.md`](./architecture.md) for the complete design, state machine, data model, safety rules, measurement plan, testing strategy, and buildathon demo checklist.

## Project structure

```text
RazCodePay/
├── architecture.md
├── README.md
├── ml/
│   ├── requirements.txt
│   └── risk_scorer.py
├── server/
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── config.js
│       ├── db.js
│       ├── models/
│       │   ├── AuditLog.js
│       │   ├── IncomingEvent.js
│       │   └── RecoveryCase.js
│       ├── routes/
│       │   ├── cases.js
│       │   ├── demo.js
│       │   └── webhooks.js
│       ├── services/
│       │   ├── audit.js
│       │   ├── decisionEngine.js
│       │   ├── executor.js
│       │   ├── policy.js
│       │   └── recovery.js
│       └── server.js
└── web/
    ├── index.html
    ├── package.json
    └── src/
        ├── App.jsx
        ├── main.jsx
        └── styles.css
```

## Run locally

### 1. Start MongoDB

Use a local MongoDB instance or a MongoDB Atlas development database.

### 2. Start the API

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

The API listens on `http://localhost:5000` by default.

### 3. Start the React console

```bash
cd web
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`.

### 4. Load the demo batch

Click **Seed Demo Batch** in the dashboard. This creates 60 synthetic recovery cases covering active, recovered, and stopped states.

## Razorpay webhook setup

Set these values in `server/.env`:

```env
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

Expose the local API using an HTTPS tunnel when configuring a provider webhook. The endpoint is:

```text
POST /api/webhooks/razorpay
```

The request must contain Razorpay's signature header. RazCodePay verifies the signature against the **raw request bytes before JSON parsing** and deduplicates provider retries.

## Safety boundary

The design intentionally prevents the AI from becoming a money-moving authority:

1. Razorpay remains the monetary source of truth.
2. Policy code defines the actions that are allowed.
3. The AI can only select from that allow-list.
4. The executor re-checks terminal state, consent, amount caps, and idempotency before acting.
5. Only a later verified Razorpay success can mark recovered revenue.
6. Test-mode execution records a synthetic outbound attempt instead of contacting a real customer.

## Demo metrics

The dashboard reports:

- revenue at risk;
- verified recovered revenue;
- recovery rate;
- active cases;
- risk and recoverability scores;
- case state and decision explanation;
- stopping and guardrail status.

The batch is reproducible and deliberately synthetic so every number can be explained to judges.

## Code readability standard

Code is organized by responsibility rather than by large route files. Comments explain **why** a control exists, not what a self-explanatory line does. Shared configuration is centralised, external side effects are isolated, and safety-sensitive paths fail closed.
