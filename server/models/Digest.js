const mongoose = require('mongoose');

const ArticleSchema = new mongoose.Schema({
  title: String,
  description: String,
  whyItMatters: { type: String, default: '' },
  isIndia: { type: Boolean, default: false },
  url: String,
  urlToImage: String,
  source: String,
  publishedAt: Date,
  category: {
    type: String,
    enum: ['IT', 'AI', 'Cybersecurity', 'Software', 'Cloud', 'Technology', 'Science', 'Education', 'Research', 'Business', 'General', 'Jobs'],
  },
});

const DigestSchema = new mongoose.Schema(
  {
    date: {
      type: String, // YYYY-MM-DD format (IST)
      required: true,
      unique: true,
    },
    itNews: [ArticleSchema],         // 50% — Jobs, AI, Cybersecurity, Software, Cloud, IT
    educationNews: [ArticleSchema],  // 30% — Education, Research, Science, B.Tech
    generalNews: [ArticleSchema],    // 20% — Business, World, Other
    sentAt: {
      type: Date,
      default: null,
    },
    recipientCount: {
      type: Number,
      default: 0,
    },
    openCount: {
      type: Number,
      default: 0,
    },
    openedBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        email: { type: String, default: '' },
        openedAt: { type: Date, default: Date.now },
        count: { type: Number, default: 1 },
      },
    ],
    pushSentCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'failed'],
      default: 'draft',
    },
    triggerSource: {
      type: String,
      enum: ['cron', 'manual', 'api'],
      default: 'cron',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Digest', DigestSchema);
