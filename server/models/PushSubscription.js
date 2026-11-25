const mongoose = require('mongoose');

/**
 * Browser Web Push subscription record (VAPID).
 * Supports both signed-in users and anonymous visitors.
 */
const PushSubscriptionSchema = new mongoose.Schema(
  {
    endpoint: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    userAgent: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastNotifiedAt: {
      type: Date,
      default: null,
    },
    failCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PushSubscription', PushSubscriptionSchema);
