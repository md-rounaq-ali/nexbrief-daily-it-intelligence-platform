const mongoose = require('mongoose');

const ArticleSchema = new mongoose.Schema({
  title: String,
  description: String,
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
      type: String, // YYYY-MM-DD format
      required: true,
      unique: true,
    },
    itNews: [ArticleSchema],         // 50% — IT, AI, Cybersecurity, Software, Cloud
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
