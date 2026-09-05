import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
  providerEventId: { type: String, index: true },
  eventType: { type: String, required: true },
  dedupeKey: { type: String, required: true, unique: true },
  payloadSha256: String,
  payload: mongoose.Schema.Types.Mixed,
  signatureVerified: { type: Boolean, default: false },
  processingStatus: { type: String, enum: ['received', 'processed', 'ignored', 'failed'], default: 'received' },
  receivedAt: { type: Date, default: Date.now },
  occurredAt: Date,
  error: String,
}, { timestamps: true, versionKey: false });

schema.index({ merchantId: 1, providerEventId: 1 }, { unique: true, sparse: true });
export const WebhookEvent = mongoose.models.WebhookEvent || mongoose.model('WebhookEvent', schema);
