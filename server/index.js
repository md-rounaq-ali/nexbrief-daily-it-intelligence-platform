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
// Serve favicon explicitly so Google's favicon crawler gets the real image
// (without this, the catch-all '*' route returns index.html for /favicon.ico)
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/images/favicon.png'));
});
app.get('/favicon.png', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/images/favicon.png'));
});
app.get('/favicon.svg', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/images/favicon.svg'));
});

// Dynamic sitemap with real-time current date for Google PageRank freshness signals
app.get('/sitemap.xml', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>https://nexbrief-news.onrender.com/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <image:image>
      <image:loc>https://nexbrief-news.onrender.com/images/devto_cover.png</image:loc>
      <image:title>NexBrief Daily News — Daily IT &amp; Tech Intelligence Platform</image:title>
      <image:caption>Daily IT news, AI updates, software developer news, and IT Sector intelligence by Md Rounaq Ali</image:caption>
    </image:image>
  </url>
</urlset>`;
  res.header('Content-Type', 'application/xml; charset=utf-8');
  res.send(xml);
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
