---
title: How I Built NexBrief: An Automated Daily IT Newsletter Platform for Engineering Students
published: true
description: A deep dive into the architecture, curation algorithm, and design of NexBrief—India's first dedicated IT daily digest platform.
tags: nodejs, webdev, javascript, mongodb
cover_image: https://raw.githubusercontent.com/md-rounaq-ali/nexbrief-daily-it-intelligence-platform/main/public/images/devto_cover.png
---

As a B.Tech student, keeping up with the rapid developments in the IT and AI sectors is critical for career development, placements, and interviews. However, searching through countless tech blogs, college portals, and world news sites every single day is time-consuming and exhausting.

To solve this problem, I built **NexBrief**—India's first dedicated daily newsletter and intelligence platform tailored specifically for engineering students and IT professionals. 

Every morning at **7:00 AM IST**, registered subscribers receive a curated, highly structured newsletter direct to their inbox. Readers can get fully caught up in just **2 to 5 minutes**.

In this article, I’ll share the architecture under the hood, key engineering challenges I solved, and code snippets from the system.

---

## 🌟 The Content Formula
NexBrief operates on a strict, target-driven content ratio to deliver maximum value in minimum time:
*   🔴 **50% IT & AI** (framework releases, tools, internship openings, cybersecurity reports).
*   📚 **30% Education & Academic Research** (placements, exam dates, college hackathons, scientific research).
*   🌐 **20% World Headlines** (global business, economy, tech policy).

---

## 🛠️ The Tech Stack
*   **Frontend**: Modern, responsive, glassmorphic dashboard built using Semantic HTML5, Vanilla CSS, and asynchronous JavaScript.
*   **Backend**: REST APIs powered by Node.js and Express.
*   **Database**: MongoDB & Mongoose for user profile storage, subscription states, and newsletter dispatch caching.
*   **Email Engine**: Brevo Transactional HTTPS API.
*   **Cron Scheduler**: cron-job.org.

---

## ⚙️ Core Engineering Challenges & Solutions

### 1. The 60/40 Curation & Curation Pool Algorithm
A major product requirement was to balance news localization: exactly **60% of the content must be India-centric**, while **40% focuses on Global updates**. 

To implement this, I built a custom pooling algorithm that pulls from multiple NewsAPI streams, categorizes them, separates them into India vs. World pools, and applies dynamic sizing. If the live feed has a shortage of articles, it gracefully backfills the remainder from cached fallbacks, ensuring the newsletter layout is always balanced.

Here is the core news mixing algorithm (`newsService.js`):

```javascript
const mixIndiaAndWorld = (liveArticles, min, max, categorizeFn, fallbackFn) => {
  const cleanArticles = (liveArticles || []).filter(a => 
    a.title && a.title !== '[Removed]' && a.description && a.url
  );

  const seenTitles = new Set();
  const uniqueLive = [];

  for (const a of cleanArticles) {
    const titleNorm = a.title.toLowerCase().trim();
    if (seenTitles.has(titleNorm)) continue;
    seenTitles.add(titleNorm);

    const cat = categorizeFn(a.title + ' ' + (a.description || ''));
    uniqueLive.push({
      title: a.title,
      description: a.description || 'Click to read full article.',
      url: a.url,
      urlToImage: a.urlToImage || getCategoryStockImage(cat),
      source: a.source?.name || 'News Source',
      publishedAt: a.publishedAt || new Date().toISOString(),
      category: cat,
      isIndia: isIndiaRelated(a.title, a.description, a.source?.name)
    });
  }

  const liveIndia = uniqueLive.filter(a => a.isIndia);
  const liveWorld = uniqueLive.filter(a => !a.isIndia);

  // Determine dynamic count C based on news availability
  let C = Math.min(Math.max(uniqueLive.length, min), max);

  const targetIndiaCount = Math.round(C * 0.6);
  const targetWorldCount = C - targetIndiaCount;

  // Fetch fallbacks if live news is short
  const allFallbacks = fallbackFn(50);
  const fallbackIndia = allFallbacks.filter(f => f.isIndia);
  const fallbackWorld = allFallbacks.filter(f => !f.isIndia);

  const finalIndia = fillPool(liveIndia, fallbackIndia, targetIndiaCount, seenTitles);
  const finalWorld = fillPool(liveWorld, fallbackWorld, targetWorldCount, seenTitles);

  const combined = [...finalIndia, ...finalWorld];
  
  // Sort India-related to the top
  return combined.sort((a, b) => (a.isIndia && !b.isIndia ? -1 : 1));
};
```

---

### 2. Fallback Image System (Zero Gray Boxes)
A common problem in aggregators is missing images from news feeds, leaving ugly gray boxes on dashboards or emails. 

NexBrief solves this by binding high-resolution, topic-relevant Unsplash images dynamically based on article subtopics (e.g. AI, Science, Cybersecurity, Software, Cloud). If the publisher provides no image, the system automatically injects a beautiful themed placeholder.

---

### 3. Bypassing SMTP Blocks with HTTP Email Delivery
Many popular cloud hosting providers (like Render) block standard SMTP outbound ports (25, 465, 587) by default. This prevents node-mailer from connecting to SMTP servers.

To bypass this restriction, I designed the system to communicate directly with Brevo using its **Transactional HTTPS REST API** over Port 443 instead of traditional SMTP. This guarantees 100% email delivery.

Here is the sender service integration (`emailService.js`):

```javascript
const fetch = require('node-fetch');

const sendEmailViaAPI = async ({ toEmail, toName, subject, htmlContent }) => {
  const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
  
  try {
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: process.env.FROM_NAME || 'NexBrief Daily',
          email: process.env.FROM_EMAIL,
        },
        to: [{ email: toEmail, name: toName }],
        subject: subject,
        htmlContent: htmlContent,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Brevo API Send Failure');
    }
    return data;
  } catch (error) {
    console.error(`❌ Send Failure to ${toEmail}:`, error.message);
    throw error;
  }
};
```

---

### 4. Interactive Glassmorphic Admin Dashboard
Admins have access to a secure, password-guarded control panel built with glassmorphism aesthetics. The panel allows:
*   Real-time monitoring of user subscription statuses (Active vs Paused).
*   Manually triggering a global digest or test dispatch.
*   Administrative privileges configuration (promoting or demoting admins).
*   Deleting accounts permanently to clean up expired or inactive subscriptions.

---

## 📈 SEO & Discoverability
To ensure rapid search engine discoverability on subdomains, NexBrief is shipped with verified sitemaps and crawling permissions (`robots.txt` and `sitemap.xml`) which are submitted and successfully tracked by **Google Search Console**.

---

## 🚀 Check It Out
*   **Live Application**: [https://nexbrief-news.onrender.com](https://nexbrief-news.onrender.com)
*   **GitHub Repository**: [GitHub Link]
*   **My Portfolio**: [https://md-rounaq-ali.netlify.app](https://md-rounaq-ali.netlify.app)

If you'd like to support the project, please leave a ⭐ on the GitHub repository and sign up to receive your first brief tomorrow morning! I'd love to hear your feedback in the comments.
