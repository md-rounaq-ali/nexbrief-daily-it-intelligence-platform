const mongoose = require('mongoose');

/**
 * Persistent application key-value config (e.g. auto-generated VAPID keys
 * when explicit env variables are not configured on hosting).
 */
const AppConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AppConfig', AppConfigSchema);
