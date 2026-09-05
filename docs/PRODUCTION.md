# Production deployment guide

## Architecture

RazCodePay uses MongoDB as its only application database. The API is Node.js + Express, the console is React + Vite, and the AI layer is an interpretable local recovery model with optional LLM reasoning.

Production components:

- MongoDB for merchants, users, provider connections, recovery cases, webhook events and audit events.
- Express API on port `3000`.
- React/Vite console on port `5173` during local development.
- Razorpay REST APIs for provider state and real Payment Links.
- Signed Razorpay webhooks for recovery verification.

## Security requirements

Set `DEMO_MODE=false`, a strong random `JWT_SECRET`, a strong random `ENCRYPTION_KEY`, and a production MongoDB URI. Never commit `.env` files or provider secrets.

Merchant Razorpay credentials are encrypted with AES-256-GCM before being stored in MongoDB. The API decrypts them only in the provider adapter when a request is made.

For a multi-merchant Razorpay Technology Partner product, use Razorpay OAuth rather than asking merchants to share API key secrets. Razorpay documents OAuth as the partner onboarding mechanism for accessing merchant resources without exposing their API secret. citeturn365918search2turn365918search5

## Real Razorpay connection

For an owner-controlled single-merchant deployment, the Settings API accepts:

```json
{
  "keyId": "rzp_test_...",
  "keySecret": "...",
  "webhookSecret": "...",
  "mode": "test"
}
```

RazCodePay verifies the credentials by calling the Razorpay API before reporting the connection as healthy. Razorpay's APIs use Basic Auth with the key ID and key secret. citeturn365918search0

## Recovery action

The safe production action implemented here is `create_payment_link`. Razorpay documents Payment Links as URLs that can be sent to customers to collect payment and provides APIs for creating and managing them. citeturn365918search8turn365918search15

The recovery executor still performs the deterministic policy check immediately before acting. A successful API call records the provider reference; it does not mark the case recovered. Only a subsequent verified Razorpay success event can do that.

## Webhook configuration

Configure a merchant-specific endpoint:

```text
POST https://<your-domain>/api/webhooks/razorpay/<merchant-mongodb-id>
```

The webhook signature is checked against the raw request body using HMAC-SHA256. Razorpay recommends using the `x-razorpay-event-id` identifier for event de-duplication. citeturn365918search0

## Go-live checklist

1. Deploy the API behind HTTPS.
2. Create MongoDB with backups and monitoring enabled.
3. Set `DEMO_MODE=false` and production secrets.
4. Register merchant accounts and assign owner/admin roles.
5. Connect Razorpay in Test Mode first.
6. Configure the merchant-specific webhook endpoint.
7. Test `payment.failed` → recovery case → Payment Link → `payment.captured`.
8. Validate duplicate and out-of-order webhook behavior.
9. Add application monitoring, alerting and secret rotation before Live Mode.
10. For a SaaS technology-partner model, complete Razorpay's partner/OAuth onboarding before storing merchant access credentials. citeturn365918search2

## Current boundary

The email reminder action is still a test-mode transport. The real provider action is Payment Link creation. A production messaging layer can be added through a dedicated email/SMS/WhatsApp adapter without changing the policy or recovery state machine.
