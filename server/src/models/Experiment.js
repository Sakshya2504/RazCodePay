import mongoose from 'mongoose';

const armSchema = new mongoose.Schema({
  name: { type: String, required: true },
  action: { type: String, required: true },
  allocation: { type: Number, min: 0, max: 1, required: true },
}, { _id: false });

const experimentSchema = new mongoose.Schema({
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  status: { type: String, enum: ['draft', 'running', 'paused', 'completed'], default: 'draft' },
  primaryMetric: { type: String, enum: ['recovery_rate', 'recovered_amount', 'time_to_recovery'], default: 'recovered_amount' },
  arms: { type: [armSchema], validate: (value) => value.length >= 2 },
  startedAt: Date,
  endedAt: Date,
}, { timestamps: true, versionKey: false });

experimentSchema.index({ merchantId: 1, status: 1 });

export const Experiment = mongoose.models.Experiment || mongoose.model('Experiment', experimentSchema);
