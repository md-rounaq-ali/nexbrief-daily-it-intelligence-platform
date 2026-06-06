# NexBrief — Daily IT & Tech Intelligence Platform

<p align="center">
  <a href="https://nexbrief-news.onrender.com" target="_blank">
    <img src="https://img.shields.io/badge/Live%20Demo-Online-brightgreen?style=for-the-badge&logo=render&logoColor=white" alt="Live Demo" />
  </a>
  <img src="https://img.shields.io/badge/Node.js-v18+-blue?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node version" />
  <img src="https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Email%20Engine-Brevo%20API-orange?style=for-the-badge&logo=mailchimp&logoColor=white" alt="Brevo API" />
</p>

---

## 🌐 Live Application URL
 **Visit the Live Site:** **[https://nexbrief-news.onrender.com](https://nexbrief-news.onrender.com)**

---

**NexBrief** is a premium, fully automated daily newsletter platform designed for engineers, IT professionals, and B.Tech students. It aggregates real-world tech, cloud, AI, research, and general news to deliver a beautifully formatted briefing directly to subscribers' inboxes every morning at **7:00 AM IST**.

---

## 🌟 Key Features

*   📰 **Real-World Aggregation**: Uses live feeds to construct newsletters featuring real, verifiable tech, education, and global news.
*   📧 **Bypass SMTP Blocks (HTTPS Email Engine)**: Uses Brevo's Transactional HTTP API over **Port 443** (instead of standard SMTP ports like `587` or `465`), bypassing common ISP port blocks (such as ACT Fibernet) and ensuring 100% email delivery.
*   📝 **Skimmable Content**: Automatically parses long article descriptions into clean, bullet-pointed lists in the email body for fast scanning and readability.
*   🔐 **Secure Authentication**: Built with JWT session tokens and password hashing (`bcryptjs`).
*   ⚙️ **Advanced Admin Console**:
    *   Monitor subscriber lists with modern, clean UI icons.
    *   Promote or demote administrator privileges.
    *   Permanently delete users to allow direct re-registration.
    *   Manually trigger global daily digests and send test mockups.
*   🎨 **Premium UI/UX**: Designed with a sleek dark-mode glassmorphic theme, responsive grids, and clean hover state animations.

---

## 🛠️ Architecture & Tech Stack

| Layer | Component | Notes |
| :--- | :--- | :--- |
| **Frontend** | HTML5, Vanilla CSS, Core JavaScript | Modern, dependency-free responsive layout |
| **Backend** | Node.js + Express.js | Robust REST API endpoints |
| **Database** | MongoDB Atlas + Mongoose | Schema validation for users, digests, and pending states |
| **Email Delivery** | Brevo Transactional HTTPS API | Port 443 delivery for maximum ISP compatibility |
| **Scheduling** | cron-job.org | Automated triggers for morning digests |

---

## 📁 Directory Layout

```text
nexbrief/
├── server/
│   ├── index.js              # Express Application Entry Point
│   ├── config/db.js          # MongoDB Database Connection Handler
│   ├── models/               # Mongoose Schemas (User, Digest, PendingUser)
│   ├── routes/               # REST API Routes (Auth, Admin, News, Newsletter)
│   ├── services/             # Core Logic (newsService, emailService)
│   └── middleware/           # Authorization Guards (JWT Protect, Admin Guard)
├── public/
│   ├── index.html            # Landing / Auth Entry Interface
│   ├── dashboard.html        # Interactive User Profile Panel
│   ├── admin.html            # Secure Admin Dashboard
│   ├── css/                  # Compiled styles (style.css, dashboard.css, admin.css)
│   └── js/                   # Frontend Controllers (app.js, dashboard.js, admin.js)
├── .env.example              # Configuration Blueprint
└── README.md                 # Documentation
```

---

## ⚙️ Setting Up Locally

### 1. Pre-requisites
*   **MongoDB Atlas Cluster** (Free tier)
*   **Brevo API Key** (v3 Transactional Key)
*   **NewsAPI Key** (Free Developer Key)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/md-rounaq-ali/nexbrief-daily-it-intelligence-platform.git
cd nexbrief-daily-it-intelligence-platform

# Install dependencies
npm install
```

### 3. Environment Configurations
Rename `.env.example` to `.env` and populate it with your keys:
```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_token
BREVO_API_KEY=your_brevo_xkeysib_api_key
FROM_EMAIL=your_sender_email@domain.com
FROM_NAME="NexBrief Daily"
APP_URL=http://localhost:3000
```
*(Note: Be sure to use `MONGODB_URI` exactly as shown above, which is what the database connection driver expects).*

### 4. Running the Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your web browser.

---

## 🌐 Live Deployment & Automation

This project is configured for deployment on **Render.com** (hosting the Node/Express backend) and **cron-job.org** (triggering the automated daily newsletter delivery).

### Automating the Daily Digest:
To trigger the automated daily dispatch, set up a cron job pointing to:
* **Endpoint:** `POST https://nexbrief-news.onrender.com/api/newsletter/trigger`
* **Headers:** `Content-Type: application/json`
* **Body:**
  ```json
  {
    "secretKey": "your_jwt_secret_token"
  }
  ```
* **Schedule:** Daily at `07:00 AM IST` (Timezone: `Asia/Kolkata`)

---

## 📜 Credits & License

*   **Made by Md Rounaq Ali** for India's engineers. Portfolio: [md-rounaq-ali.netlify.app](https://md-rounaq-ali.netlify.app/)
*   Licensed under the MIT License. Feel free to clone, modify, and host!

