const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');
const { runDailyDigest } = require('../jobs/dailyDigest');
const { sendTestEmail } = require('../services/emailService');
const Digest = require('../models/Digest');
const { getTodayIST } = require('../utils/dateIST');

// @route   POST /api/newsletter/trigger
// @desc    Manually trigger today's digest (Admin or cron-job.org ping)
// @access  Admin OR via secret key
router.post('/trigger', async (req, res) => {
  try {
    const { secretKey } = req.body;
    const isValidSecret = secretKey && secretKey === process.env.JWT_SECRET;

    let isAdmin = false;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const jwt = require('jsonwebtoken');
      const User = require('../models/User');
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        isAdmin = user && user.isAdmin;
      } catch (e) {}
    }

    if (!isValidSecret && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    const result = await runDailyDigest('manual');

    res.json({
      success: true,
      status: result.skipped ? 'skipped' : (result.success ? 'sent' : 'failed'),
      sentTo: result.sentTo || 0,
      failed: result.failed || 0,
      pushSent: result.pushSent || 0,
      reason: result.reason || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/newsletter/test-email
// @desc    Send a test digest email to admin
// @access  Admin
router.post('/test-email', protect, adminOnly, async (req, res) => {
  try {
    const { toEmail } = req.body;
    const today = getTodayIST();

    let digest = await Digest.findOne({ date: today });
    if (!digest || !digest.itNews || digest.itNews.length === 0) {
      const { fetchAllNewsForDigest } = require('../services/newsService');
      const { itNews, educationNews, generalNews } = await fetchAllNewsForDigest();
      digest = { date: today, itNews, educationNews, generalNews };
    }

    await sendTestEmail(toEmail || req.user.email, digest);
    res.json({ success: true, message: `Test email sent to ${toEmail || req.user.email}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
