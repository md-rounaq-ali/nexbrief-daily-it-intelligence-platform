require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const Digest = require('./models/Digest');
const { getTodayIST } = require('./utils/dateIST');
const { startDailyDigestJob } = require('./jobs/dailyDigest');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Dynamic sitemap MUST come before express.static so it isn't shadowed by static files
app.get('/sitemap.xml', async (req, res) => {
  const today = getTodayIST();
  const baseUrl = (process.env.APP_URL || 'https://nexbrief-news.onrender.com').replace(/\/$/, '');

  let archiveUrlsXml = '';
  try {
    const digests = await Digest.find({ status: 'sent' })
      .sort({ date: -1 })
      .limit(500)
      .select('date updatedAt');

    archiveUrlsXml = digests
      .map((d) => {
        const lastMod = d.date;
        return `
  <url>
    <loc>${baseUrl}/archive/${d.date}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
      })
      .join('');
  } catch (err) {
    console.warn('Sitemap archive lookup warning:', err.message);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <image:image>
      <image:loc>${baseUrl}/images/devto_cover.png</image:loc>
      <image:title>NexBrief Daily News — Daily IT &amp; Tech Intelligence Platform</image:title>
      <image:caption>Daily IT news, AI updates, software developer news, and IT Sector intelligence by Md Rounaq Ali</image:caption>
    </image:image>
  </url>
  <url>
    <loc>${baseUrl}/archive</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>${archiveUrlsXml}
</urlset>`;

  res.header('Content-Type', 'application/xml; charset=utf-8');
  res.send(xml);
});

// Serve static frontend files (ensure sw.js & manifest.json get clean no-cache/proper headers)
app.get('/sw.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.sendFile(path.join(__dirname, '../public/sw.js'));
});
app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.sendFile(path.join(__dirname, '../public/manifest.json'));
});
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/news', require('./routes/news'));
app.use('/api/newsletter', require('./routes/newsletter'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/track', require('./routes/track'));
app.use('/api/push', require('./routes/push'));

// Public SEO Digest Archive Routes (/archive and /archive/YYYY-MM-DD)
app.use('/archive', require('./routes/archive'));

// Health check endpoint (used by cron-job.org to keep app alive)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), app: 'NexBrief' });
});

// Serve frontend pages
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// Serve favicon explicitly so Google's favicon crawler gets the real image
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/images/favicon.png'));
});
app.get('/favicon.png', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/images/favicon.png'));
});
app.get('/favicon.svg', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/images/favicon.svg'));
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
