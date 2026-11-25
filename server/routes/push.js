const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const PushSubscription = require('../models/PushSubscription');
const { getVapidKeys, sendPushToAllSubscribers } = require('../services/pushService');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');

// @route   GET /api/push/vapid-public-key
// @desc    Get VAPID public key for browser PushManager.subscribe()
// @access  Public
router.get('/vapid-public-key', async (req, res) => {
  try {
    const keys = await getVapidKeys();
    res.json({ success: true, publicKey: keys.publicKey });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not retrieve push key.' });
  }
});

// @route   POST /api/push/subscribe
// @desc    Save browser Web Push subscription (works for guests & logged-in users)
// @access  Public (optional JWT)
router.post('/subscribe', async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ success: false, message: 'Valid push subscription payload is required.' });
    }

    // Associate userId if Bearer token is sent
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
        if (decoded?.id) userId = decoded.id;
      } catch {}
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
        ...(userId ? { userId } : {}),
        userAgent: (req.headers['user-agent'] || '').slice(0, 220),
        isActive: true,
        failCount: 0,
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: '7:00 AM IST push notifications enabled!',
    });
  } catch (error) {
    console.error('Push subscribe error:', error);
    res.status(500).json({ success: false, message: 'Could not save push subscription.' });
  }
});

// @route   POST /api/push/unsubscribe
// @desc    Remove a push subscription endpoint
// @access  Public
router.post('/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ success: false, message: 'Endpoint is required.' });
    }
    await PushSubscription.deleteOne({ endpoint });
    res.json({ success: true, message: 'Push notifications disabled.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not remove push subscription.' });
  }
});

// @route   GET /api/push/status
// @desc    Get active push subscriber count
// @access  Admin
router.get('/status', protect, adminOnly, async (req, res) => {
  try {
    const activeSubscriptions = await PushSubscription.countDocuments({ isActive: true });
    res.json({ success: true, activeSubscriptions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not load push status.' });
  }
});

// @route   POST /api/push/test
// @desc    Send a test push notification to all subscribed browsers
// @access  Admin
router.post('/test', protect, adminOnly, async (req, res) => {
  try {
    const report = await sendPushToAllSubscribers({
      title: '☀️ NexBrief Test Alert!',
      body: 'Browser push notifications are live — you will be alerted at 7:00 AM IST daily.',
      url: '/dashboard',
      tag: 'nexbrief-test',
    });
    res.json({
      success: true,
      message: `Push sent to ${report.sent} active browser(s).`,
      report,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
