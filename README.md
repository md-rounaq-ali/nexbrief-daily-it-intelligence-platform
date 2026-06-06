# 🚀 NexBrief — Daily IT & Tech Intelligence Platform

<p align="center">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5" />
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
</p>

---

**NexBrief** is a premium, fully automated daily newsletter platform designed for engineers, IT professionals, and B.Tech students. It automatically aggregates real-world tech, cloud, AI, research, and general news to deliver a beautifully formatted briefing directly to subscribers' inboxes every morning at **7:00 AM IST**.

---

## 🌟 Key Features

*   📰 **Real-World Aggregation**: Uses live feeds to construct newsletters featuring real, verifiable tech, education, and global news.
*   📧 **Robust Mail Engine**: Built with a custom HTTPS-based Brevo API integration on **Port 443** to completely bypass common ISP SMTP port blocks (Ports 587 & 465).
*   🔐 **Secure Authentication**: Implementation of JWT session tokens with hashed password databases (`bcryptjs`).
*   🖥️ **Interactive User Dashboard**: View today's edition, check reading stats, and manage subscription preferences.
*   ⚙️ **Advanced Admin Console**:
    *   Monitor subscriber lists with modern, clean UI icons.
    *   Promote/demote administrator privileges.
    *   Permanently delete users to allow direct re-registration.
    *   Manually trigger global daily digests and send test mockups.
*   🎨 **Premium UI/UX**: Designed with glassmorphism, responsive grids, and dark modes optimized for mobile, tablet, laptop, and smart TV screens.

---

## 🛠️ Architecture & Tech Stack

| Layer | Component | Notes |
| :--- | :--- | :--- |
| **Frontend** | HTML5, Vanilla CSS, Core JavaScript | Modern, dependency-free responsive layout |
| **Backend** | Node.js + Express.js | Robust REST API endpoints |
| **Database** | MongoDB Atlas + Mongoose | Schema validation for users, digests, and pending states |
| **Email Delivery** | Brevo Transactional HTTPS API | Port 443 delivery for maximum ISP compatibility |
| **Scheduling** | node-cron + cron-job.org | Automated triggers for morning digests |

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
│   ├── middleware/           # Authorization Guards (JWT Protect, Admin Guard)
│   └── jobs/dailyDigest.js   # Background Cron Scheduling & Dispatch Logic
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
git clone https://github.com/your-username/nexbrief.git
cd nexbrief

# Install dependencies
npm install
```

### 3. Environment Configurations
Rename `.env.example` to `.env` and populate it with your keys:
```env
PORT=3000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_token
BREVO_API_KEY=your_brevo_xkeysib_api_key
FROM_EMAIL=your_sender_email@domain.com
FROM_NAME="NexBrief Daily"
APP_URL=http://localhost:3000
```

### 4. Running the Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your web browser.

---

## 🌐 Live Deployment (Render.com + Cron-Job.org)

For step-by-step setup guides, environment variable configurations, and automated server pings to keep the free hosting active 24/7, refer to the **[Deployment Guide](file:///C:/Users/Md%20Rounaq%20Ali/.gemini/antigravity/brain/3ff8d732-737c-4f29-bf83-2f1b1647f0ca/deployment_guide.md)**.

---

## 📜 Credits & License

*   **Made by Md Rounaq Ali** for India's engineers. Portfolio: [md-rounaq-ali.netlify.app](https://md-rounaq-ali.netlify.app/)
*   Licensed under the MIT License. Feel free to clone, modify, and host!
