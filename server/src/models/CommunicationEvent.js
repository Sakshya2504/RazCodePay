import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecoveryCase', required: true, index: true },
  channel: { type: String, enum: ['email', 'sms', 'whatsapp'], required: true },
  provider: { type: String, default: 'smtp' },
  status: { type: String, enum: ['queued', 'sent', 'delivered', 'failed', 'suppressed'], default: 'queued' },
  recipientHash: String,
  providerReference: String,
  template: String,
  error: String,
  occurredAt: { type: Date, default: Date.now },
}, { timestamps: true, versionKey: false });

schema.index({ merchantId: 1, caseId: 1, occurredAt: -1 });

export const CommunicationEvent = mongoose.models.CommunicationEvent || mongoose.model('CommunicationEvent', schema);
