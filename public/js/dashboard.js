// NexBrief — Dashboard JavaScript (Protected Page)
'use strict';

const API_BASE = '/api';
let currentUser = null;
let token = localStorage.getItem('nexbrief_token');

// ── Utility ──────────────────────────────────────────────────────────────────
const $ = (s) => document.querySelector(s);
const showToast = (msg, type = 'info', dur = 4000) => {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), dur);
};

// ── Auth Guard — REDIRECT IF NOT LOGGED IN ────────────────────────────────────
if (!token) { window.location.replace('/'); }

const verifyAuth = async () => {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      localStorage.removeItem('nexbrief_token');
      localStorage.removeItem('nexbrief_user');
      window.location.replace('/');
      return null;
    }
    return (await res.json()).user;
  } catch {
    window.location.replace('/');
    return null;
  }
};

// ── Setup User UI ─────────────────────────────────────────────────────────────
const setupUserUI = (user) => {
  currentUser = user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  $('#user-avatar-initials').textContent = initials;
  $('#mobile-user-avatar').textContent = initials;
  $('#sidebar-user-name').textContent = user.name;
  $('#sidebar-user-email').textContent = user.email;

  // Admin link
  if (user.isAdmin) {
    const adminLink = document.createElement('a');
    adminLink.href = '/admin';
    adminLink.className = 'sidebar-link';
    adminLink.innerHTML = '<span class="nav-icon">⚙️</span> Admin Panel <span class="sidebar-pct" style="color:#fcd34d;">ADMIN</span>';
    $('.sidebar-nav')?.appendChild(adminLink);
  }

  // Subscribe toggle
  const subBtn = $('#subscribe-toggle-btn');
  if (!user.isSubscribed) {
    subBtn.textContent = '▶ Resume Digest';
    subBtn.className = 'btn btn-success btn-sm btn-full';
  }
};

// ── Category Config ───────────────────────────────────────────────────────────
const CATEGORY_CLASS = {
  'AI': 'cat-ai', 'Cybersecurity': 'cat-cybersecurity', 'Software': 'cat-software',
  'Cloud': 'cat-cloud', 'IT': 'cat-it', 'Education': 'cat-edu',
  'Research': 'cat-research', 'Science': 'cat-science',
  'General': 'cat-general', 'Technology': 'cat-technology',
};
const CATEGORY_EMOJI = {
  'AI': '🤖', 'Cybersecurity': '🔒', 'Software': '💻', 'Cloud': '☁️',
  'IT': '🖥️', 'Education': '📚', 'Research': '🔬', 'Science': '⚗️',
  'General': '🌐', 'Technology': '⚡',
};

// ── Render News Card ──────────────────────────────────────────────────────────
const timeAgo = (dateStr) => {
  if (!dateStr) return 'Recent';
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h > 23) return `${Math.floor(h / 24)}d ago`;
  if (h > 0) return `${h}h ago`;
  return `${Math.max(0, Math.floor(diff / 60000))}m ago`;
};

const renderNewsCard = (article, index) => {
  const card = document.createElement('div');
  card.className = 'news-card';
  card.style.animationDelay = `${index * 70}ms`;

  const cat = article.category || 'General';
  const emoji = CATEGORY_EMOJI[cat] || '📰';
  const catClass = CATEGORY_CLASS[cat] || 'cat-general';

  const imgHtml = article.urlToImage
    ? `<img class="card-image" src="${article.urlToImage}" alt="" loading="lazy" onerror="this.outerHTML='<div class=card-image-placeholder>${emoji}</div>'">`
    : `<div class="card-image-placeholder">${emoji}</div>`;

  card.innerHTML = `
    ${imgHtml}
    <div class="card-top">
      <span class="card-category ${catClass}">${cat}</span>
      <span class="card-time">${timeAgo(article.publishedAt)}</span>
    </div>
    <div class="card-title">${article.title || 'Untitled'}</div>
    <div class="card-desc">${article.description || 'Read the full article for more details.'}</div>
    <div class="card-footer">
      <span class="card-source">${article.source || 'News'}</span>
      <button class="card-read-btn">Read Full →</button>
    </div>
  `;
  card.addEventListener('click', () => openArticleModal(article));
  return card;
};

// ── Article Detail Modal ──────────────────────────────────────────────────────
const openArticleModal = (article) => {
  const overlay = $('#article-modal-overlay');
  const content = $('#article-modal-content');
  const cat = article.category || 'General';
  const catClass = CATEGORY_CLASS[cat] || 'cat-general';

  content.innerHTML = `
    ${article.urlToImage ? `<img class="article-modal-img" src="${article.urlToImage}" alt="" onerror="this.style.display='none'">` : ''}
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
      <span class="card-category ${catClass}" style="font-size:12px;">${cat}</span>
    </div>
    <h2 class="article-modal-title">${article.title}</h2>
    <div class="article-modal-meta">
      <span>📰 ${article.source || 'Unknown'}</span>
      <span>🕒 ${article.publishedAt ? new Date(article.publishedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Recent'}</span>
    </div>
    <p class="article-modal-desc">${article.description || 'No description available.'}</p>
    <div class="article-modal-actions">
      <a href="${article.url}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
        🔗 Read Full Article on ${article.source || 'Source'}
      </a>
      <button class="btn btn-ghost" id="close-article-btn">Close</button>
    </div>
  `;

  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  $('#close-article-btn')?.addEventListener('click', closeArticleModal);
};

const closeArticleModal = () => {
  $('#article-modal-overlay').classList.remove('active');
  document.body.style.overflow = '';
};
$('#article-modal-close')?.addEventListener('click', closeArticleModal);
$('#article-modal-overlay')?.addEventListener('click', (e) => {
  if (e.target === $('#article-modal-overlay')) closeArticleModal();
});

// ── Load Today's News ─────────────────────────────────────────────────────────
const loadTodaysNews = async () => {
  $('#loading-state').classList.remove('hidden');
  $('#content-wrapper').classList.add('hidden');
  $('#error-state').classList.add('hidden');

  try {
    const res = await fetch(`${API_BASE}/news/today`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      localStorage.removeItem('nexbrief_token');
      window.location.replace('/');
      return;
    }

    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    renderDigest(data.digest);
    loadHistory();
  } catch (err) {
    console.error('Load news error:', err);
    $('#loading-state').classList.add('hidden');
    $('#error-state').classList.remove('hidden');
  }
};

// ── Render Digest ─────────────────────────────────────────────────────────────
const renderDigest = (digest) => {
  const itGrid = $('#it-news-grid');
  const eduGrid = $('#edu-news-grid');
  const worldGrid = $('#world-news-grid');

  itGrid.innerHTML = '';
  eduGrid.innerHTML = '';
  worldGrid.innerHTML = '';

  const itList = digest.itNews || [];
  const eduList = digest.educationNews || [];
  const worldList = digest.generalNews || [];

  itList.forEach((a, i) => itGrid.appendChild(renderNewsCard(a, i)));
  eduList.forEach((a, i) => eduGrid.appendChild(renderNewsCard(a, i)));
  worldList.forEach((a, i) => worldGrid.appendChild(renderNewsCard(a, i)));

  // Summary counts
  $('#it-count').textContent = itList.length;
  $('#edu-count').textContent = eduList.length;
  $('#world-count').textContent = worldList.length;
  $('#email-status').textContent = digest.status === 'sent' ? '✓ Sent' : 'Pending';

  // Delivery badge
  const badge = $('#delivery-status');
  if (digest.status === 'sent' && digest.sentAt) {
    badge.textContent = `Sent at ${new Date(digest.sentAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST`;
  } else {
    badge.textContent = 'Next delivery: 7:00 AM IST';
    const el = $('#delivery-badge');
    if (el) { el.style.background = 'rgba(99,102,241,0.1)'; el.style.borderColor = 'rgba(99,102,241,0.2)'; el.style.color = 'var(--color-primary-light)'; }
  }

  // Empty states
  if (!itList.length) itGrid.innerHTML = `<p style="color:var(--color-text-muted);font-size:14px;padding:20px 0;grid-column:1/-1;">No IT news available right now. Try refreshing.</p>`;
  if (!eduList.length) eduGrid.innerHTML = `<p style="color:var(--color-text-muted);font-size:14px;padding:20px 0;grid-column:1/-1;">No education news available today.</p>`;
  if (!worldList.length) worldGrid.innerHTML = `<p style="color:var(--color-text-muted);font-size:14px;padding:20px 0;grid-column:1/-1;">No world headlines available today.</p>`;

  $('#loading-state').classList.add('hidden');
  $('#content-wrapper').classList.remove('hidden');
};

// ── Load History ──────────────────────────────────────────────────────────────
const loadHistory = async () => {
  try {
    const res = await fetch(`${API_BASE}/news/history`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const grid = $('#history-grid');
    grid.innerHTML = '';

    if (!data.success || !data.digests.length) {
      grid.innerHTML = '<p class="history-empty">No past digests yet. Check back after tomorrow\'s 7 AM delivery!</p>';
      return;
    }

    data.digests.forEach(digest => {
      const card = document.createElement('div');
      card.className = 'history-card';
      const dateStr = new Date(digest.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      const total = (digest.itNews?.length || 0) + (digest.educationNews?.length || 0) + (digest.generalNews?.length || 0);
      card.innerHTML = `
        <div class="history-date">${dateStr}</div>
        <div class="history-meta">
          <span>🔴 ${digest.itNews?.length || 0} IT</span>
          <span>📚 ${digest.educationNews?.length || 0} Edu</span>
          <span>🌐 ${digest.generalNews?.length || 0} Other</span>
        </div>
        <div class="history-meta" style="margin-top:6px;">
          <span>📬 ${digest.recipientCount} delivered</span>
          <span class="history-badge">Sent</span>
        </div>
      `;
      card.addEventListener('click', () => {
        fetch(`${API_BASE}/news/digest/${digest.date}`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(d => {
            if (d.success) {
              renderDigest(d.digest);
              $('#page-date').textContent = dateStr + ' (Archive)';
              window.scrollTo({ top: 0, behavior: 'smooth' });
              showToast(`📁 Viewing digest from ${dateStr}`, 'info', 2500);
            }
          });
      });
      grid.appendChild(card);
    });
  } catch (err) { console.error('History error:', err); }
};

// ── Sidebar (mobile) ──────────────────────────────────────────────────────────
const openSidebar = () => { $('#sidebar').classList.add('open'); $('#sidebar-overlay').classList.add('active'); document.body.style.overflow = 'hidden'; };
const closeSidebar = () => { $('#sidebar').classList.remove('open'); $('#sidebar-overlay').classList.remove('active'); document.body.style.overflow = ''; };
$('#hamburger-btn')?.addEventListener('click', openSidebar);
$('#sidebar-close')?.addEventListener('click', closeSidebar);
$('#sidebar-overlay')?.addEventListener('click', closeSidebar);
document.querySelectorAll('.sidebar-link').forEach(l => l.addEventListener('click', closeSidebar));

// ── Logout ────────────────────────────────────────────────────────────────────
$('#logout-btn')?.addEventListener('click', () => {
  localStorage.removeItem('nexbrief_token');
  localStorage.removeItem('nexbrief_user');
  showToast('👋 Signed out. See you tomorrow at 7 AM!', 'info');
  setTimeout(() => window.location.replace('/'), 1200);
});

// ── Subscribe Toggle ──────────────────────────────────────────────────────────
$('#subscribe-toggle-btn')?.addEventListener('click', async () => {
  if (!currentUser) return;
  const endpoint = currentUser.isSubscribed ? 'unsubscribe' : 'resubscribe';
  try {
    const res = await fetch(`${API_BASE}/auth/${endpoint}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) {
      currentUser.isSubscribed = !currentUser.isSubscribed;
      const btn = $('#subscribe-toggle-btn');
      if (currentUser.isSubscribed) {
        btn.textContent = '⏸ Pause Digest';
        btn.className = 'btn btn-ghost btn-sm btn-full';
        showToast('✅ Subscribed! Daily emails resume from tomorrow.', 'success');
      } else {
        btn.textContent = '▶ Resume Digest';
        btn.className = 'btn btn-success btn-sm btn-full';
        showToast('⏸ Digest paused. Resume anytime.', 'info');
      }
    }
  } catch { showToast('Could not update subscription.', 'error'); }
});

// ── Refresh ───────────────────────────────────────────────────────────────────
$('#refresh-btn')?.addEventListener('click', () => {
  showToast('🔄 Fetching latest news...', 'info', 2000);
  loadTodaysNews();
});
$('#retry-btn')?.addEventListener('click', loadTodaysNews);

// ── Date ──────────────────────────────────────────────────────────────────────
$('#page-date').textContent = new Date().toLocaleDateString('en-IN', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
});

// ── Initialize ────────────────────────────────────────────────────────────────
(async () => {
  const user = await verifyAuth();
  if (!user) return;
  setupUserUI(user);
  loadTodaysNews();
})();
