const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const PendingUser = require('../models/PendingUser');
const { protect } = require('../middleware/auth');
const {
  sendWelcomeEmail,
  sendRegistrationOTPEmail,
  sendOTPEmail,
} = require('../services/emailService');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ════════════════════════════════════════════════════════════════════════════
// REGISTRATION — 2-STEP WITH EMAIL VERIFICATION
// ════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// @route   POST /api/auth/initiate-register
// @desc    Step 1 — Validate details, send OTP to email
// @access  Public
// ─────────────────────────────────────────────────────────────
router.post('/initiate-register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Input validation
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Name must be at least 2 characters.' });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already registered
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'This email is already registered. Please sign in instead.',
        suggestion: 'login',
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save or update pending registration (allows resend)
    await PendingUser.findOneAndUpdate(
      { email: normalizedEmail },
      {
        name: name.trim(),
        email: normalizedEmail,
        password, // stored temporarily, bcrypt hashes on User creation
        otp,
        otpExpiry,
        createdAt: new Date(),
      },
      { upsert: true, new: true }
    );

    // Send OTP email
    await sendRegistrationOTPEmail(name.trim(), normalizedEmail, otp);

    res.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${email}. Please check your inbox.`,
    });
  } catch (error) {
    console.error('Initiate register error:', error);
    res.status(500).json({ success: false, message: 'Could not send verification code. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────
// @route   POST /api/auth/complete-register
// @desc    Step 2 — Verify OTP, create account, return JWT
// @access  Public
// ─────────────────────────────────────────────────────────────
router.post('/complete-register', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and verification code are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const pending = await PendingUser.findOne({ email: normalizedEmail });

    if (!pending) {
      return res.status(400).json({
        success: false,
        message: 'No pending registration found. Please start the registration process again.',
      });
    }

    // Check OTP expiry
    if (new Date() > new Date(pending.otpExpiry)) {
      await PendingUser.deleteOne({ email: normalizedEmail });
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please register again to get a new code.',
      });
    }

    // Verify OTP
    if (pending.otp !== otp.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect verification code. Please check your email and try again.',
      });
    }

    // Check once more if email got registered by another request meanwhile
    const alreadyRegistered = await User.findOne({ email: normalizedEmail });
    if (alreadyRegistered) {
      await PendingUser.deleteOne({ email: normalizedEmail });
      return res.status(409).json({
        success: false,
        message: 'This email was already registered. Please sign in.',
        suggestion: 'login',
      });
    }

    // ✅ Create the actual user account
    const user = await User.create({
      name: pending.name,
      email: pending.email,
      password: pending.password, // bcrypt hashing in User pre-save hook
    });

    // Remove pending record
    await PendingUser.deleteOne({ email: normalizedEmail });

    // Send welcome email (non-blocking)
    sendWelcomeEmail(user).catch(err => console.error('Welcome email error:', err.message));

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: `🎉 Welcome to NexBrief, ${user.name.split(' ')[0]}! Your email is verified and your account is ready.`,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        subscribedAt: user.subscribedAt,
      },
    });
  } catch (error) {
    console.error('Complete register error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'This email is already registered. Please sign in.', suggestion: 'login' });
    }
    res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────
// @route   POST /api/auth/resend-register-otp
// @desc    Resend OTP for pending registration
// @access  Public
// ─────────────────────────────────────────────────────────────
router.post('/resend-register-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

    const normalizedEmail = email.toLowerCase().trim();
    const pending = await PendingUser.findOne({ email: normalizedEmail });
    if (!pending) {
      return res.status(400).json({ success: false, message: 'No pending registration found. Please register again.' });
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    pending.otp = otp;
    pending.otpExpiry = otpExpiry;
    pending.createdAt = new Date();
    await pending.save();

    await sendRegistrationOTPEmail(pending.name, normalizedEmail, otp);

    res.json({ success: true, message: 'New verification code sent! Please check your inbox.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not resend code. Please try again.' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// @route   POST /api/auth/login
// @access  Public
// ─────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email. Please register first.',
        suggestion: 'register',
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password. Please try again or use "Forgot Password".',
        suggestion: 'forgot',
      });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);
    res.json({
      success: true,
      message: `Welcome back, ${user.name.split(' ')[0]}!`,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        subscribedAt: user.subscribedAt,
        lastLogin: user.lastLogin,
        digestsReceived: user.digestsReceived,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────
// @route   GET /api/auth/me
// @access  Private
// ─────────────────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        isSubscribed: user.isSubscribed,
        subscribedAt: user.subscribedAt,
        lastLogin: user.lastLogin,
        digestsReceived: user.digestsReceived,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not fetch user info.' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// FORGOT PASSWORD — 3-STEP OTP FLOW
// ════════════════════════════════════════════════════════════════════════════

// @route   POST /api/auth/forgot-password — Step 1: Send reset OTP
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email address is required.' });

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+resetOTP +resetOTPExpiry +resetOTPVerified');
    if (!user) {
      // Don't reveal whether email exists
      return res.json({ success: true, message: 'If this email is registered, you will receive a code shortly.' });
    }

    const otp = generateOTP();
    user.resetOTP = otp;
    user.resetOTPExpiry = new Date(Date.now() + 10 * 60 * 1000);
    user.resetOTPVerified = false;
    await user.save({ validateBeforeSave: false });

    await sendOTPEmail(user, otp);
    res.json({ success: true, message: `A 6-digit reset code has been sent to ${email}. It expires in 10 minutes.` });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Could not send reset code. Please try again.' });
  }
});

// @route   POST /api/auth/verify-otp — Step 2: Verify reset OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and code are required.' });

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+resetOTP +resetOTPExpiry +resetOTPVerified');
    if (!user || !user.resetOTP) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset code.' });
    }
    if (new Date() > new Date(user.resetOTPExpiry)) {
      user.resetOTP = null; user.resetOTPExpiry = null; user.resetOTPVerified = false;
      await user.save({ validateBeforeSave: false });
      return res.status(400).json({ success: false, message: 'Reset code has expired. Please request a new one.' });
    }
    if (user.resetOTP !== otp.trim()) {
      return res.status(400).json({ success: false, message: 'Incorrect code. Please check your email and try again.' });
    }

    user.resetOTPVerified = true;
    await user.save({ validateBeforeSave: false });
    res.json({ success: true, message: 'Code verified! You can now set a new password.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Verification failed. Please try again.' });
  }
});

// @route   POST /api/auth/reset-password — Step 3: Set new password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) return res.status(400).json({ success: false, message: 'Email and new password are required.' });
    if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+resetOTP +resetOTPExpiry +resetOTPVerified +password');
    if (!user || !user.resetOTPVerified) {
      return res.status(400).json({ success: false, message: 'Please verify your code before resetting your password.' });
    }
    if (!user.resetOTPExpiry || new Date() > new Date(user.resetOTPExpiry)) {
      return res.status(400).json({ success: false, message: 'Session expired. Please restart the forgot password process.' });
    }

    user.password = newPassword;
    user.resetOTP = null; user.resetOTPExpiry = null; user.resetOTPVerified = false;
    await user.save();

    res.json({ success: true, message: 'Password updated successfully! You can now sign in with your new password.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Password reset failed. Please try again.' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION
// ════════════════════════════════════════════════════════════════════════════
router.put('/unsubscribe', protect, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isSubscribed: false, unsubscribedAt: new Date() });
    res.json({ success: true, message: 'Unsubscribed from NexBrief Daily.' });
  } catch { res.status(500).json({ success: false, message: 'Could not unsubscribe.' }); }
});

router.put('/resubscribe', protect, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isSubscribed: true, unsubscribedAt: null });
    res.json({ success: true, message: 'Welcome back! You are now subscribed to NexBrief Daily.' });
  } catch { res.status(500).json({ success: false, message: 'Could not re-subscribe.' }); }
});

module.exports = router;
