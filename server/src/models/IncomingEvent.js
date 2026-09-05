import mongoose from 'mongoose';

const incomingEventSchema = new mongoose.Schema(
  {
    merchantId: { type: String, required: true, index: true },
    source: { type: String, required: true, default: 'razorpay' },
    eventType: { type: String, required: true, index: true },
    providerEventId: { type: String, default: null },
    dedupeKey: { type: String, required: true },
    payloadSha256: { type: String, required: true },
    signatureVerified: { type: Boolean, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    receivedAt: { type: Date, required: true, default: Date.now },
    occurredAt: { type: Date, default: null },
    processingStatus: {
      type: String,
      enum: ['received', 'processed', 'failed'],
      default: 'received',
      index: true,
    },
    processingError: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);

incomingEventSchema.index({ merchantId: 1, dedupeKey: 1 }, { unique: true });

export const IncomingEvent = mongoose.model('IncomingEvent', incomingEventSchema);
