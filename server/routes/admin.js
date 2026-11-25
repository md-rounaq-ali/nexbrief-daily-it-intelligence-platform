const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');
const User = require('../models/User');
const PendingUser = require('../models/PendingUser');
const Digest = require('../models/Digest');
const PushSubscription = require('../models/PushSubscription');
const { getTodayIST } = require('../utils/dateIST');

const computeOpenStats = (digest) => {
  const sent = digest.recipientCount || 0;
  const uniqueOpens = Array.isArray(digest.openedBy) && digest.openedBy.length > 0
    ? digest.openedBy.length
    : Math.min(sent, digest.openCount || 0);
  const openRate = sent > 0 ? Math.min(100, Math.round((uniqueOpens / sent) * 100)) : 0;
  return {
    uniqueOpens,
    totalOpens: digest.openCount || 0,
    openRate,
  };
};

// @route   GET /api/admin/stats
// @desc    Get admin dashboard stats including open rates & push subscribers
// @access  Admin
router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const todayDate = getTodayIST();
    const [totalUsers, subscribedUsers, totalDigests, sentDigestsForRate, recentDigestsRaw, sentToday, pushSubscribers] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isSubscribed: true }),
      Digest.countDocuments({ status: 'sent' }),
      Digest.find({ status: 'sent', recipientCount: { $gt: 0 } })
        .sort({ date: -1 })
        .limit(30)
        .select('recipientCount openCount openedBy'),
      Digest.find({ status: 'sent' })
        .sort({ date: -1 })
        .limit(7)
        .select('date recipientCount sentAt triggerSource openCount openedBy pushSentCount'),
      Digest.findOne({ date: todayDate, status: 'sent' }),
      PushSubscription.countDocuments({ isActive: true }),
    ]);

    const unsubscribedUsers = totalUsers - subscribedUsers;

    // Average open rate across recent tracked digests (where opens exist or recipientCount > 0)
    let trackedCount = 0;
    let openRateSum = 0;
    let totalOpens = 0;
    for (const d of sentDigestsForRate) {
      const { uniqueOpens, totalOpens: tOpens, openRate } = computeOpenStats(d);
      totalOpens += tOpens;
      if (d.recipientCount > 0 && (d.openCount > 0 || (d.openedBy && d.openedBy.length > 0))) {
        openRateSum += openRate;
        trackedCount++;
      }
      // Avoid unused warning
      void uniqueOpens;
    }
    const avgOpenRate = trackedCount > 0 ? Math.round(openRateSum / trackedCount) : null;

    const recentDigests = recentDigestsRaw.map((d) => {
      const { uniqueOpens, totalOpens: tOpens, openRate } = computeOpenStats(d);
      return {
        date: d.date,
        recipientCount: d.recipientCount,
        sentAt: d.sentAt,
        triggerSource: d.triggerSource,
        uniqueOpens,
        totalOpens: tOpens,
        openRate,
        pushSentCount: d.pushSentCount || 0,
      };
    });

    res.json({
      success: true,
      stats: {
        totalUsers,
        subscribedUsers,
        unsubscribedUsers,
        totalDigests,
        sentToday: !!sentToday,
        avgOpenRate,
        totalOpens,
        pushSubscribers,
        recentDigests,
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, message: 'Could not fetch stats.' });
  }
});

// @route   GET /api/admin/subscribers
// @desc    Get all subscribers with pagination
// @access  Admin
router.get('/subscribers', protect, adminOnly, async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    const filter = req.query.filter; // 'subscribed', 'unsubscribed', 'all'

    const query = {};
    if (filter === 'subscribed') query.isSubscribed = true;
    if (filter === 'unsubscribed') query.isSubscribed = false;

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ isAdmin: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('name email isSubscribed isAdmin digestsReceived subscribedAt lastLogin createdAt'),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not fetch subscribers.' });
  }
});

// @route   GET /api/admin/digests
// @desc    Get all sent digests with open metrics
// @access  Admin
router.get('/digests', protect, adminOnly, async (req, res) => {
  try {
    const rawDigests = await Digest.find()
      .sort({ date: -1 })
      .limit(30)
      .select('date status recipientCount sentAt triggerSource openCount openedBy pushSentCount createdAt');

    const digests = rawDigests.map((d) => {
      const { uniqueOpens, totalOpens, openRate } = computeOpenStats(d);
      return {
        _id: d._id,
        date: d.date,
        status: d.status,
        recipientCount: d.recipientCount || 0,
        sentAt: d.sentAt,
        triggerSource: d.triggerSource,
        uniqueOpens,
        totalOpens,
        openRate,
        pushSentCount: d.pushSentCount || 0,
        createdAt: d.createdAt,
      };
    });

    res.json({ success: true, digests });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not fetch digests.' });
  }
});

// @route   PUT /api/admin/users/:id/toggle-admin
// @desc    Toggle admin status for a user
// @access  Admin
router.put('/users/:id/toggle-admin', protect, adminOnly, async (req, res) => {
  try {
    if (req.user.email !== 'tabrasali7@gmail.com') {
      return res.status(403).json({ success: false, message: 'Only the main administrator can modify admin privileges.' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user.email === 'tabrasali7@gmail.com') {
      return res.status(400).json({ success: false, message: 'Cannot modify the main administrator status.' });
    }
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot modify your own admin status.' });
    }
    user.isAdmin = !user.isAdmin;
    await user.save({ validateBeforeSave: false });
    res.json({ success: true, message: `User ${user.isAdmin ? 'promoted to' : 'removed from'} admin.`, isAdmin: user.isAdmin });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not update user.' });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete a user account
// @access  Admin
router.delete('/users/:id', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user.email === 'tabrasali7@gmail.com') {
      return res.status(400).json({ success: false, message: 'Cannot delete the main administrator.' });
    }
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account.' });
    }

    await PendingUser.deleteMany({ email: user.email });
    await User.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not delete user.' });
  }
});

module.exports = router;
