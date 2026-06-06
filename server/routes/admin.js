const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');
const User = require('../models/User');
const PendingUser = require('../models/PendingUser');
const Digest = require('../models/Digest');

// @route   GET /api/admin/stats
// @desc    Get admin dashboard stats
// @access  Admin
router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const [totalUsers, subscribedUsers, totalDigests, recentDigests] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isSubscribed: true }),
      Digest.countDocuments({ status: 'sent' }),
      Digest.find({ status: 'sent' }).sort({ date: -1 }).limit(5).select('date recipientCount sentAt'),
    ]);

    const unsubscribedUsers = totalUsers - subscribedUsers;
    const todayDate = new Date().toISOString().split('T')[0];
    const sentToday = await Digest.findOne({ date: todayDate, status: 'sent' });

    res.json({
      success: true,
      stats: {
        totalUsers,
        subscribedUsers,
        unsubscribedUsers,
        totalDigests,
        sentToday: !!sentToday,
        recentDigests,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not fetch stats.' });
  }
});

// @route   GET /api/admin/subscribers
// @desc    Get all subscribers with pagination
// @access  Admin
router.get('/subscribers', protect, adminOnly, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const filter = req.query.filter; // 'subscribed', 'unsubscribed', 'all'

    let query = {};
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
// @desc    Get all sent digests
// @access  Admin
router.get('/digests', protect, adminOnly, async (req, res) => {
  try {
    const digests = await Digest.find()
      .sort({ date: -1 })
      .limit(30)
      .select('date status recipientCount sentAt triggerSource createdAt');

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
    
    // Delete any pending registration records for this user email
    await PendingUser.deleteMany({ email: user.email });
    // Delete user
    await User.findByIdAndDelete(req.params.id);
    
    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not delete user.' });
  }
});

module.exports = router;
