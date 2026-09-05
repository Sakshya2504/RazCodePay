import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true, unique: true, index: true },
  mode: { type: String, enum: ['test', 'live'], default: 'test' },
  authType: { type: String, enum: ['api_key', 'oauth'], default: 'api_key' },
  keyId: { type: String },
  encryptedSecret: { type: String },
  encryptedAccessToken: { type: String },
  encryptedRefreshToken: { type: String },
  publicToken: { type: String },
  accountId: { type: String },
  expiresAt: Date,
  encryptedWebhookSecret: { type: String },
  status: { type: String, enum: ['connected', 'error', 'revoked'], default: 'connected' },
  connectedAt: { type: Date, default: Date.now },
  lastVerifiedAt: Date,
}, { timestamps: true, versionKey: false });

schema.index({ merchantId: 1, status: 1 });
export const RazorpayConnection = mongoose.models.RazorpayConnection || mongoose.model('RazorpayConnection', schema);
