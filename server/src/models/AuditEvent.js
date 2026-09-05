import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', index: true },
  actorType: { type: String, enum: ['system', 'user', 'razorpay'], default: 'system' },
  actorId: String,
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecoveryCase', index: true },
  eventName: { type: String, required: true },
  details: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false, collection: 'audit_events' });

schema.index({ merchantId: 1, createdAt: -1 });
export const AuditEvent = mongoose.models.AuditEvent || mongoose.model('AuditEvent', schema);
