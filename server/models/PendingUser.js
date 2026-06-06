const mongoose = require('mongoose');

/**
 * Temporary store for pending registrations awaiting email verification.
 * Auto-deleted from DB after 15 minutes (TTL index).
 */
const PendingUserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String, // plain text — temporarily stored for 15 min max
    required: true,
  },
  otp: {
    type: String,
    required: true,
  },
  otpExpiry: {
    type: Date,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 900, // Auto-delete after 15 minutes (MongoDB TTL)
  },
});

module.exports = mongoose.model('PendingUser', PendingUserSchema);
