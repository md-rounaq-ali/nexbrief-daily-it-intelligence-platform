// NexBrief — Admin Panel JavaScript

const API_BASE = '/api';
const token = localStorage.getItem('nexbrief_token');
let currentFilter = 'all';
let currentPage = 1;

// ── Utility ──────────────────────────────────────────────────────────────────
const $ = (s) => document.querySelector(s);
const showToast = (msg, type = 'info', dur = 4000) => {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), dur);
};

// ── Auth Guard (Admin Only) ───────────────────────────────────────────────────
if (!token) { window.location.replace('/'); }

let currentUser = null;

const verifyAdmin = async () => {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { window.location.replace('/'); return null; }
    const data = await res.json();
    if (!data.user.isAdmin) {
      showToast('Access denied. Admins only.', 'error');
      setTimeout(() => window.location.replace('/dashboard'), 1500);
      return null;
    }
    currentUser = data.user;
    return data.user;
  } catch { window.location.replace('/'); return null; }
};

// ── Tab Navigation ────────────────────────────────────────────────────────────
const tabs = ['overview', 'subscribers', 'digests', 'send'];
const switchAdminTab = (tab) => {
  tabs.forEach(t => {
    $(`#panel-${t}`)?.classList.toggle('active', t === tab);
    $(`#panel-${t}`)?.classList.toggle('hidden', t !== tab);
    $(`#tab-${t}`)?.classList.toggle('active', t === tab);
  });
  if (tab === 'subscribers') loadSubscribers();
  if (tab === 'digests') loadDigests();
};

tabs.forEach(tab => {
  $(`#tab-${tab}`)?.addEventListener('click', () => {
    switchAdminTab(tab);
    closeSidebar(); // close on mobile after tab click
  });
});

// ── Sidebar (mobile) ──────────────────────────────────────────────────────────
const openSidebar  = () => { $('#sidebar')?.classList.add('open'); $('#sidebar-overlay')?.classList.add('active'); document.body.style.overflow = 'hidden'; };
const closeSidebar = () => { $('#sidebar')?.classList.remove('open'); $('#sidebar-overlay')?.classList.remove('active'); document.body.style.overflow = ''; };
$('#admin-hamburger')?.addEventListener('click', openSidebar);
$('#sidebar-close')?.addEventListener('click', closeSidebar);
$('#sidebar-overlay')?.addEventListener('click', closeSidebar);


// ── Load Stats ────────────────────────────────────────────────────────────────
const loadStats = async () => {
  try {
    const res = await fetch(`${API_BASE}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!data.success) return;
    const { stats } = data;

    $('#stat-total-users').textContent = stats.totalUsers;
    $('#stat-subscribed').textContent = stats.subscribedUsers;
    $('#stat-digests').textContent = stats.totalDigests;
    $('#stat-unsubscribed').textContent = stats.unsubscribedUsers;

    // Today status
    const todayIcon = $('#today-icon');
    const todayTitle = $('#today-title');
    const todaySub = $('#today-sub');
    if (stats.sentToday) {
      todayIcon.textContent = '✅';
      todayTitle.textContent = "Today's digest has been sent!";
      todaySub.textContent = 'All active subscribers received their morning briefing.';
      $('#today-status').style.borderColor = 'rgba(16,185,129,0.3)';
      $('#trigger-warning').classList.remove('hidden');
    } else {
      todayIcon.textContent = '⏳';
      todayTitle.textContent = "Today's digest is pending.";
      todaySub.textContent = 'Scheduled for 7:00 AM IST. You can also trigger it manually.';
    }

    // Recent digests table
    const tbody = $('#recent-digests-body');
    tbody.innerHTML = '';
    if (stats.recentDigests.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--color-text-muted);padding:24px;">No digests sent yet.</td></tr>';
      return;
    }
    stats.recentDigests.forEach(d => {
      const tr = document.createElement('tr');
      const dateStr = new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
      const sentAt = d.sentAt ? new Date(d.sentAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
      tr.innerHTML = `
        <td style="font-weight:600;">${dateStr}</td>
        <td><span class="status-badge status-sent">✓ Sent</span></td>
        <td>${d.recipientCount} subscribers</td>
        <td>${sentAt}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) { console.error(err); }
};

// ── Load Subscribers ──────────────────────────────────────────────────────────
const loadSubscribers = async (page = 1) => {
  currentPage = page;
  const tbody = $('#subscribers-body');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:24px;">Loading...</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/admin/subscribers?page=${page}&limit=15&filter=${currentFilter}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.success) return;

    tbody.innerHTML = '';
    if (data.users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:24px;">No users found.</td></tr>';
      return;
    }

    data.users.forEach(user => {
      const tr = document.createElement('tr');
      const joinedDate = new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
      const statusClass = user.isSubscribed ? 'status-subscribed' : 'status-paused';
      const statusText = user.isSubscribed ? '✓ Active' : '⏸ Paused';
      const isMainAdmin = user.email === 'tabrasali7@gmail.com';
      tr.innerHTML = `
        <td style="font-weight:600;">${escapeHtml(user.name)} ${user.isAdmin ? '<span class="status-badge status-admin">Admin</span>' : ''}</td>
        <td style="color:var(--color-text-muted);">${escapeHtml(user.email)}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td>${user.digestsReceived}</td>
        <td>${joinedDate}</td>
        <td style="white-space: nowrap;">
          ${isMainAdmin ? `
            <button class="action-icon-btn admin-toggle active" style="opacity: 0.35; cursor: not-allowed;" disabled title="Main Administrator (Protected)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            </button>
            <button class="action-icon-btn delete" style="opacity: 0.35; cursor: not-allowed;" disabled title="Main Administrator (Protected)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
          ` : `
            <button class="action-icon-btn admin-toggle ${user.isAdmin ? 'active' : ''}" 
                    ${currentUser && currentUser.email === 'tabrasali7@gmail.com' ? `onclick="toggleAdmin('${user._id}', this)"` : `style="opacity: 0.35; cursor: not-allowed;" disabled`} 
                    title="${currentUser && currentUser.email === 'tabrasali7@gmail.com' ? (user.isAdmin ? 'Revoke Admin Status' : 'Grant Admin Status') : 'Only the main administrator can modify admin privileges'}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            </button>
            <button class="action-icon-btn delete" onclick="deleteUser('${user._id}', this)" title="Delete User Permanently">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
          `}
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Pagination
    const { totalPages, page: curPage } = data.pagination;
    const pagination = $('#pagination');
    pagination.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement('button');
      btn.className = `page-btn ${i === curPage ? 'active' : ''}`;
      btn.textContent = i;
      btn.addEventListener('click', () => loadSubscribers(i));
      pagination.appendChild(btn);
    }
  } catch (err) { console.error(err); }
};

// ── Load Digests ──────────────────────────────────────────────────────────────
const loadDigests = async () => {
  const tbody = $('#digests-body');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:24px;">Loading...</td></tr>';
  try {
    const res = await fetch(`${API_BASE}/admin/digests`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    tbody.innerHTML = '';
    if (!data.digests.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:24px;">No digests recorded yet.</td></tr>';
      return;
    }
    data.digests.forEach(d => {
      const tr = document.createElement('tr');
      const dateStr = new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      const statusMap = { sent: 'status-sent', draft: 'status-draft', failed: 'status-failed' };
      const statusLabel = { sent: '✓ Sent', draft: '⏳ Draft', failed: '✗ Failed' };
      const sentAt = d.sentAt ? new Date(d.sentAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—';
      tr.innerHTML = `
        <td style="font-weight:600;">${dateStr}</td>
        <td><span class="status-badge ${statusMap[d.status] || 'status-draft'}">${statusLabel[d.status] || d.status}</span></td>
        <td>${d.recipientCount || 0}</td>
        <td style="text-transform:capitalize;">${d.triggerSource || '—'}</td>
        <td style="color:var(--color-text-muted);font-size:13px;">${sentAt}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) { console.error(err); }
};

// ── Admin Actions ─────────────────────────────────────────────────────────────
window.toggleAdmin = async (userId, btn) => {
  try {
    const res = await fetch(`${API_BASE}/admin/users/${userId}/toggle-admin`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      loadSubscribers(currentPage);
    } else {
      showToast(data.message, 'error');
    }
  } catch { showToast('Action failed.', 'error'); }
};

window.deleteUser = async (userId, btn) => {
  if (!confirm('Are you sure you want to permanently delete this user?')) return;
  try {
    const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) {
      showToast('✅ User deleted.', 'success');
      loadSubscribers(currentPage);
      loadStats();
    } else {
      showToast(data.message, 'error');
    }
  } catch { showToast('Delete failed.', 'error'); }
};

// ── Filter Buttons ────────────────────────────────────────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    loadSubscribers(1);
  });
});

// ── Trigger Digest ────────────────────────────────────────────────────────────
$('#trigger-digest-btn')?.addEventListener('click', async () => {
  const btn = $('#trigger-digest-btn');
  const result = $('#trigger-result');
  btn.disabled = true;
  result.className = 'send-result';

  try {
    // Step 1: Wake up the Render server first (free tier sleeps after 15 min)
    btn.textContent = '⏳ Waking up server...';
    result.textContent = '🔄 Starting server (this may take up to 60 seconds on free hosting)...';
    try {
      await fetch(`${API_BASE}/health`, { method: 'GET' });
    } catch (e) { /* ignore wake-up errors */ }

    // Step 2: Wait 5 seconds for server to fully initialize
    await new Promise(r => setTimeout(r, 5000));

    // Step 3: Send the digest
    btn.textContent = '📧 Sending digest...';
    result.textContent = '📬 Fetching news and sending emails...';

    // Use AbortController for 120 second timeout (Render cold start can be slow)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    const res = await fetch(`${API_BASE}/newsletter/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await res.json();
    if (data.success) {
      if (data.status === 'skipped') {
        result.textContent = `⚠️ Skipped: ${data.reason || 'Already sent today.'}`;
      } else if (data.status === 'sent') {
        result.textContent = `✅ Digest sent! ${data.sentTo} emails delivered, ${data.failed} failed.`;
        loadStats();
      } else {
        result.textContent = `❌ Send failed. Check your Brevo API key.`;
        result.className = 'send-result error-text';
      }
    } else {
      result.textContent = `❌ Error: ${data.message}`;
      result.className = 'send-result error-text';
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      result.textContent = '⏰ Request timed out. Render server may still be waking up. Wait 1 minute and try again.';
    } else {
      result.textContent = '❌ Network error. Check your internet connection and try again.';
    }
    result.className = 'send-result error-text';
  } finally {
    btn.disabled = false;
    btn.textContent = '🚀 Send Now to All Subscribers';
  }
});

// ── Send Test Email ───────────────────────────────────────────────────────────
$('#send-test-btn')?.addEventListener('click', async () => {
  const email = $('#test-email-input').value.trim();
  const result = $('#test-result');
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    result.textContent = '⚠️ Please enter a valid email address.';
    result.className = 'send-result error-text';
    return;
  }
  result.textContent = '⏳ Sending...';
  result.className = 'send-result';
  try {
    const res = await fetch(`${API_BASE}/newsletter/test-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ toEmail: email }),
    });
    const data = await res.json();
    if (data.success) {
      result.textContent = `✅ Test email sent to ${email}!`;
    } else {
      result.textContent = `❌ Error: ${data.message}`;
      result.className = 'send-result error-text';
    }
  } catch {
    result.textContent = '❌ Network error.';
    result.className = 'send-result error-text';
  }
});

// ── Logout ────────────────────────────────────────────────────────────────────
$('#admin-logout-btn')?.addEventListener('click', () => {
  localStorage.removeItem('nexbrief_token');
  localStorage.removeItem('nexbrief_user');
  window.location.replace('/');
});

// ── Escape HTML ───────────────────────────────────────────────────────────────
const escapeHtml = (str) => String(str).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ── Initialize ────────────────────────────────────────────────────────────────
(async () => {
  const user = await verifyAdmin();
  if (!user) return;

  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  $('#admin-avatar').textContent = initials;
  $('#admin-name').textContent = user.name;
  $('#admin-date').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Prefill test email with admin's email
  if ($('#test-email-input')) $('#test-email-input').value = user.email;

  loadStats();
})();
