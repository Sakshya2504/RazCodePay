import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecoveryCase', index: true },
  experimentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Experiment', default: null, index: true },
  arm: { type: String, default: 'unassigned' },
  intervention: { type: String, required: true },
  outcome: { type: String, enum: ['recovered', 'not_recovered', 'unknown'], default: 'unknown' },
  recoveredAmountMinor: { type: Number, default: 0 },
  timeToRecoveryMinutes: { type: Number, default: null },
  modelVersion: String,
  createdAt: { type: Date, default: Date.now },
}, { timestamps: false, versionKey: false });

schema.index({ merchantId: 1, createdAt: -1 });

export const RecoveryOutcome = mongoose.models.RecoveryOutcome || mongoose.model('RecoveryOutcome', schema);
