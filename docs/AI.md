# AI implementation

## Decision pipeline

RazCodePay has two intelligence sources and one authority layer.

```text
case facts
   │
   ├── local-recovery-v1
   │      ├── risk score
   │      ├── recoverability score
   │      └── top signals
   │
   ├── optional OpenAI LLM
   │      └── structured action + explanation
   │
   └── deterministic policy
          └── final allowed action
```

## Local model

`server/src/ai/riskModel.js` is an interpretable feature-weighted model. It is intentionally small enough to inspect during a hackathon review.

Inputs include failure profile, amount exposure, event freshness, customer intent, consent, and prior attempts.

The output is bounded to `[0,1]` and contains model version + feature signals for the UI.

## LLM mode

Set:

```env
AI_API_KEY=...
AI_MODEL=gpt-4o-mini
```

The model receives only normalized case facts and the already-approved action set. The prompt explicitly forbids inventing provider operations, payment instructions or discounts.

The result is accepted only when the action is a member of the allowed action list. Invalid output or API failure falls back to the local model.

## Why this is safer

The LLM is an analyst, not a wallet controller. The policy engine still decides whether an action can happen, and the executor re-checks policy just before the side effect.

## What to show judges

Open **AI decisions** and inspect a case. Point out the model version, recovery score, confidence, signals, action recommendation, and guardrail boundaries. Then open **Guardrails** and show that high-value or consent-blocked actions are removed independently of AI reasoning.
