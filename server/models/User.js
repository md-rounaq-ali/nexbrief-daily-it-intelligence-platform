const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Never return password in queries
    },
    isSubscribed: {
      type: Boolean,
      default: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: true, // Simple signup, no email verification needed
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    resetOTP: {
      type: String,
      default: null,
      select: false,
    },
    resetOTPExpiry: {
      type: Date,
      default: null,
      select: false,
    },
    resetOTPVerified: {
      type: Boolean,
      default: false,
      select: false,
    },
    digestsReceived: {
      type: Number,
      default: 0,
    },
    subscribedAt: {
      type: Date,
      default: Date.now,
    },
    unsubscribedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Hardcoded admin — only tabrasali7@gmail.com gets admin access
UserSchema.pre('save', function (next) {
  if (this.email === 'tabrasali7@gmail.com') {
    this.isAdmin = true;
  }
  next();
});

module.exports = mongoose.model('User', UserSchema);
