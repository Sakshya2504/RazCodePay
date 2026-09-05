import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    merchantId: { type: String, required: true, index: true },
    caseId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    actorType: { type: String, enum: ['system', 'merchant', 'razorpay'], required: true },
    actorId: { type: String, default: null },
    eventName: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    occurredAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);

auditLogSchema.index({ merchantId: 1, occurredAt: 1 });

auditLogSchema.pre('findOneAndUpdate', function rejectUpdates() {
  throw new Error('AuditLog entries are append-only.');
});

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
