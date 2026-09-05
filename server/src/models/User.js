import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['owner', 'admin', 'operator', 'viewer'], default: 'owner' },
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
  isActive: { type: Boolean, default: true },
  lastLoginAt: Date,
}, { timestamps: true, versionKey: false });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
