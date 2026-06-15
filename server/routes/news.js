const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Digest = require('../models/Digest');
const { fetchAllNewsForDigest } = require('../services/newsService');

// @route   GET /api/news/today
// @desc    Get today's digest (50% IT + 30% Education + 20% General)
// @access  Private
router.get('/today', protect, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Check if we have today's digest cached
    let digest = await Digest.findOne({ date: today });
    if (digest && (digest.itNews.length > 0 || digest.educationNews?.length > 0 || digest.generalNews.length > 0)) {
      return res.json({ success: true, source: 'cache', digest });
    }

    // Fetch fresh news (with built-in dedup against last 3 digests)
    const { itNews, educationNews, generalNews } = await fetchAllNewsForDigest();

    if (!digest) {
      digest = new Digest({ date: today, itNews, educationNews, generalNews });
    } else {
      digest.itNews = itNews;
      digest.educationNews = educationNews;
      digest.generalNews = generalNews;
    }
    await digest.save();

    res.json({ success: true, source: 'fresh', digest });
  } catch (error) {
    console.error('News fetch error:', error);
    res.status(500).json({ success: false, message: 'Could not fetch today\'s news. Please try again.' });
  }
});

// @route   GET /api/news/history
// @desc    Get last 7 sent digests
// @access  Private
router.get('/history', protect, async (req, res) => {
  try {
    const digests = await Digest.find({ status: 'sent' })
      .sort({ date: -1 })
      .limit(7)
      .select('date itNews educationNews generalNews sentAt recipientCount');
    res.json({ success: true, digests });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not fetch digest history.' });
  }
});

// @route   GET /api/news/digest/:date
// @desc    Get a specific day's digest
// @access  Private
router.get('/digest/:date', protect, async (req, res) => {
  try {
    const digest = await Digest.findOne({ date: req.params.date });
    if (!digest) {
      return res.status(404).json({ success: false, message: 'Digest not found for that date.' });
    }
    res.json({ success: true, digest });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not fetch digest.' });
  }
});

module.exports = router;
