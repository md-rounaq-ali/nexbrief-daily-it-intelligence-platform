<div align="center">
  <img src="public/images/logo.svg" alt="NexBrief Logo" width="88" height="88" />
  <h1>NexBrief</h1>
  <p>
    <strong>India's Daily IT, Tech Hiring &amp; Engineering Intelligence Platform</strong><br />
    50% IT, Jobs &amp; AI &nbsp;·&nbsp; 30% Education &amp; Research &nbsp;·&nbsp; 20% World Headlines — Delivered daily at <strong>7:00 AM IST</strong>
  </p>

  <p>
    <a href="https://nexbrief-news.onrender.com" target="_blank">
      <img src="https://img.shields.io/badge/Live%20Platform-Online-10b981?style=for-the-badge&logo=render&logoColor=white" alt="Live Platform" />
    </a>
    <a href="https://nexbrief-news.onrender.com/archive" target="_blank">
      <img src="https://img.shields.io/badge/Public%20Archive-SEO%20Indexed-6366f1?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Digest Archive" />
    </a>
    <img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js 18+" />
    <img src="https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB Atlas" />
    <img src="https://img.shields.io/badge/PWA-Installable-38bdf8?style=for-the-badge&logo=pwa&logoColor=white" alt="PWA Ready" />
  </p>

  <p>
    <a href="https://nexbrief-news.onrender.com" target="_blank"><strong>🌐 Live App</strong></a> &nbsp;·&nbsp;
    <a href="https://nexbrief-news.onrender.com/archive" target="_blank"><strong>🗞️ Public Archive</strong></a> &nbsp;·&nbsp;
    <a href="https://dev.to/mdrounaqali/how-i-built-nexbrief-an-automated-daily-it-newsletter-platform-for-engineering-students-3b57" target="_blank"><strong>📖 Architecture Article</strong></a>
  </p>
</div>

---

## Overview

**NexBrief** is a full-stack automated news curation and daily briefing platform built for B.Tech students, freshers, and software engineers in India. Instead of scrolling across scattered blogs and job feeds, subscribers receive a focused 2–5 minute digest via **Email, Interactive Web Dashboard, Browser Push Alerts, and Installable PWA** every morning at **7:00 AM IST**.

---

## Key Features

| Capability | Details |
| :--- | :--- |
| 🇮🇳 **India-First Curation (60/40)** | Balances **60% India** and **40% Global** tech coverage across every section with a 3-day deduplication engine. |
| 🎯 **Strict Relevance Filtering** | Blocks off-topic gaming, celebrity, sports, and tabloid stories before categorization. |
| 💼 **Student-Focused Categories** | Prioritizes Indian IT hiring, internships & placements (**Jobs**), followed by **AI & LLMs**, **Dev Tools**, **Cybersecurity**, and **Cloud**. |
| 🤖 **AI *"Why This Matters"* Insights** | Batched **Google Gemini** enrichment (with built-in smart fallback) adding a 1-line actionable takeaway to every article. |
| 🗞️ **Public SEO Archive (`/archive`)** | Server-rendered edition archive (`/archive/YYYY-MM-DD`) with `NewsArticle` JSON-LD schema & auto-updated `/sitemap.xml`. |
| ⏰ **Live 7 AM IST Countdown** | Timezone-safe real-time countdown (`HH:MM:SS`) across the homepage, dashboard, and archive. |
| 🔔 **VAPID Web Push Notifications** | Browser morning alerts with automatic MongoDB VAPID key management and cleanup for expired subscriptions. |
| 📱 **Installable PWA App** | Native home-screen install support (`manifest.json` + Service Worker offline shell caching). |
| 🔗 **One-Click Social Sharing** | WhatsApp, LinkedIn, X, and Copy-Link share buttons on every dashboard card, modal, and archive story. |
| 📧 **Brevo Port-443 Email + Open Tracking** | Bypasses cloud SMTP blocks, verifies users with 6-digit OTPs, and tracks unique email open rates in the Admin Panel. |

---

## Tech Stack

- **Backend:** Node.js (v18+), Express.js, `node-cron`, `web-push`
- **Database:** MongoDB Atlas + Mongoose 8
- **AI & Content:** NewsAPI.org + Google Gemini API (`gemini-2.5-flash` batching)
- **Email & Auth:** Brevo Transactional HTTPS API (Port 443), JWT + `bcryptjs`
- **Frontend:** Vanilla HTML5, CSS3, ES6 JavaScript, Service Worker + Web App Manifest

---

## Project Structure

```text
nexbrief/
├── server/
│   ├── index.js                   # Express entry point, dynamic /sitemap.xml & routing
│   ├── config/db.js               # MongoDB connection setup
│   ├── jobs/dailyDigest.js        # 7 AM IST pipeline (news → AI → email → push)
│   ├── middleware/                # auth.js (JWT guard), admin.js (admin guard)
│   ├── models/                    # Digest, User, PendingUser, PushSubscription, AppConfig
│   ├── routes/                    # auth, news, newsletter, archive, track, push, admin
│   ├── services/                  # newsService, aiService, emailService, pushService
│   └── utils/dateIST.js           # Timezone-safe IST date utilities
├── public/
│   ├── index.html                 # SEO landing page, live search & countdown
│   ├── dashboard.html             # Subscriber digest reader & sharing hub
│   ├── admin.html                 # Analytics console (open rates, subscribers, push test)
│   ├── manifest.json              # PWA manifest
│   ├── sw.js                      # Service worker (shell caching + Web Push listener)
│   ├── robots.txt                 # Crawler policy
│   ├── css/                       # style.css, dashboard.css, admin.css
│   ├── js/                        # pwa.js, app.js, dashboard.js, admin.js
│   └── images/                    # SVG brand mark & true PNG PWA/favicon assets
├── .env.example
└── package.json
```

---

## Quick Start

```bash
git clone https://github.com/md-rounaq-ali/nexbrief-daily-it-intelligence-platform.git
cd nexbrief-daily-it-intelligence-platform
npm install
cp .env.example .env   # Fill in MongoDB, JWT, NewsAPI & Brevo keys
npm run dev            # http://localhost:3000
```

### Automation Endpoints (Render + cron-job.org)

| Purpose | Schedule | Request |
| :--- | :--- | :--- |
| **Keep-Alive Ping** | Every 10–14 min | `GET /api/health` |
| **Daily Morning Dispatch** | Daily `07:00 AM IST` | `POST /api/newsletter/trigger` with JSON `{"secretKey": "<JWT_SECRET>"}` |

---

## Author & License

Engineered by **[Md Rounaq Ali](https://md-rounaq-ali.netlify.app/)** (B.Tech CSE, NNRESGI Hyderabad) · Google: **[md rounaq ali ↗](https://www.google.com/search?q=md+rounaq+ali)**  
Released under the [MIT License](https://opensource.org/licenses/MIT).
