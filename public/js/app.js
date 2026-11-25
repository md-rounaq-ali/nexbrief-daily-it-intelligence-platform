// NexBrief — Landing Page JavaScript
'use strict';

const API_BASE = '/api';

// Stored across registration steps
let regEmail = '';
let regTimerInterval = null;
let forgotEmail = '';
let forgotTimerInterval = null;

// ── Utility ──────────────────────────────────────────────────────────────────
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const showToast = (msg, type = 'info', dur = 4500) => {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), dur);
};

const setLoading = (btn, loading) => {
  btn.disabled = loading;
  btn.querySelector('.btn-text')?.classList.toggle('hidden', loading);
  btn.querySelector('.btn-spinner')?.classList.toggle('hidden', !loading);
};

const showServerError = (id, msg) => {
  const el = $(`#${id}`);
  if (el) { el.textContent = msg; el.classList.add('visible'); }
};
const clearServerError = (id) => {
  const el = $(`#${id}`);
  if (el) { el.textContent = ''; el.classList.remove('visible'); }
};
const showFieldError = (id, msg) => { const el = $(`#${id}`); if (el) el.textContent = msg; };
const clearFieldError = (id) => { const el = $(`#${id}`); if (el) el.textContent = ''; };
const escapeHtml = (str) => {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};
const safeHttpUrl = (url) => {
  if (!url || typeof url !== 'string') return '#';
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : '#';
};

// ── Auth Guard — redirect to dashboard if already logged in ──────────────────
(async () => {
  const token = localStorage.getItem('nexbrief_token');
  if (!token) return;
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { window.location.href = '/dashboard'; }
    else { localStorage.removeItem('nexbrief_token'); localStorage.removeItem('nexbrief_user'); }
  } catch {}
})();

// ── Modal Control ─────────────────────────────────────────────────────────────
const ALL_FORMS = ['register', 'register-otp', 'login', 'forgot-1', 'forgot-2', 'forgot-3'];
const overlay = $('#modal-overlay');
const modalTabs = $('#modal-tabs');

const hideAllForms = () => ALL_FORMS.forEach(f => $(`#form-${f}`)?.classList.add('hidden'));

const showForm = (name) => {
  hideAllForms();
  $(`#form-${name}`)?.classList.remove('hidden');
  // Only show tabs on pure register/login screens
  const showTabs = (name === 'register' || name === 'login');
  if (modalTabs) modalTabs.style.display = showTabs ? 'flex' : 'none';
  $('#tab-register')?.classList.toggle('active', name === 'register');
  $('#tab-login')?.classList.toggle('active', name === 'login');
};

const openModal = (form = 'register') => {
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  showForm(form);
};
const closeModal = () => {
  overlay.classList.remove('active');
  document.body.style.overflow = '';
  clearTimer(regTimerInterval); regTimerInterval = null;
  clearTimer(forgotTimerInterval); forgotTimerInterval = null;
};

overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
$('#modal-close-btn').addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// Open buttons & mobile nav
['#nav-register-btn', '#hero-register-btn', '#footer-register-btn'].forEach(s => $(s)?.addEventListener('click', () => openModal('register')));
['#nav-login-btn', '#hero-login-btn', '#footer-login-btn', '#mobile-login-btn'].forEach(s => $(s)?.addEventListener('click', () => {
  $('#mobile-nav-drawer')?.classList.add('hidden');
  openModal('login');
}));

$('#mobile-nav-toggle')?.addEventListener('click', () => {
  $('#mobile-nav-drawer')?.classList.toggle('hidden');
});
$$('#mobile-nav-drawer a').forEach((link) => {
  link.addEventListener('click', () => $('#mobile-nav-drawer')?.classList.add('hidden'));
});

// Tab & nav links
$('#tab-register')?.addEventListener('click', () => showForm('register'));
$('#tab-login')?.addEventListener('click', () => showForm('login'));
$('#switch-to-login')?.addEventListener('click', () => showForm('login'));
$('#switch-to-register')?.addEventListener('click', () => showForm('register'));
$('#back-to-register-btn')?.addEventListener('click', () => { clearTimer(regTimerInterval); showForm('register'); });

// ── Password Toggle ───────────────────────────────────────────────────────────
const setupToggle = (btnId, inputId) => {
  $(btnId)?.addEventListener('click', () => {
    const inp = $(inputId);
    if (!inp) return;
    const hidden = inp.type === 'password';
    inp.type = hidden ? 'text' : 'password';
    $(btnId).textContent = hidden ? '🙈' : '👁️';
  });
};
setupToggle('#toggle-reg-pw', '#reg-password');
setupToggle('#toggle-login-pw', '#login-password');
setupToggle('#toggle-new-pw', '#new-password');
setupToggle('#toggle-confirm-pw', '#confirm-password');

// ════════════════════════════════════════════════════════════════════════════
// REGISTER — STEP 1: Collect Details → Send OTP
// ════════════════════════════════════════════════════════════════════════════
$('#register-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearServerError('reg-server-error');
  clearFieldError('reg-name-error'); clearFieldError('reg-email-error'); clearFieldError('reg-password-error');

  const name = $('#reg-name').value.trim();
  const email = $('#reg-email').value.trim();
  const password = $('#reg-password').value;

  let valid = true;
  if (!name || name.length < 2) { showFieldError('reg-name-error', 'Name must be at least 2 characters.'); valid = false; }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) { showFieldError('reg-email-error', 'Please enter a valid email address.'); valid = false; }
  if (!password || password.length < 6) { showFieldError('reg-password-error', 'Password must be at least 6 characters.'); valid = false; }
  if (!valid) return;

  const btn = $('#reg-submit-btn');
  setLoading(btn, true);
  try {
    const res = await fetch(`${API_BASE}/auth/initiate-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      if (data.suggestion === 'login') {
        showFieldError('reg-email-error', 'Already registered. Use "Sign In" tab instead.');
        showServerError('reg-server-error', data.message);
      } else {
        showServerError('reg-server-error', data.message || 'Failed to send verification code.');
      }
      return;
    }

    // ✅ OTP sent — move to step 2
    regEmail = email;
    $('#reg-otp-sent-to').textContent = email;
    clearRegOTPBoxes();
    showForm('register-otp');
    clearTimer(regTimerInterval);
    regTimerInterval = startTimer('reg-timer-countdown', 10 * 60, () => {
      showFieldError('reg-otp-error', 'Code expired. Click "Resend Code".');
      $$('.reg-otp-box').forEach(b => b.classList.add('error-box'));
    });
    showToast('📧 Verification code sent! Check your inbox.', 'success');
  } catch {
    showServerError('reg-server-error', 'Network error. Please check your connection.');
  } finally {
    setLoading(btn, false);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// REGISTER — STEP 2: Verify OTP → Create Account
// ════════════════════════════════════════════════════════════════════════════

// OTP box logic for registration
const regOTPBoxes = $$('.reg-otp-box');
setupOTPBoxes(regOTPBoxes, 'reg-otp-error');

$('#reg-otp-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearServerError('reg-otp-server-error');
  clearFieldError('reg-otp-error');

  const otp = Array.from(regOTPBoxes).map(b => b.value).join('');
  if (otp.length !== 6) {
    showFieldError('reg-otp-error', 'Please enter all 6 digits of the verification code.');
    regOTPBoxes.forEach(b => b.classList.add('error-box'));
    return;
  }

  const btn = $('#reg-otp-submit-btn');
  setLoading(btn, true);
  try {
    const res = await fetch(`${API_BASE}/auth/complete-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: regEmail, otp }),
    });
    const data = await res.json();

    if (!res.ok) {
      showFieldError('reg-otp-error', data.message || 'Invalid code.');
      regOTPBoxes.forEach(b => b.classList.add('error-box'));
      return;
    }

    // ✅ Account created!
    clearTimer(regTimerInterval);
    localStorage.setItem('nexbrief_token', data.token);
    localStorage.setItem('nexbrief_user', JSON.stringify(data.user));
    closeModal();
    showToast(`🎉 ${data.message}`, 'success', 5000);
    setTimeout(() => window.location.href = '/dashboard', 1500);
  } catch {
    showServerError('reg-otp-server-error', 'Network error. Please try again.');
  } finally {
    setLoading(btn, false);
  }
});

// Resend registration OTP
$('#reg-resend-otp-btn')?.addEventListener('click', async () => {
  if (!regEmail) return;
  clearRegOTPBoxes();
  clearFieldError('reg-otp-error');
  try {
    await fetch(`${API_BASE}/auth/resend-register-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: regEmail }),
    });
    clearTimer(regTimerInterval);
    regTimerInterval = startTimer('reg-timer-countdown', 10 * 60, () => {
      showFieldError('reg-otp-error', 'Code expired. Click "Resend Code".');
      $$('.reg-otp-box').forEach(b => b.classList.add('error-box'));
    });
    showToast('📧 New code sent! Check your inbox.', 'success');
  } catch {
    showToast('Failed to resend code. Please try again.', 'error');
  }
});

const clearRegOTPBoxes = () => {
  regOTPBoxes.forEach(b => { b.value = ''; b.classList.remove('filled', 'error-box'); });
  clearFieldError('reg-otp-error');
};

// ════════════════════════════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════════════════════════════
$('#login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearServerError('login-server-error');
  clearFieldError('login-email-error'); clearFieldError('login-password-error');

  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;

  let valid = true;
  if (!email) { showFieldError('login-email-error', 'Email is required.'); valid = false; }
  if (!password) { showFieldError('login-password-error', 'Password is required.'); valid = false; }
  if (!valid) return;

  const btn = $('#login-submit-btn');
  setLoading(btn, true);
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      if (data.suggestion === 'register') {
        showFieldError('login-email-error', 'No account found. Please register first.');
        showServerError('login-server-error', data.message);
      } else if (data.suggestion === 'forgot') {
        showFieldError('login-password-error', 'Incorrect password.');
        showServerError('login-server-error', `${data.message} Click "Forgot password?" to reset it.`);
      } else {
        showServerError('login-server-error', data.message || 'Login failed.');
      }
      return;
    }

    localStorage.setItem('nexbrief_token', data.token);
    localStorage.setItem('nexbrief_user', JSON.stringify(data.user));
    closeModal();
    showToast(`✅ ${data.message}`, 'success');
    setTimeout(() => window.location.href = '/dashboard', 1200);
  } catch {
    showServerError('login-server-error', 'Network error. Please check your connection.');
  } finally {
    setLoading(btn, false);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// FORGOT PASSWORD — 3 STEPS
// ════════════════════════════════════════════════════════════════════════════
const forgotOTPBoxes = $$('.otp-box:not(.reg-otp-box)');

$('#forgot-pw-btn')?.addEventListener('click', () => {
  const loginEmail = $('#login-email')?.value.trim();
  if (loginEmail) $('#forgot-email').value = loginEmail;
  showForm('forgot-1');
});
$('#back-to-login-1')?.addEventListener('click', () => showForm('login'));
$('#back-to-forgot-1')?.addEventListener('click', () => { clearTimer(forgotTimerInterval); showForm('forgot-1'); });

// Step 1: Send OTP
$('#forgot-form-1')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearServerError('forgot-1-server-error'); clearFieldError('forgot-email-error');
  const email = $('#forgot-email').value.trim();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) { showFieldError('forgot-email-error', 'Please enter a valid email.'); return; }

  const btn = $('#forgot-1-submit-btn');
  setLoading(btn, true);
  try {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) { showServerError('forgot-1-server-error', data.message); return; }

    forgotEmail = email;
    $('#otp-sent-to').textContent = email;
    clearForgotOTPBoxes();
    showForm('forgot-2');
    clearTimer(forgotTimerInterval);
    forgotTimerInterval = startTimer('timer-countdown', 10 * 60, () => {
      showFieldError('otp-error', 'Code expired. Click "Resend Code".');
      forgotOTPBoxes.forEach(b => b.classList.add('error-box'));
    });
    showToast('📧 Reset code sent! Check your inbox.', 'success');
  } catch { showServerError('forgot-1-server-error', 'Network error.'); }
  finally { setLoading(btn, false); }
});

// Step 2: Verify OTP
setupOTPBoxes(forgotOTPBoxes, 'otp-error');

$('#forgot-form-2')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearServerError('forgot-2-server-error'); clearFieldError('otp-error');
  const otp = Array.from(forgotOTPBoxes).map(b => b.value).join('');
  if (otp.length !== 6) { showFieldError('otp-error', 'Please enter all 6 digits.'); forgotOTPBoxes.forEach(b => b.classList.add('error-box')); return; }

  const btn = $('#forgot-2-submit-btn');
  setLoading(btn, true);
  try {
    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: forgotEmail, otp }),
    });
    const data = await res.json();
    if (!res.ok) { showFieldError('otp-error', data.message || 'Invalid code.'); forgotOTPBoxes.forEach(b => b.classList.add('error-box')); return; }

    clearTimer(forgotTimerInterval);
    showForm('forgot-3');
    showToast('✅ Code verified! Set your new password.', 'success');
  } catch { showServerError('forgot-2-server-error', 'Network error.'); }
  finally { setLoading(btn, false); }
});

$('#resend-otp-btn')?.addEventListener('click', async () => {
  if (!forgotEmail) return;
  clearForgotOTPBoxes();
  try {
    await fetch(`${API_BASE}/auth/forgot-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: forgotEmail }) });
    clearTimer(forgotTimerInterval);
    forgotTimerInterval = startTimer('timer-countdown', 10 * 60, () => {
      showFieldError('otp-error', 'Code expired. Click "Resend Code".');
      forgotOTPBoxes.forEach(b => b.classList.add('error-box'));
    });
    showToast('📧 New code sent!', 'success');
  } catch { showToast('Failed to resend.', 'error'); }
});

// Step 3: Reset Password
$('#forgot-form-3')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearServerError('forgot-3-server-error'); clearFieldError('new-password-error'); clearFieldError('confirm-password-error');
  const newPw = $('#new-password').value;
  const confirmPw = $('#confirm-password').value;
  let valid = true;
  if (!newPw || newPw.length < 6) { showFieldError('new-password-error', 'At least 6 characters required.'); valid = false; }
  if (newPw !== confirmPw) { showFieldError('confirm-password-error', 'Passwords do not match.'); valid = false; }
  if (!valid) return;

  const btn = $('#forgot-3-submit-btn');
  setLoading(btn, true);
  try {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: forgotEmail, newPassword: newPw }),
    });
    const data = await res.json();
    if (!res.ok) { showServerError('forgot-3-server-error', data.message); return; }

    forgotEmail = '';
    showToast('🎉 Password updated! Please sign in.', 'success', 5000);
    showForm('login');
  } catch { showServerError('forgot-3-server-error', 'Network error.'); }
  finally { setLoading(btn, false); }
});

const clearForgotOTPBoxes = () => {
  forgotOTPBoxes.forEach(b => { b.value = ''; b.classList.remove('filled', 'error-box'); });
  clearFieldError('otp-error');
};

// ════════════════════════════════════════════════════════════════════════════
// SHARED: OTP Box Keyboard Logic
// ════════════════════════════════════════════════════════════════════════════
function setupOTPBoxes(boxes, errorId) {
  boxes.forEach((box, idx) => {
    box.addEventListener('input', (e) => {
      const val = e.target.value.replace(/\D/g, '');
      e.target.value = val.slice(-1);
      if (val && idx < boxes.length - 1) boxes[idx + 1].focus();
      boxes.forEach(b => { b.classList.toggle('filled', b.value.length > 0); b.classList.remove('error-box'); });
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && idx > 0) { boxes[idx - 1].focus(); boxes[idx - 1].value = ''; }
      if (e.key === 'ArrowLeft' && idx > 0) boxes[idx - 1].focus();
      if (e.key === 'ArrowRight' && idx < boxes.length - 1) boxes[idx + 1].focus();
    });
    box.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
      pasted.split('').forEach((ch, i) => { if (boxes[i]) boxes[i].value = ch; });
      const nextIdx = Math.min(pasted.length, boxes.length - 1);
      boxes[nextIdx].focus();
      boxes.forEach(b => b.classList.toggle('filled', b.value.length > 0));
    });
  });
}

// ════════════════════════════════════════════════════════════════════════════
// SHARED: Countdown Timer
// ════════════════════════════════════════════════════════════════════════════
function startTimer(elementId, seconds, onExpire) {
  let remaining = seconds;
  const el = $(`#${elementId}`);
  const update = () => {
    const m = Math.floor(remaining / 60).toString().padStart(2, '0');
    const s = (remaining % 60).toString().padStart(2, '0');
    if (el) el.textContent = `${m}:${s}`;
  };
  update();
  const interval = setInterval(() => {
    remaining--;
    update();
    if (remaining <= 0) { clearInterval(interval); if (el) el.textContent = 'Expired'; onExpire?.(); }
  }, 1000);
  return interval;
}

function clearTimer(interval) {
  if (interval) clearInterval(interval);
}

// ── Navbar scroll effect ──────────────────────────────────────────────────────
window.addEventListener('scroll', () => {
  $('#navbar')?.classList.toggle('scrolled', window.scrollY > 40);
});

// ── Footer year ───────────────────────────────────────────────────────────────
const fyEl = $('#footer-year');
if (fyEl) fyEl.textContent = new Date().getFullYear();

// ── FAQ Accordion ─────────────────────────────────────────────────────────────
$$('.faq-question').forEach((btn) => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const wasActive = item.classList.contains('active');
    $$('.faq-item').forEach(i => i.classList.remove('active'));
    if (!wasActive) item.classList.add('active');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// INTERACTIVE SEARCH & LIVE HEADLINES PREVIEW
// ════════════════════════════════════════════════════════════════════════════
let previewArticles = [];

const timeAgoPreview = (dateStr) => {
  if (!dateStr) return 'Recent';
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h > 23) return `${Math.floor(h / 24)}d ago`;
  if (h > 0) return `${h}h ago`;
  return `${Math.max(0, Math.floor(diff / 60000))}m ago`;
};

const renderPreviewCards = (articles) => {
  const grid = $('#live-preview-grid');
  if (!grid) return;
  grid.innerHTML = '';

  if (!articles || articles.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 32px 16px; color: var(--color-text-muted);">
        <p style="font-size: 16px; margin-bottom: 8px;">No matching articles found for your query.</p>
        <p style="font-size: 13px;">Try searching for <strong style="color: #818cf8;">IT news</strong>, <strong style="color: #6ee7b7;">AI</strong>, <strong style="color: #fbbf24;">hiring</strong>, or <strong style="color: #38bdf8;">Md Rounaq Ali</strong>.</p>
      </div>
    `;
    return;
  }

  articles.forEach((art) => {
    const card = document.createElement('div');
    card.className = 'preview-card';
    const artUrl = safeHttpUrl(art.url);
    const imgUrl = safeHttpUrl(art.urlToImage);
    const whyHtml = art.whyItMatters
      ? `<div class="why-matters-box"><span class="why-matters-label">🤖 Why This Matters:</span> <span class="why-matters-text">${escapeHtml(art.whyItMatters)}</span></div>`
      : '';
    card.innerHTML = `
      ${art.urlToImage && imgUrl !== '#' ? `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(art.title)}" class="preview-card-img" loading="lazy" onerror="this.style.display='none'" />` : ''}
      <div class="preview-card-body">
        <div class="preview-card-top">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span class="preview-card-cat">${escapeHtml(art.category || 'IT')}</span>
            ${art.isIndia ? '<span class="preview-india-pill">🇮🇳 India</span>' : ''}
          </div>
          <span class="preview-card-time">${timeAgoPreview(art.publishedAt)}</span>
        </div>
        <h4 class="preview-card-title">${escapeHtml(art.title)}</h4>
        <p class="preview-card-desc">${escapeHtml(art.description || 'Click below to read the full intelligence report.')}</p>
        ${whyHtml}
        <div class="preview-card-footer">
          <span class="preview-card-source">📰 ${escapeHtml(art.source || 'NexBrief Intel')}</span>
          <a href="${escapeHtml(artUrl)}" target="_blank" rel="noopener noreferrer" class="preview-card-link">Read Full ↗</a>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
};

const loadLiveHeadlinesPreview = async () => {
  try {
    const res = await fetch(`${API_BASE}/news/preview`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.success && Array.isArray(data.articles)) {
      previewArticles = data.articles;
      if (data.date) {
        const dateFormatted = new Date(data.date + 'T00:00:00').toLocaleDateString('en-IN', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        });
        const dateEl = $('#live-preview-date');
        if (dateEl) dateEl.textContent = `📅 ${dateFormatted}`;
      }
      renderPreviewCards(previewArticles);
    }
  } catch (err) {
    console.warn('Could not load news preview:', err.message);
  }
};

const executeSearch = (rawQuery) => {
  const query = (rawQuery || '').trim().toLowerCase();
  const clearBtn = $('#search-clear-btn');
  const feedbackEl = $('#search-results-feedback');

  if (clearBtn) clearBtn.classList.toggle('hidden', query.length === 0);

  // Update trending pill active state
  $$('.trend-pill').forEach(pill => {
    const pQuery = (pill.dataset.query || '').toLowerCase();
    pill.classList.toggle('active', query.length > 0 && (query.includes(pQuery) || pQuery.includes(query)));
  });

  if (!query) {
    if (feedbackEl) feedbackEl.classList.add('hidden');
    renderPreviewCards(previewArticles);
    $$('.topic-card').forEach(c => c.style.display = '');
    $$('.faq-item').forEach(i => { i.style.display = ''; i.classList.remove('active'); });
    return;
  }

  // Filter preview articles
  const filteredArticles = previewArticles.filter(art => {
    const text = `${art.title || ''} ${art.description || ''} ${art.category || ''} ${art.source || ''}`.toLowerCase();
    return text.includes(query);
  });
  renderPreviewCards(filteredArticles);

  // Filter topic cards
  let matchingTopics = 0;
  $$('.topic-card').forEach(card => {
    const text = card.textContent.toLowerCase();
    const match = text.includes(query);
    card.style.display = match ? '' : 'none';
    if (match) matchingTopics++;
  });

  // Filter & auto-expand matching FAQs
  let matchingFaqs = 0;
  $$('.faq-item').forEach(item => {
    const text = item.textContent.toLowerCase();
    const match = text.includes(query);
    item.style.display = match ? '' : 'none';
    if (match) {
      matchingFaqs++;
      item.classList.add('active'); // auto open matching FAQ
    } else {
      item.classList.remove('active');
    }
  });

  // Show feedback banner
  if (feedbackEl) {
    const totalFound = filteredArticles.length + matchingTopics + matchingFaqs;
    feedbackEl.innerHTML = `
      <span>🔍 Found <strong>${totalFound}</strong> results matching "<strong>${escapeHtml(rawQuery)}</strong>" (${filteredArticles.length} articles, ${matchingTopics} sectors, ${matchingFaqs} FAQs)</span>
      <button type="button" class="link-btn" id="clear-search-link" style="color:#818cf8;font-weight:600;margin-left:12px;">✕ Reset</button>
    `;
    feedbackEl.classList.remove('hidden');
    $('#clear-search-link')?.addEventListener('click', () => {
      const input = $('#live-search-input');
      if (input) { input.value = ''; input.focus(); }
      executeSearch('');
    });
  }
};

// Setup Search Listeners
const searchInput = $('#live-search-input');
if (searchInput) {
  searchInput.addEventListener('input', (e) => executeSearch(e.target.value));
  $('#search-clear-btn')?.addEventListener('click', () => {
    searchInput.value = '';
    searchInput.focus();
    executeSearch('');
  });
}

// Trending Pills click
$$('.trend-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    const q = pill.dataset.query || '';
    if (searchInput) {
      searchInput.value = q;
      searchInput.focus();
    }
    executeSearch(q);
  });
});

$('#preview-subscribe-btn')?.addEventListener('click', () => openModal('register'));

// Handle URL query parameters: ?q=... (Google Sitelinks Searchbox) and ?auth=register|login
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const authMode = urlParams.get('auth');
  if (authMode === 'register' || authMode === 'login') {
    openModal(authMode);
  }

  loadLiveHeadlinesPreview().then(() => {
    const query = urlParams.get('q') || urlParams.get('search');
    if (query && searchInput) {
      searchInput.value = query;
      executeSearch(query);
      setTimeout(() => {
        $('#search-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    }
  });
});
