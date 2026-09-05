import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
  caseKey: { type: String, required: true },
  type: { type: String, enum: ['failed_subscription', 'invoice_overdue', 'checkout_abandonment'], required: true },
  state: { type: String, enum: ['detected', 'enriched', 'awaiting_window', 'planned', 'executing', 'monitoring', 'recovered', 'stopped', 'expired'], default: 'detected', index: true },
  amountMinor: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'INR' },
  customer: { id: String, name: String, email: String, contact: String },
  provider: { entityId: String, entityType: String, orderId: String, subscriptionId: String, invoiceId: String, paymentLinkId: String },
  failure: { code: String, description: String },
  consent: { email: { type: Boolean, default: false }, sms: { type: Boolean, default: false }, whatsapp: { type: Boolean, default: false } },
  experiment: { id: { type: mongoose.Schema.Types.ObjectId, ref: 'Experiment', default: null }, arm: { type: String, default: null } },
  attemptCount: { type: Number, default: 0 },
  attempts: [{ action: String, channel: String, status: String, idempotencyKey: String, providerReference: String, paymentLink: String, scheduledFor: Date, sentAt: Date, error: String }],
  riskScore: Number,
  recoverabilityScore: Number,
  ai: mongoose.Schema.Types.Mixed,
  nextActionAt: Date,
  recoveredAmountMinor: { type: Number, default: 0 },
  recoveredProviderId: String,
  openedAt: { type: Date, default: Date.now },
  closedAt: Date,
  stopReason: String,
}, { timestamps: true, versionKey: false });

schema.index({ merchantId: 1, caseKey: 1 }, { unique: true });
schema.index({ merchantId: 1, state: 1, nextActionAt: 1 });
schema.index({ 'experiment.id': 1, 'experiment.arm': 1 });
export const RecoveryCase = mongoose.models.RecoveryCase || mongoose.model('RecoveryCase', schema);
