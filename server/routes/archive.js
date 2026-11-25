const express = require('express');
const router = express.Router();
const Digest = require('../models/Digest');
const { buildSmartFallbackInsight, cleanNewsText } = require('../services/aiService');

const BASE_SITE_URL = (process.env.APP_URL || 'https://nexbrief-news.onrender.com').replace(/\/$/, '');

const escapeHtml = (str = '') =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const safeHttpUrl = (url) => {
  if (!url || typeof url !== 'string') return '#';
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : '#';
};

const formatDisplayDate = (dateStr) => {
  try {
    return new Date(`${dateStr}T00:00:00+05:30`).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return dateStr;
  }
};

const CATEGORY_COLORS = {
  Jobs: '#059669',
  AI: '#6366f1',
  Cybersecurity: '#ef4444',
  Software: '#10b981',
  Cloud: '#3b82f6',
  IT: '#8b5cf6',
  Technology: '#3b82f6',
  Education: '#f59e0b',
  Research: '#06b6d4',
  Science: '#ec4899',
  Business: '#64748b',
  General: '#64748b',
};

const renderSharedLayout = ({ title, description, canonicalPath, jsonLdScripts = '', bodyHtml }) => {
  const canonicalUrl = `${BASE_SITE_URL}${canonicalPath}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
  <meta name="author" content="Md Rounaq Ali" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#6366f1" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:image" content="${BASE_SITE_URL}/images/devto_cover.png" />
  <meta property="og:site_name" content="NexBrief Daily News" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${BASE_SITE_URL}/images/devto_cover.png" />
  ${jsonLdScripts}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <link rel="icon" type="image/png" href="/images/favicon.png" />
  <link rel="icon" type="image/svg+xml" href="/images/favicon.svg" />
  <link rel="apple-touch-icon" href="/images/apple-touch-icon.png" />
  <link rel="stylesheet" href="/css/style.css" />
</head>
<body>
  <nav class="navbar scrolled" id="navbar">
    <div class="nav-container">
      <a href="/" class="nav-logo" style="display:flex;align-items:center;gap:10px;">
        <img src="/images/logo.svg" alt="NexBrief Logo" style="height:32px;width:32px;border-radius:6px;object-fit:cover;" />
        <span><span class="logo-nex">Nex</span>Brief</span>
      </a>
      <ul class="nav-links">
        <li><a href="/">Home</a></li>
        <li><a href="/archive" style="color:var(--color-primary-light);font-weight:700;">Digest Archive</a></li>
        <li><a href="/#search-section">Search News</a></li>
        <li><a href="/#topics">Daily Topics</a></li>
        <li><a href="/#about">About Creator</a></li>
      </ul>
      <div class="nav-actions">
        <button type="button" class="btn btn-ghost btn-sm push-optin-btn" id="archive-push-btn" title="Get 7 AM IST browser alerts">🔔 7 AM Alerts</button>
        <a href="/?auth=register" class="btn btn-primary btn-sm">Subscribe Free</a>
      </div>
    </div>
  </nav>

  <main class="archive-main">
    <div class="container">
      ${bodyHtml}
    </div>
  </main>

  <footer class="footer">
    <div class="container">
      <div class="footer-top">
        <div class="footer-brand">
          <div class="footer-logo" style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <img src="/images/logo.svg" alt="NexBrief Logo" style="height:28px;width:28px;border-radius:5px;object-fit:cover;" />
            <span><span class="logo-nex">Nex</span>Brief</span>
          </div>
          <p>50% IT · 30% Education · 20% World. Daily at 7 AM IST. Built for B.Tech students &amp; IT professionals.</p>
        </div>
        <div class="footer-links">
          <a href="/">Home</a>
          <a href="/archive">Public Archive</a>
          <a href="/#topics">Daily News Topics</a>
          <a href="/#about">About Md Rounaq Ali</a>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© ${new Date().getFullYear()} NexBrief. All rights reserved. Developed by <a href="https://md-rounaq-ali.netlify.app/" target="_blank" rel="noopener noreferrer" style="color:#818cf8;text-decoration:underline;font-weight:500;">Md Rounaq Ali</a> for India's engineers.</p>
        <p class="footer-google-search">
          Search Creator on Google: <a href="https://www.google.com/search?q=md+rounaq+ali" target="_blank" rel="noopener noreferrer" class="footer-search-pill">md rounaq ali ↗</a>
        </p>
      </div>
    </div>
  </footer>

  <div class="toast" id="toast" role="alert" aria-live="polite"></div>
  <script src="/js/pwa.js"></script>
  <script>
    // Handle Copy Link buttons on archive cards
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('.copy-share-btn');
      if (!btn) return;
      const url = btn.dataset.url;
      if (!url) return;
      try {
        await navigator.clipboard.writeText(url);
        const toast = document.getElementById('toast');
        if (toast) {
          toast.textContent = '🔗 Article link copied to clipboard!';
          toast.className = 'toast success show';
          setTimeout(() => toast.classList.remove('show'), 2500);
        }
      } catch {}
    });
  </script>
</body>
</html>`;
};

const renderArchiveArticleCard = (art) => {
  const cat = art.category || 'IT';
  const color = CATEGORY_COLORS[cat] || '#6366f1';
  const url = safeHttpUrl(art.url);
  const title = cleanNewsText(art.title || 'Untitled');
  const desc = cleanNewsText(art.description || 'Click to read the full intelligence report.');
  const why = art.whyItMatters || buildSmartFallbackInsight(art);
  const encodedTitle = encodeURIComponent(title);
  const encodedUrl = encodeURIComponent(url);
  const waText = encodeURIComponent(`📰 ${title}\n💡 Why it matters: ${why}\nRead via NexBrief: ${url}`);

  return `
    <article class="archive-article-card">
      ${art.urlToImage ? `<img src="${escapeHtml(safeHttpUrl(art.urlToImage))}" alt="${escapeHtml(title)}" class="archive-article-img" loading="lazy" onerror="this.style.display='none'" />` : ''}
      <div class="archive-article-body">
        <div class="archive-article-meta">
          <span class="archive-cat-pill" style="background:${color};">${escapeHtml(cat)}</span>
          ${art.isIndia ? '<span class="archive-india-pill">🇮🇳 India</span>' : '<span class="archive-global-pill">🌐 Global</span>'}
          <span class="archive-source-tag">📰 ${escapeHtml(art.source || 'News Source')}</span>
        </div>
        <h3 class="archive-article-title">
          <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a>
        </h3>
        <p class="archive-article-desc">${escapeHtml(desc)}</p>
        <div class="why-matters-box">
          <span class="why-matters-label">🤖 Why This Matters:</span>
          <span class="why-matters-text">${escapeHtml(why)}</span>
        </div>
        <div class="archive-article-actions">
          <div class="article-share-row">
            <a href="https://api.whatsapp.com/send?text=${waText}" target="_blank" rel="noopener noreferrer" class="mini-share-btn share-wa" title="Share on WhatsApp">WhatsApp</a>
            <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}" target="_blank" rel="noopener noreferrer" class="mini-share-btn share-li" title="Share on LinkedIn">LinkedIn</a>
            <a href="https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}" target="_blank" rel="noopener noreferrer" class="mini-share-btn share-x" title="Post on X">X</a>
            <button type="button" class="mini-share-btn share-copy copy-share-btn" data-url="${escapeHtml(url)}" title="Copy link">📋 Copy</button>
          </div>
          <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="archive-read-link">Read Full ↗</a>
        </div>
      </div>
    </article>
  `;
};

// @route   GET /archive
// @desc    Public SEO-indexed list of all sent daily digests
// @access  Public
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 18;
    const skip = (page - 1) * limit;

    const [digests, totalCount] = await Promise.all([
      Digest.find({ status: 'sent' })
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .select('date itNews educationNews generalNews sentAt recipientCount'),
      Digest.countDocuments({ status: 'sent' }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    const jsonLd = `
      <script type="application/ld+json">
      ${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'NexBrief Daily IT & Tech Digest Archive',
        description: 'Browse every past daily briefing from NexBrief — India IT jobs, AI tools, B.Tech education updates & world headlines.',
        url: `${BASE_SITE_URL}/archive`,
      })}
      </script>`;

    const cardsHtml = digests
      .map((d) => {
        const itCount = d.itNews?.length || 0;
        const eduCount = d.educationNews?.length || 0;
        const worldCount = d.generalNews?.length || 0;
        const headline = cleanNewsText(d.itNews?.[0]?.title || d.educationNews?.[0]?.title || 'Daily IT & Tech Briefing');
        return `
          <a href="/archive/${escapeHtml(d.date)}" class="archive-day-card">
            <div class="archive-day-top">
              <span class="archive-day-date">📅 ${escapeHtml(formatDisplayDate(d.date))}</span>
              <span class="archive-day-badge">${itCount + eduCount + worldCount} Stories</span>
            </div>
            <h2 class="archive-day-headline">${escapeHtml(headline)}</h2>
            <div class="archive-day-counts">
              <span>🔴 ${itCount} IT &amp; Jobs</span>
              <span>📚 ${eduCount} Education</span>
              <span>🌐 ${worldCount} World</span>
            </div>
            <div class="archive-day-cta">Read Full Edition →</div>
          </a>`;
      })
      .join('');

    const paginationHtml =
      totalPages > 1
        ? `<div class="archive-pagination">
            ${page > 1 ? `<a href="/archive?page=${page - 1}" class="btn btn-ghost btn-sm">← Newer Editions</a>` : ''}
            <span class="archive-page-info">Page ${page} of ${totalPages} (${totalCount} Digests)</span>
            ${page < totalPages ? `<a href="/archive?page=${page + 1}" class="btn btn-ghost btn-sm">Older Editions →</a>` : ''}
          </div>`
        : '';

    const bodyHtml = `
      <section class="archive-hero">
        <div class="section-badge">🗞️ Public SEO Digest Archive</div>
        <h1 class="archive-title">NexBrief Past Editions</h1>
        <p class="archive-subtitle">Every 7:00 AM IST briefing archived cleanly for engineering students, job seekers &amp; developers across India.</p>
        <div class="archive-countdown-bar">
          <span class="countdown-pulse-dot"></span>
          <span>Next digest in:</span>
          <strong class="live-digest-countdown" data-countdown>--:--:--</strong>
          <span class="countdown-tz">(7:00 AM IST Daily)</span>
        </div>
      </section>

      <section class="archive-grid">
        ${cardsHtml || '<p style="color:var(--color-text-muted);text-align:center;grid-column:1/-1;">No published digests in archive yet.</p>'}
      </section>
      ${paginationHtml}
    `;

    res.send(
      renderSharedLayout({
        title: `Digest Archive${page > 1 ? ` (Page ${page})` : ''} — NexBrief Daily IT News`,
        description: 'Browse complete archives of NexBrief Daily IT News: India tech hiring, AI models, developer tools, B.Tech education, and world headlines.',
        canonicalPath: page > 1 ? `/archive?page=${page}` : '/archive',
        jsonLdScripts: jsonLd,
        bodyHtml,
      })
    );
  } catch (err) {
    console.error('Archive list error:', err);
    res.status(500).send('Unable to load digest archive right now.');
  }
});

// @route   GET /archive/:date
// @desc    Public SEO-indexed edition page for a single day's digest
// @access  Public
router.get('/:date', async (req, res) => {
  try {
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(404).send(
        renderSharedLayout({
          title: 'Digest Not Found — NexBrief',
          description: 'Invalid archive date format.',
          canonicalPath: '/archive',
          bodyHtml: `<div class="archive-empty-box"><h1>Invalid Archive Date</h1><p>Please select a digest from the <a href="/archive">public archive</a>.</p></div>`,
        })
      );
    }

    const digest = await Digest.findOne({ date, status: 'sent' });
    if (!digest) {
      return res.status(404).send(
        renderSharedLayout({
          title: `Digest Not Found (${date}) — NexBrief`,
          description: `No published digest found for ${date}.`,
          canonicalPath: '/archive',
          bodyHtml: `<div class="archive-empty-box"><h1>No Digest Found for ${escapeHtml(date)}</h1><p>Explore other mornings in the <a href="/archive">NexBrief Digest Archive</a>.</p></div>`,
        })
      );
    }

    // Previous and next sent digest dates for navigation
    const [prevDigest, nextDigest] = await Promise.all([
      Digest.findOne({ status: 'sent', date: { $lt: date } }).sort({ date: -1 }).select('date'),
      Digest.findOne({ status: 'sent', date: { $gt: date } }).sort({ date: 1 }).select('date'),
    ]);

    const displayDate = formatDisplayDate(date);
    const itList = digest.itNews || [];
    const eduList = digest.educationNews || [];
    const worldList = digest.generalNews || [];
    const topTitles = [...itList, ...eduList]
      .slice(0, 3)
      .map((a) => cleanNewsText(a.title))
      .join(' · ');

    const pageDescription = topTitles
      ? `${displayDate} IT & Tech Briefing: ${topTitles.slice(0, 155)}`
      : `Daily IT News, Education & World Headlines for ${displayDate} curated by NexBrief.`;

    const jsonLd = `
      <script type="application/ld+json">
      ${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: `NexBrief Daily IT & Tech Digest — ${displayDate}`,
        datePublished: digest.sentAt || `${date}T01:30:00Z`,
        dateModified: digest.updatedAt || digest.sentAt || `${date}T01:30:00Z`,
        author: { '@type': 'Person', name: 'Md Rounaq Ali', url: 'https://md-rounaq-ali.netlify.app/' },
        publisher: { '@type': 'Organization', name: 'NexBrief Daily News' },
        mainEntityOfPage: `${BASE_SITE_URL}/archive/${date}`,
      })}
      </script>`;

    const bodyHtml = `
      <div class="archive-breadcrumb">
        <a href="/">Home</a> &nbsp;/&nbsp; <a href="/archive">Archive</a> &nbsp;/&nbsp; <span>${escapeHtml(date)}</span>
      </div>

      <section class="archive-hero">
        <div class="section-badge">📅 Edition · ${escapeHtml(displayDate)}</div>
        <h1 class="archive-title">Daily IT &amp; Tech Digest</h1>
        <p class="archive-subtitle">${itList.length} IT &amp; Jobs · ${eduList.length} Education &amp; Research · ${worldList.length} World Headlines</p>
        <div class="archive-countdown-bar">
          <span class="countdown-pulse-dot"></span>
          <span>Next digest in:</span>
          <strong class="live-digest-countdown" data-countdown>--:--:--</strong>
          <span class="countdown-tz">(7:00 AM IST Daily)</span>
        </div>
        <div class="archive-edition-nav">
          ${prevDigest ? `<a href="/archive/${escapeHtml(prevDigest.date)}" class="btn btn-ghost btn-sm">← ${escapeHtml(prevDigest.date)}</a>` : '<span></span>'}
          <a href="/archive" class="btn btn-ghost btn-sm">📚 All Editions</a>
          ${nextDigest ? `<a href="/archive/${escapeHtml(nextDigest.date)}" class="btn btn-ghost btn-sm">${escapeHtml(nextDigest.date)} →</a>` : '<span></span>'}
        </div>
      </section>

      <section class="archive-section">
        <div class="archive-sec-header" style="border-left-color:#ef4444;">
          <h2>🔴 IT, Tech Jobs &amp; AI <span class="archive-sec-pct">(50%)</span></h2>
          <p>Hiring Alerts · AI Tools · Developer Frameworks · Cybersecurity · Cloud</p>
        </div>
        <div class="archive-articles-grid">
          ${itList.map(renderArchiveArticleCard).join('') || '<p style="color:var(--color-text-muted);">No IT articles in this edition.</p>'}
        </div>
      </section>

      <section class="archive-section">
        <div class="archive-sec-header" style="border-left-color:#f59e0b;">
          <h2>📚 Education &amp; Research <span class="archive-sec-pct">(30%)</span></h2>
          <p>GATE · AICTE · IIT/NIT · Placements · Science &amp; Space</p>
        </div>
        <div class="archive-articles-grid">
          ${eduList.map(renderArchiveArticleCard).join('') || '<p style="color:var(--color-text-muted);">No education articles in this edition.</p>'}
        </div>
      </section>

      <section class="archive-section">
        <div class="archive-sec-header" style="border-left-color:#10b981;">
          <h2>🌐 World Headlines <span class="archive-sec-pct">(20%)</span></h2>
          <p>Startup Funding · Digital Economy · Global Tech Policy</p>
        </div>
        <div class="archive-articles-grid">
          ${worldList.map(renderArchiveArticleCard).join('') || '<p style="color:var(--color-text-muted);">No world headlines in this edition.</p>'}
        </div>
      </section>

      <section class="viral-box" style="margin-top:40px;text-align:center;">
        <h2 class="viral-title">Get This Intelligence in Your Inbox at 7:00 AM IST</h2>
        <p class="viral-desc">Join India's B.Tech students and engineers receiving crisp daily news &amp; AI "Why This Matters" summaries — 100% free.</p>
        <a href="/?auth=register" class="btn btn-primary btn-lg">📧 Subscribe Free Now</a>
      </section>
    `;

    res.send(
      renderSharedLayout({
        title: `NexBrief Digest (${displayDate}) — Daily IT News & Jobs`,
        description: pageDescription,
        canonicalPath: `/archive/${date}`,
        jsonLdScripts: jsonLd,
        bodyHtml,
      })
    );
  } catch (err) {
    console.error('Archive edition error:', err);
    res.status(500).send('Unable to load digest edition right now.');
  }
});

module.exports = router;
