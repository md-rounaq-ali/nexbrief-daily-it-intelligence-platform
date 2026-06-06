require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const { startDailyDigestJob } = require('./jobs/dailyDigest');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/news', require('./routes/news'));
app.use('/api/newsletter', require('./routes/newsletter'));
app.use('/api/admin', require('./routes/admin'));

// Health check endpoint (used by cron-job.org to keep app alive)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), app: 'NexBrief' });
});

// Serve frontend pages (SPA-like routing for protected pages)
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 NexBrief server running on http://localhost:${PORT}`);
  console.log(`📧 Daily digest scheduled at 7:00 AM IST\n`);

  // Start cron job
  startDailyDigestJob();
});
