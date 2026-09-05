import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true, unique: true, index: true },
  mode: { type: String, enum: ['test', 'live'], default: 'test' },
  keyId: { type: String, required: true },
  encryptedSecret: { type: String, required: true },
  encryptedWebhookSecret: { type: String },
  status: { type: String, enum: ['connected', 'error', 'revoked'], default: 'connected' },
  connectedAt: { type: Date, default: Date.now },
  lastVerifiedAt: Date,
}, { timestamps: true, versionKey: false });

export const RazorpayConnection = mongoose.models.RazorpayConnection || mongoose.model('RazorpayConnection', schema);
