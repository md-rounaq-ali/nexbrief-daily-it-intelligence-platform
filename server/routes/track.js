const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Digest = require('../models/Digest');

// 1x1 transparent GIF (43 bytes)
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

/**
 * Record email open asynchronously without blocking pixel delivery
 */
const recordEmailOpen = async ({ digestId, date, userId }) => {
  try {
    let digest = null;
    if (digestId && mongoose.Types.ObjectId.isValid(digestId)) {
      digest = await Digest.findById(digestId).select('openCount openedBy');
    } else if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      digest = await Digest.findOne({ date }).select('openCount openedBy');
    }

    if (!digest) return;

    digest.openCount = (digest.openCount || 0) + 1;

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      const idx = (digest.openedBy || []).findIndex(
        (entry) => entry.userId && entry.userId.toString() === userId
      );
      if (idx >= 0) {
        digest.openedBy[idx].count = (digest.openedBy[idx].count || 1) + 1;
        digest.openedBy[idx].openedAt = new Date();
      } else {
        digest.openedBy.push({
          userId: new mongoose.Types.ObjectId(userId),
          openedAt: new Date(),
          count: 1,
        });
      }
    }

    await digest.save();
  } catch (err) {
    console.warn('Email tracking record warning:', err.message);
  }
};

// @route   GET /api/track/open
// @desc    1x1 transparent email open tracking pixel
// @access  Public (called by email clients)
router.get('/open', (req, res) => {
  const { digestId, date, userId, test } = req.query;

  // Send 1x1 GIF immediately with strict no-cache headers
  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': TRANSPARENT_GIF.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  res.status(200).end(TRANSPARENT_GIF);

  // Skip DB logging for test emails
  if (test === '1') return;

  // Persist open asynchronously
  setImmediate(() => {
    recordEmailOpen({ digestId, date, userId });
  });
});

module.exports = router;
