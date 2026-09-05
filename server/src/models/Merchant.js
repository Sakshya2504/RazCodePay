import mongoose from 'mongoose';

const merchantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  slug: { type: String, required: true, unique: true, index: true },
  timezone: { type: String, default: 'Asia/Kolkata' },
  currency: { type: String, default: 'INR', uppercase: true },
  plan: { type: String, enum: ['starter', 'growth', 'enterprise'], default: 'starter' },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  policy: {
    recoveryWindowHours: { type: Number, default: 168 },
    quietStartHour: { type: Number, default: 21 },
    quietEndHour: { type: Number, default: 9 },
    maxAttemptsPerCase: { type: Number, default: 2 },
    maxAutoContactMinor: { type: Number, default: 500000 },
    humanApprovalAboveMinor: { type: Number, default: 100000 },
  },
}, { timestamps: true, versionKey: false });

export const Merchant = mongoose.models.Merchant || mongoose.model('Merchant', merchantSchema);
