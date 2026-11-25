<div align="center">
  <img src="public/images/logo.svg" alt="NexBrief Logo" width="84" height="84" />
  <h1>NexBrief</h1>
  <p>
    <strong>India's Daily IT, Tech Hiring &amp; Engineering Intelligence Platform</strong>
  </p>
  <p>
    Curated morning briefings — <strong>50% IT, Jobs &amp; AI</strong> · <strong>30% Education &amp; Research</strong> · <strong>20% World Headlines</strong> — delivered at <strong>7:00 AM IST</strong> via Email, Dashboard, Web Push &amp; PWA.
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
    <a href="https://nexbrief-news.onrender.com" target="_blank"><strong>🌐 Live Website</strong></a>
    &nbsp;&nbsp;•&nbsp;&nbsp;
    <a href="https://nexbrief-news.onrender.com/archive" target="_blank"><strong>🗞️ Digest Archive</strong></a>
    &nbsp;&nbsp;•&nbsp;&nbsp;
    <a href="https://dev.to/mdrounaqali/how-i-built-nexbrief-an-automated-daily-it-newsletter-platform-for-engineering-students-3b57" target="_blank"><strong>📖 Case Study on Dev.to</strong></a>
    &nbsp;&nbsp;•&nbsp;&nbsp;
    <a href="https://md-rounaq-ali.netlify.app/" target="_blank"><strong>👨‍💻 Creator Portfolio</strong></a>
  </p>
</div>

---

## Why NexBrief?

Engineering students, freshers, and software developers in India waste 30–45 minutes daily filtering through cluttered news portals and off-topic social feeds just to track campus/off-campus hiring drives, developer tools, AI releases, and GATE/AICTE updates.

**NexBrief** automates the entire curation pipeline and delivers a clean, high-signal 2-to-5 minute morning briefing every day at **7:00 AM IST**.

---

## Platform Capabilities

| Feature | Implementation Highlights |
| :--- | :--- |
| 🇮🇳 **India-First Curation (60/40)** | Enforces a **60% India / 40% Global** balance across every section with a 3-day deduplication filter against previously sent digests. |
| 🎯 **Student-Focused Filtering** | Blocks off-topic gaming, sports, celebrity, and entertainment clickbait while prioritizing Indian IT hiring (TCS, Infosys, Wipro, HCL, GCCs, Internships). |
| 🤖 **AI *"Why This Matters"*** | Batched **Google Gemini (`gemini-flash-latest`)** summarization with an automatic domain-aware fallback adding a 1-line actionable takeaway to every article. |
| 🗞️ **SEO Public Archive (`/archive`)** | Server-rendered edition archive (`/archive/YYYY-MM-DD`) featuring Open Graph meta tags, `NewsArticle` JSON-LD structured data, and dynamic `/sitemap.xml`. |
| ⏰ **Live 7 AM IST Countdown** | Timezone-safe `HH:MM:SS` countdown across the homepage, dashboard, and public archive. |
| 🔔 **VAPID Web Push Alerts** | Morning browser notifications using `web-push` with automatic MongoDB key persistence and stale endpoint cleanup. |
| 📱 **Installable PWA** | Home-screen installable web app (`manifest.json`, verified `192×192` / `512×512` PNG icons, and Service Worker offline shell cache). |
| 🔗 **One-Click Social Sharing** | WhatsApp, LinkedIn, X (Twitter), and Copy-Link buttons on every dashboard card, reader modal, and archive article. |
| 📧 **Port-443 Email + Open Tracking** | Uses Brevo Transactional HTTPS API to bypass SMTP blocks, enforces 6-digit OTP registration & password recovery, and tracks unique open rates via a 1×1 GIF pixel. |

---

## Architecture Pipeline

```text
Cron Trigger (7:00 AM IST) / Manual Admin Trigger
   │
   ▼
[newsService.js] ──► Multi-query NewsAPI fetch + relevance filter + 60/40 India/World mix + 3-day dedup
   │
   ▼
[aiService.js]   ──► Gemini batched JSON call (with smart heuristic fallback) -> adds `whyItMatters`
   │
   ▼
[MongoDB Atlas]  ──► Saves Digest -> exposes /dashboard, /api/news/preview, /archive/:date & /sitemap.xml
   │
   ├──► [emailService.js] ──► Brevo Port-443 HTML Digest + 1×1 Open Tracking Pixel (/api/track/open)
   └──► [pushService.js]  ──► Web Push broadcast to all active browser subscriptions (/sw.js)
```

---

## Tech Stack

- **Backend:** Node.js (`>= 18`), Express.js, `node-cron`, `web-push`
- **Database:** MongoDB Atlas + Mongoose 8
- **APIs & AI:** NewsAPI.org, Google Gemini API (`gemini-flash-latest`), Brevo Transactional HTTPS API (Port 443)
- **Auth & Security:** JWT (`jsonwebtoken`), `bcryptjs`, 6-digit expiring email OTP verification
- **Frontend & PWA:** Semantic HTML5, CSS3, ES6 Vanilla JavaScript, Service Worker + Web App Manifest

---

## Project Structure

```text
nexbrief/
├── server/
│   ├── index.js                   # Express server, favicon/PWA headers, dynamic /sitemap.xml
│   ├── config/db.js               # MongoDB Atlas connection setup
│   ├── jobs/dailyDigest.js        # 7 AM IST pipeline orchestrator
│   ├── middleware/                # auth.js (JWT guard), admin.js (admin guard)
│   ├── models/                    # Digest, User, PendingUser, PushSubscription, AppConfig
│   ├── routes/                    # auth, news, newsletter, archive, track, push, admin
│   ├── services/                  # newsService, aiService, emailService, pushService
│   └── utils/dateIST.js           # Timezone-safe IST (UTC+5:30) date utilities
├── public/
│   ├── index.html                 # SEO landing page, live topic search & countdown
│   ├── dashboard.html             # Protected digest reader & sharing workspace
│   ├── admin.html                 # Admin analytics (open rates, subscribers, push controls)
│   ├── manifest.json              # PWA web app manifest
│   ├── sw.js                      # Service worker (shell caching + Web Push handler)
│   ├── robots.txt                 # Search engine crawl directives
│   ├── css/                       # style.css, dashboard.css, admin.css
│   ├── js/                        # pwa.js, app.js, dashboard.js, admin.js
│   └── images/                    # SVG brand logo & verified PNG icons
├── .env.example
└── package.json
```

---

## Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/md-rounaq-ali/nexbrief-daily-it-intelligence-platform.git
cd nexbrief-daily-it-intelligence-platform
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and configure your keys:

| Variable | Required | Description |
| :--- | :---: | :--- |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `JWT_SECRET` | Yes | Secret for signing JWTs & authenticating cron triggers |
| `NEWS_API_KEY` | Yes | API key from [newsapi.org](https://newsapi.org) |
| `BREVO_API_KEY` | Yes | Brevo `v3` transactional email key (`xkeysib-...`) |
| `FROM_EMAIL` / `FROM_NAME` | Yes | Verified sender address and display name |
| `APP_URL` | Yes | Live base URL (e.g. `https://nexbrief-news.onrender.com`) |
| `GEMINI_API_KEY` | Optional | Google AI Studio key for batched LLM *"Why This Matters"* takeaways |
| `VAPID_PUBLIC_KEY` / `PRIVATE_KEY` | Optional | Web Push keys (auto-generated & stored in MongoDB if omitted) |

### 3. Run Server
```bash
npm run dev    # Development with nodemon (http://localhost:3000)
npm start      # Production
```

### 4. Production Cron Setup (`cron-job.org` + Render)

| Job | Schedule | Target |
| :--- | :--- | :--- |
| **Keep-Alive Ping** | Every 10–14 mins | `GET https://nexbrief-news.onrender.com/api/health` |
| **Daily Morning Digest** | Daily `07:00 AM IST` (`Asia/Kolkata`) | `POST https://nexbrief-news.onrender.com/api/newsletter/trigger` (`{"secretKey": "<JWT_SECRET>"}`) |

---

## Author & License

Designed and built by **[Md Rounaq Ali](https://md-rounaq-ali.netlify.app/)** (B.Tech CSE, NNRESGI Hyderabad)  
🔎 Search Creator on Google: **[md rounaq ali ↗](https://www.google.com/search?q=md+rounaq+ali)**

Licensed under the [MIT License](https://opensource.org/licenses/MIT).
