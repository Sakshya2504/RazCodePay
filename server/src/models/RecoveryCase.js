import mongoose from 'mongoose';

const recoveryAttemptSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    channel: { type: String, default: null },
    status: {
      type: String,
      enum: ['planned', 'sent', 'unknown', 'failed', 'cancelled'],
      default: 'planned',
    },
    idempotencyKey: { type: String, required: true },
    scheduledFor: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    providerReference: { type: String, default: null },
    failureReason: { type: String, default: null },
  },
  { _id: false },
);

const recoveryCaseSchema = new mongoose.Schema(
  {
    merchantId: { type: String, required: true, index: true },
    caseKey: { type: String, required: true },
    type: {
      type: String,
      enum: ['failed_subscription', 'invoice_overdue', 'checkout_abandonment'],
      required: true,
    },
    state: {
      type: String,
      enum: ['detected', 'enriched', 'awaiting_window', 'planned', 'executing', 'monitoring', 'recovered', 'stopped', 'expired'],
      default: 'detected',
      index: true,
    },
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true, default: 'INR' },
    customerId: { type: String, default: null, index: true },
    providerEntityId: { type: String, default: null, index: true },
    providerEntityType: { type: String, default: null },
    providerOrderId: { type: String, default: null, index: true },
    providerSubscriptionId: { type: String, default: null, index: true },
    providerInvoiceId: { type: String, default: null, index: true },
    failureCode: { type: String, default: null },
    failureDescription: { type: String, default: null },
    riskScore: { type: Number, min: 0, max: 1, default: null },
    recoverabilityScore: { type: Number, min: 0, max: 1, default: null },
    consent: {
      email: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
    },
    attemptCount: { type: Number, default: 0, min: 0 },
    nextActionAt: { type: Date, default: null, index: true },
    recoveredAmountMinor: { type: Number, default: 0, min: 0 },
    recoveredProviderId: { type: String, default: null },
    openedAt: { type: Date, required: true, default: Date.now },
    closedAt: { type: Date, default: null },
    stopReason: { type: String, default: null },
    explanation: { type: String, default: null },
    attempts: { type: [recoveryAttemptSchema], default: [] },
  },
  // Mongoose expects versionKey to be false or the name of the version field.
  { timestamps: true, versionKey: '__v' },
);

recoveryCaseSchema.index({ merchantId: 1, caseKey: 1 }, { unique: true });
recoveryCaseSchema.index({ merchantId: 1, state: 1, nextActionAt: 1 });

export const RecoveryCase = mongoose.model('RecoveryCase', recoveryCaseSchema);
