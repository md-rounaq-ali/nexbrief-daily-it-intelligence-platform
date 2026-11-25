const fetch = require('node-fetch');
const { cleanNewsText, buildSmartFallbackInsight } = require('./aiService');

// Brevo API Key
const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.BREVO_SMTP_PASS;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

// Category badge colors for email
const categoryColors = {
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

const escapeHtmlEmail = (str = '') =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Core helper to send email via Brevo Transactional HTTP API (runs over Port 443 / HTTPS)
 * This bypasses ISP SMTP blocks on ports 587 and 465.
 */
const sendEmailViaAPI = async ({ toEmail, toName, subject, htmlContent }) => {
  try {
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: process.env.FROM_NAME || 'NexBrief Daily',
          email: process.env.FROM_EMAIL,
        },
        to: [
          {
            email: toEmail,
            name: toName || toEmail.split('@')[0],
          },
        ],
        subject,
        htmlContent,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Brevo API returned status ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`❌ Brevo API Send Failure to ${toEmail}:`, error.message);
    throw error;
  }
};

/**
 * Ensures an email is unblocked on Brevo Transactional Blocklist.
 */
const unblockEmailIfBlocked = async (email) => {
  if (!email || !BREVO_API_KEY) return;
  try {
    const res = await fetch(`https://api.brevo.com/v3/smtp/blockedContacts/${encodeURIComponent(email.toLowerCase().trim())}`, {
      method: 'DELETE',
      headers: {
        'api-key': BREVO_API_KEY,
        accept: 'application/json',
      },
    });
    if (res.status === 204) {
      console.log(`🔓 Auto-unblocked ${email} from Brevo transactional blocklist.`);
    }
  } catch (err) {
    // Non-blocking
  }
};

// ─── Daily Digest Email Template ──────────────────────────────────────────────
const formatDescriptionToBullets = (desc) => {
  const cleaned = cleanNewsText(desc);
  if (!cleaned) return '';

  const rawParts = cleaned.split(/\.\s+/);
  const sentences = [];
  let currentSentence = '';

  for (let i = 0; i < rawParts.length; i++) {
    const part = rawParts[i].trim();
    if (!part) continue;

    currentSentence = currentSentence ? `${currentSentence}. ${part}` : part;

    const words = part.split(/\s+/);
    const lastWord = words[words.length - 1].replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');
    const isAbbreviation = ['us', 'mr', 'ms', 'dr', 'prof', 'tech', 'inc', 'ltd', 'vs', 'btech', 'mtech', 'ai'].includes(lastWord.toLowerCase());

    if (!isAbbreviation || i === rawParts.length - 1) {
      sentences.push(currentSentence.endsWith('.') ? currentSentence : `${currentSentence}.`);
      currentSentence = '';
    }
  }

  return `
    <ul style="margin:0 0 12px 0;padding-left:20px;color:#94a3b8;font-size:13px;line-height:1.6;">
      ${sentences.map((s) => `<li style="margin-bottom:5px;">${escapeHtmlEmail(s)}</li>`).join('')}
    </ul>
  `;
};

const buildDigestEmailHtml = (user, digest, dateStr, { isTest = false } = {}) => {
  const appBase = (process.env.APP_URL || 'https://nexbrief-news.onrender.com').replace(/\/$/, '');
  const trackingUrl = `${appBase}/api/track/open?digestId=${encodeURIComponent(digest?._id || '')}&date=${encodeURIComponent(digest?.date || '')}&userId=${encodeURIComponent(user?._id || '')}${isTest ? '&test=1' : ''}`;
  const archiveUrl = digest?.date ? `${appBase}/archive/${digest.date}` : `${appBase}/archive`;

  const renderCards = (articles) =>
    (articles || [])
      .map((a) => {
        const why = a.whyItMatters || buildSmartFallbackInsight(a);
        const indiaBadge = a.isIndia
          ? '<span style="display:inline-block;background:rgba(16,185,129,0.16);border:1px solid rgba(16,185,129,0.35);color:#6ee7b7;font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px;margin-left:6px;">🇮🇳 INDIA</span>'
          : '';
        return `
    <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:16px;">
      <div style="margin-bottom:10px;">
        <span style="display:inline-block;background:${categoryColors[a.category] || '#6366f1'};color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:0.5px;text-transform:uppercase;">${escapeHtmlEmail(a.category || 'IT')}</span>${indiaBadge}
      </div>
      <h3 style="color:#f1f5f9;font-size:15px;font-weight:700;margin:0 0 8px 0;line-height:1.4;">${escapeHtmlEmail(a.title)}</h3>
      ${formatDescriptionToBullets(a.description)}
      <div style="background:rgba(99,102,241,0.1);border-left:3px solid #818cf8;border-radius:6px;padding:8px 12px;margin-bottom:12px;">
        <span style="color:#a5b4fc;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.4px;">💡 Why This Matters:</span>
        <span style="color:#e2e8f0;font-size:12px;line-height:1.5;display:block;margin-top:2px;">${escapeHtmlEmail(why)}</span>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#64748b;font-size:12px;">📰 ${escapeHtmlEmail(a.source || 'News Source')} &nbsp;·&nbsp; ${new Date(a.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
          <td align="right"><a href="${escapeHtmlEmail(a.url)}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:12px;font-weight:600;padding:6px 16px;border-radius:8px;text-decoration:none;" target="_blank">Read More →</a></td>
        </tr>
      </table>
    </div>`;
      })
      .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>NexBrief Daily</title></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;">
    <tr><td align="center" style="padding:30px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#1e1b4b 100%);border-radius:20px 20px 0 0;padding:36px 32px;text-align:center;">
          <div style="font-size:28px;font-weight:900;color:#fff;letter-spacing:-1px;"><span style="color:#818cf8;">Nex</span>Brief</div>
          <div style="color:#c7d2fe;font-size:12px;margin-top:4px;letter-spacing:2px;text-transform:uppercase;">Daily Intelligence Digest</div>
          <div style="background:rgba(255,255,255,0.1);border-radius:8px;padding:10px 20px;display:inline-block;margin-top:16px;">
            <span style="color:#e2e8f0;font-size:14px;">📅 ${escapeHtmlEmail(dateStr)} &nbsp;·&nbsp; Good Morning, ${escapeHtmlEmail((user.name || 'Engineer').split(' ')[0])}! ☀️</span>
          </div>
        </td></tr>
        <tr><td style="background:#0f172a;padding:22px 32px 8px;">
          <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0;">Here's your personalized daily briefing — <strong style="color:#818cf8;">50% IT &amp; Jobs</strong>, <strong style="color:#f59e0b;">30% Education &amp; Research</strong>, <strong style="color:#64748b;">20% World News</strong>. Curated India-first for engineering students and IT professionals.</p>
        </td></tr>
        <tr><td style="background:#0f172a;padding:20px 32px 8px;">
          <div style="border-left:4px solid #6366f1;padding-left:14px;margin-bottom:18px;">
            <h2 style="color:#f1f5f9;font-size:18px;font-weight:800;margin:0 0 3px 0;">🔴 IT, Tech Jobs &amp; AI <span style="font-size:13px;color:#64748b;font-weight:400;">(50%)</span></h2>
            <p style="color:#64748b;font-size:12px;margin:0;">Hiring · Internships · AI · Cybersecurity · Cloud · Dev Tools</p>
          </div>
          ${renderCards(digest.itNews) || '<p style="color:#64748b;font-size:14px;">No IT news today.</p>'}
        </td></tr>
        <tr><td style="background:#0f172a;padding:16px 32px 8px;">
          <hr style="border:none;border-top:1px solid #1e293b;margin:0 0 20px 0;">
          <div style="border-left:4px solid #f59e0b;padding-left:14px;margin-bottom:18px;">
            <h2 style="color:#f1f5f9;font-size:18px;font-weight:800;margin:0 0 3px 0;">📚 Education &amp; Research <span style="font-size:13px;color:#64748b;font-weight:400;">(30%)</span></h2>
            <p style="color:#64748b;font-size:12px;margin:0;">GATE · Campus Placements · IIT/NIT · Science &amp; Space</p>
          </div>
          ${renderCards(digest.educationNews) || '<p style="color:#64748b;font-size:14px;">No education news today.</p>'}
        </td></tr>
        <tr><td style="background:#0f172a;padding:16px 32px 8px;">
          <hr style="border:none;border-top:1px solid #1e293b;margin:0 0 20px 0;">
          <div style="border-left:4px solid #10b981;padding-left:14px;margin-bottom:18px;">
            <h2 style="color:#f1f5f9;font-size:18px;font-weight:800;margin:0 0 3px 0;">🌐 World Headlines <span style="font-size:13px;color:#64748b;font-weight:400;">(20%)</span></h2>
            <p style="color:#64748b;font-size:12px;margin:0;">Startups · Economy · Global Tech Policy</p>
          </div>
          ${renderCards(digest.generalNews) || '<p style="color:#64748b;font-size:14px;">No world news today.</p>'}
        </td></tr>
        <tr><td style="background:#0f172a;border-radius:0 0 20px 20px;padding:28px 32px;text-align:center;border-top:1px solid #1e293b;">
          <div style="margin-bottom:18px;">
            <a href="${appBase}/dashboard" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;font-size:14px;font-weight:700;padding:12px 24px;border-radius:10px;text-decoration:none;display:inline-block;margin:4px;letter-spacing:0.3px;">🖥️ Open Full Dashboard</a>
            <a href="${archiveUrl}" style="background:#1e293b;border:1px solid #334155;color:#e2e8f0;font-size:14px;font-weight:600;padding:11px 20px;border-radius:10px;text-decoration:none;display:inline-block;margin:4px;">🌐 View Web Edition</a>
          </div>
          <p style="color:#64748b;font-size:12px;margin:0 0 16px 0;line-height:1.6;">
            You're subscribed to <strong style="color:#818cf8;">NexBrief Daily</strong> · Delivered every morning at <strong>7:00 AM IST</strong>
          </p>
          <div style="border-top:1px solid #1e293b;padding-top:16px;">
            <p style="color:#94a3b8;font-size:12px;margin:0 0 10px 0;line-height:1.6;">
              © ${new Date().getFullYear()} NexBrief. All rights reserved. Developed by <a href="https://md-rounaq-ali.netlify.app/" target="_blank" style="color:#818cf8;text-decoration:underline;font-weight:600;">Md Rounaq Ali</a> for India's engineers.
            </p>
            <p style="color:#64748b;font-size:12px;margin:0;line-height:1.6;">
              Search Creator on Google: &nbsp;<a href="https://www.google.com/search?q=md+rounaq+ali" target="_blank" style="display:inline-block;padding:4px 14px;background:#0f2942;border:1px solid #0284c7;border-radius:20px;color:#38bdf8;font-size:12px;font-weight:600;text-decoration:none;">md rounaq ali ↗</a>
            </p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
  <img src="${trackingUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;opacity:0;" />
</body></html>`;
};

// ─── Registration Email Verification OTP (green theme) ───────────────────────
const buildRegistrationOTPHtml = (name, email, otp) => {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>NexBrief — Verify Your Email</title></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#064e3b,#065f46);border-radius:20px 20px 0 0;padding:32px;text-align:center;">
            <div style="font-size:26px;font-weight:900;color:#fff;letter-spacing:-1px;margin-bottom:4px;"><span style="color:#6ee7b7;">Nex</span>Brief</div>
            <div style="font-size:13px;color:#a7f3d0;letter-spacing:1px;text-transform:uppercase;">Email Verification</div>
            <div style="font-size:40px;margin-top:16px;">✉️</div>
          </td>
        </tr>
        <tr>
          <td style="background:#0f172a;border-radius:0 0 20px 20px;padding:32px;">
            <p style="color:#f1f5f9;font-size:16px;font-weight:700;margin:0 0 6px 0;">Hi ${escapeHtmlEmail(name.split(' ')[0])}, almost there! 👋</p>
            <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 8px 0;">
              You're registering <strong style="color:#6ee7b7;">${escapeHtmlEmail(email)}</strong> on NexBrief.
            </p>
            <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 24px 0;">
              Enter the 6-digit code below to verify your email and complete your registration. The code expires in <strong style="color:#f1f5f9;">10 minutes</strong>.
            </p>
            <div style="background:#1e293b;border:2px dashed #10b981;border-radius:16px;padding:28px;text-align:center;margin-bottom:24px;">
              <div style="color:#94a3b8;font-size:13px;margin-bottom:10px;letter-spacing:1px;text-transform:uppercase;">Your Registration Code</div>
              <div style="font-size:48px;font-weight:900;letter-spacing:12px;color:#6ee7b7;font-family:monospace;">${otp}</div>
              <div style="color:#64748b;font-size:12px;margin-top:10px;">⏰ Valid for 10 minutes only</div>
            </div>
            <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:14px;margin-bottom:20px;">
              <p style="color:#6ee7b7;font-size:13px;margin:0;">🔒 <strong>Security:</strong> If you did not try to register on NexBrief, ignore this email. No account has been created yet.</p>
            </div>
            <div style="border-top:1px solid #1e293b;margin-top:20px;padding-top:16px;text-align:center;">
              <p style="color:#94a3b8;font-size:12px;margin:0 0 10px 0;line-height:1.6;">
                © ${new Date().getFullYear()} NexBrief. All rights reserved. Developed by <a href="https://md-rounaq-ali.netlify.app/" target="_blank" style="color:#6ee7b7;text-decoration:underline;font-weight:600;">Md Rounaq Ali</a> for India's engineers.
              </p>
              <p style="color:#64748b;font-size:12px;margin:0;line-height:1.6;">
                Search Creator on Google: &nbsp;<a href="https://www.google.com/search?q=md+rounaq+ali" target="_blank" style="display:inline-block;padding:4px 14px;background:#0f2942;border:1px solid #0284c7;border-radius:20px;color:#38bdf8;font-size:12px;font-weight:600;text-decoration:none;">md rounaq ali ↗</a>
              </p>
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
};

// ─── Password Reset OTP (purple theme) ───────────────────────────────────────
const buildOTPEmailHtml = (user, otp) => {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>NexBrief — Password Reset Code</title></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#1e1b4b,#312e81);border-radius:20px 20px 0 0;padding:32px;text-align:center;">
            <div style="font-size:26px;font-weight:900;color:#fff;letter-spacing:-1px;margin-bottom:4px;"><span style="color:#818cf8;">Nex</span>Brief</div>
            <div style="font-size:13px;color:#c7d2fe;letter-spacing:1px;text-transform:uppercase;">Password Reset</div>
            <div style="font-size:40px;margin-top:16px;">🔐</div>
          </td>
        </tr>
        <tr>
          <td style="background:#0f172a;border-radius:0 0 20px 20px;padding:32px;">
            <p style="color:#f1f5f9;font-size:16px;font-weight:600;margin:0 0 8px 0;">Hi ${escapeHtmlEmail(user.name.split(' ')[0])},</p>
            <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 24px 0;">We received a request to reset your NexBrief password. Use the code below — valid for <strong style="color:#f1f5f9;">10 minutes</strong>.</p>
            <div style="background:#1e293b;border:2px dashed #6366f1;border-radius:16px;padding:28px;text-align:center;margin-bottom:24px;">
              <div style="color:#94a3b8;font-size:13px;margin-bottom:10px;letter-spacing:1px;text-transform:uppercase;">Your Reset Code</div>
              <div style="font-size:48px;font-weight:900;letter-spacing:12px;color:#818cf8;font-family:monospace;">${otp}</div>
              <div style="color:#64748b;font-size:12px;margin-top:10px;">⏰ Expires in 10 minutes</div>
            </div>
            <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 20px 0;">If you didn't request this, safely ignore this email. Your password will not change.</p>
            <div style="border-top:1px solid #1e293b;margin-top:20px;padding-top:16px;text-align:center;">
              <p style="color:#94a3b8;font-size:12px;margin:0 0 10px 0;line-height:1.6;">
                © ${new Date().getFullYear()} NexBrief. All rights reserved. Developed by <a href="https://md-rounaq-ali.netlify.app/" target="_blank" style="color:#818cf8;text-decoration:underline;font-weight:600;">Md Rounaq Ali</a> for India's engineers.
              </p>
              <p style="color:#64748b;font-size:12px;margin:0;line-height:1.6;">
                Search Creator on Google: &nbsp;<a href="https://www.google.com/search?q=md+rounaq+ali" target="_blank" style="display:inline-block;padding:4px 14px;background:#0f2942;border:1px solid #0284c7;border-radius:20px;color:#38bdf8;font-size:12px;font-weight:600;text-decoration:none;">md rounaq ali ↗</a>
              </p>
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
};

// ─── Welcome Email ────────────────────────────────────────────────────────────
const buildWelcomeEmailHtml = (user) => {
  const appBase = (process.env.APP_URL || 'https://nexbrief-news.onrender.com').replace(/\/$/, '');
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Welcome to NexBrief!</title></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#1e1b4b,#312e81);border-radius:20px 20px 0 0;padding:36px 32px;text-align:center;">
            <div style="font-size:30px;font-weight:900;color:#fff;letter-spacing:-1px;margin-bottom:6px;"><span style="color:#818cf8;">Nex</span>Brief</div>
            <div style="color:#c7d2fe;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Welcome Aboard!</div>
            <div style="font-size:50px;margin-top:16px;">🎉</div>
          </td>
        </tr>
        <tr>
          <td style="background:#0f172a;border-radius:0 0 20px 20px;padding:32px;">
            <h2 style="color:#f1f5f9;font-size:20px;font-weight:700;margin:0 0 12px 0;">Hello, ${escapeHtmlEmail(user.name)}! 👋</h2>
            <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 20px 0;">You've successfully joined <strong style="color:#818cf8;">NexBrief</strong> — India's dedicated daily intelligence platform for <strong style="color:#f1f5f9;">IT professionals and engineering students</strong>. Every morning at <strong style="color:#fff;">7:00 AM IST</strong>, you'll receive:</p>
            <div style="background:#1e293b;border-radius:14px;padding:20px;margin-bottom:22px;">
              <p style="color:#f1f5f9;font-size:14px;margin:0 0 10px 0;">🔴 <strong>50% IT, Jobs &amp; AI</strong> — Hiring, Internships, Frameworks, Cybersecurity</p>
              <p style="color:#f1f5f9;font-size:14px;margin:0 0 10px 0;">📚 <strong>30% Education &amp; Research</strong> — GATE, Campus Placements, IIT/NIT, ISRO</p>
              <p style="color:#f1f5f9;font-size:14px;margin:0 0 10px 0;">🌐 <strong>20% World Headlines</strong> — Startups, Economy &amp; Global Tech Policy</p>
              <p style="color:#a5b4fc;font-size:13px;margin:0;">🤖 <strong>Plus:</strong> AI "Why This Matters" summary on every headline</p>
            </div>
            <div style="text-align:center;margin-bottom:22px;">
              <a href="${appBase}/dashboard" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:15px;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none;display:inline-block;">🚀 Go to Your Dashboard</a>
            </div>
            <div style="border-top:1px solid #1e293b;margin-top:20px;padding-top:16px;text-align:center;">
              <p style="color:#94a3b8;font-size:12px;margin:0 0 10px 0;line-height:1.6;">
                © ${new Date().getFullYear()} NexBrief. All rights reserved. Developed by <a href="https://md-rounaq-ali.netlify.app/" target="_blank" style="color:#818cf8;text-decoration:underline;font-weight:600;">Md Rounaq Ali</a> for India's engineers.
              </p>
              <p style="color:#64748b;font-size:12px;margin:0;line-height:1.6;">
                Search Creator on Google: &nbsp;<a href="https://www.google.com/search?q=md+rounaq+ali" target="_blank" style="display:inline-block;padding:4px 14px;background:#0f2942;border:1px solid #0284c7;border-radius:20px;color:#38bdf8;font-size:12px;font-weight:600;text-decoration:none;">md rounaq ali ↗</a>
              </p>
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
};

// ─── Send Functions ───────────────────────────────────────────────────────────
const sendWelcomeEmail = async (user) => {
  await sendEmailViaAPI({
    toEmail: user.email,
    toName: user.name,
    subject: `🎉 Welcome to NexBrief, ${user.name.split(' ')[0]}!`,
    htmlContent: buildWelcomeEmailHtml(user),
  });
  console.log(`✅ Welcome email sent via API → ${user.email}`);
};

const sendRegistrationOTPEmail = async (name, email, otp) => {
  await unblockEmailIfBlocked(email);
  await sendEmailViaAPI({
    toEmail: email,
    toName: name,
    subject: `✉️ NexBrief — Verify Your Email: ${otp}`,
    htmlContent: buildRegistrationOTPHtml(name, email, otp),
  });
  console.log(`✅ Registration OTP sent via API → ${email}`);
};

const sendOTPEmail = async (user, otp) => {
  await unblockEmailIfBlocked(user.email);
  await sendEmailViaAPI({
    toEmail: user.email,
    toName: user.name,
    subject: `🔐 NexBrief — Your Password Reset Code: ${otp}`,
    htmlContent: buildOTPEmailHtml(user, otp),
  });
  console.log(`✅ Password reset OTP sent via API → ${user.email}`);
};

const sendDailyDigest = async (digest, subscribers) => {
  const dateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  let successCount = 0;
  let failCount = 0;

  for (const user of subscribers) {
    try {
      await sendEmailViaAPI({
        toEmail: user.email,
        toName: user.name,
        subject: `📰 NexBrief Daily — ${dateStr}`,
        htmlContent: buildDigestEmailHtml(user, digest, dateStr, { isTest: false }),
      });
      successCount++;
    } catch (err) {
      console.error(`❌ Email failed to send via API → ${user.email}:`, err.message);
      failCount++;
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`📧 API Digest Send Report: ${successCount} sent, ${failCount} failed`);
  return { successCount, failCount };
};

const sendTestEmail = async (toEmail, digest) => {
  const dateStr = `[TEST] ${new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Kolkata',
  })}`;
  await sendEmailViaAPI({
    toEmail,
    toName: 'Admin',
    subject: `[TEST] NexBrief Daily`,
    htmlContent: buildDigestEmailHtml({ name: 'Admin', email: toEmail }, digest, dateStr, { isTest: true }),
  });
  console.log(`✅ Test digest email sent via API → ${toEmail}`);
};

// ─── Product Update Announcement Email (NexBrief 2.0 Executive Release Note) ─
const buildProductUpdateEmailHtml = (user, { isTest = false } = {}) => {
  const firstName = escapeHtmlEmail((user?.name || 'Engineer').split(' ')[0]);
  const appBase = (
    process.env.PUBLIC_APP_URL ||
    (process.env.APP_URL && !process.env.APP_URL.includes('localhost') ? process.env.APP_URL : null) ||
    'https://nexbrief-news.onrender.com'
  ).replace(/\/$/, '');

  const features = [
    {
      num: '01',
      tag: 'INDIA-FIRST CURATION',
      tagColor: '#34d399',
      tagBg: 'rgba(16,185,129,0.12)',
      title: '60% India · 40% Global Signal Ratio',
      desc: 'Prioritizes Indian IT hiring, internships, off-campus drives (TCS, Infosys, Wipro, HCL, GCCs), GATE/AICTE &amp; IIT/NIT updates — filtering out off-topic gaming and clickbait.',
    },
    {
      num: '02',
      tag: 'GEMINI AI INSIGHTS',
      tagColor: '#a5b4fc',
      tagBg: 'rgba(99,102,241,0.14)',
      title: '1-Line "Why This Matters" on Every Story',
      desc: 'Every article now pairs the headline with a concise AI takeaway highlighting interview value, skill impact, or application urgency.',
    },
    {
      num: '03',
      tag: 'PUBLIC WEB ARCHIVE',
      tagColor: '#38bdf8',
      tagBg: 'rgba(56,189,248,0.12)',
      title: 'Searchable Archive at /archive',
      desc: 'Revisit any past morning edition directly on the web with full section breakdowns, category filtering, and clean mobile reading.',
    },
    {
      num: '04',
      tag: 'PWA &amp; PUSH ALERTS',
      tagColor: '#c4b5fd',
      tagBg: 'rgba(139,92,246,0.14)',
      title: 'Installable Web App &amp; 7:00 AM IST Push Alerts',
      desc: 'Install NexBrief onto your home screen like a native app, enable optional 7:00 AM IST browser alerts, and share key alerts to WhatsApp or LinkedIn in one tap.',
    },
  ];

  const featureRowsHtml = features
    .map(
      (f, idx) => `
      <tr>
        <td style="padding:16px 0;${idx < features.length - 1 ? 'border-bottom:1px solid #1e293b;' : ''}">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="38" valign="top" style="padding-top:2px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;font-weight:700;color:#64748b;">
                ${f.num}
              </td>
              <td valign="top">
                <div style="margin-bottom:5px;">
                  <span style="display:inline-block;background:${f.tagBg};color:${f.tagColor};font-size:10px;font-weight:700;letter-spacing:0.8px;padding:2px 8px;border-radius:4px;text-transform:uppercase;">${f.tag}</span>
                </div>
                <div style="color:#f8fafc;font-size:15px;font-weight:700;margin-bottom:4px;line-height:1.35;">${f.title}</div>
                <div style="color:#94a3b8;font-size:13px;line-height:1.6;">${f.desc}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>NexBrief Release 2.0 — Platform Update</title>
</head>
<body style="margin:0;padding:0;background:#090d16;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <!-- Hidden Inbox Preheader Text -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    NexBrief 2.0 is live: India-first hiring intelligence, AI "Why This Matters" summaries, searchable /archive &amp; 7 AM browser alerts.
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#090d16;">
    <tr>
      <td align="center" style="padding:36px 14px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#0f172a;border:1px solid #1e293b;border-radius:16px;overflow:hidden;">

          <!-- Subtle Top Brand Bar -->
          <tr>
            <td style="background:#0c1322;border-bottom:1px solid #1e293b;padding:18px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left" style="font-size:20px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">
                    <span style="color:#818cf8;">Nex</span>Brief
                  </td>
                  <td align="right" style="font-size:11px;font-weight:700;letter-spacing:1.1px;color:#94a3b8;text-transform:uppercase;">
                    ${isTest ? 'Preview · ' : ''}Release 2.0 · Nov 2026
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Editorial Hero Banner -->
          <tr>
            <td style="background:linear-gradient(135deg,#171c3a 0%,#1e1b4b 60%,#2e1065 100%);padding:36px 32px;border-bottom:1px solid #27324a;">
              <div style="font-size:11px;font-weight:700;letter-spacing:1.4px;color:#a5b4fc;text-transform:uppercase;margin-bottom:10px;">
                Platform Release Briefing
              </div>
              <h1 style="margin:0 0 12px 0;color:#ffffff;font-size:24px;font-weight:800;line-height:1.3;letter-spacing:-0.4px;">
                Sharper Signal. Zero Clutter. Built for India's Engineers.
              </h1>
              <p style="margin:0;color:#cbd5e1;font-size:14px;line-height:1.65;">
                Hello ${firstName}, we have upgraded every layer of NexBrief so your 7:00 AM IST briefing gives you faster, more actionable career and tech intelligence.
              </p>
            </td>
          </tr>

          <!-- At-a-Glance Metrics Strip -->
          <tr>
            <td style="padding:20px 32px 4px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#131d31;border:1px solid #24324a;border-radius:10px;">
                <tr>
                  <td width="33%" align="center" style="padding:14px 8px;border-right:1px solid #24324a;">
                    <div style="font-size:16px;font-weight:800;color:#34d399;">60% India</div>
                    <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;margin-top:2px;">Local Tech Priority</div>
                  </td>
                  <td width="34%" align="center" style="padding:14px 8px;border-right:1px solid #24324a;">
                    <div style="font-size:16px;font-weight:800;color:#a5b4fc;">Gemini AI</div>
                    <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;margin-top:2px;">Actionable Insights</div>
                  </td>
                  <td width="33%" align="center" style="padding:14px 8px;">
                    <div style="font-size:16px;font-weight:800;color:#38bdf8;">7:00 AM IST</div>
                    <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;margin-top:2px;">Email &amp; Push Drop</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Numbered Release Highlights -->
          <tr>
            <td style="padding:12px 32px 8px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${featureRowsHtml}
              </table>
            </td>
          </tr>

          <!-- Live Story Preview Sample -->
          <tr>
            <td style="padding:12px 32px 24px;">
              <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#64748b;text-transform:uppercase;margin-bottom:8px;">
                Sample Morning Briefing Format
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#151f32;border:1px solid #2a3954;border-radius:10px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <div style="margin-bottom:8px;">
                      <span style="display:inline-block;background:#059669;color:#ffffff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;letter-spacing:0.5px;">JOBS</span>
                      <span style="display:inline-block;background:rgba(16,185,129,0.14);color:#6ee7b7;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;margin-left:5px;">INDIA</span>
                    </div>
                    <div style="color:#f1f5f9;font-size:14px;font-weight:700;line-height:1.4;margin-bottom:10px;">
                      Enterprise IT Hiring &amp; AI Engineering Demand Accelerates Across Indian GCC Hubs
                    </div>
                    <div style="background:rgba(99,102,241,0.1);border-left:3px solid #818cf8;padding:8px 12px;border-radius:4px;">
                      <span style="font-size:10px;font-weight:800;letter-spacing:0.5px;color:#a5b4fc;text-transform:uppercase;">Why This Matters</span>
                      <div style="font-size:12px;color:#e2e8f0;line-height:1.5;margin-top:2px;">
                        GCCs are actively recruiting freshers with cloud, API &amp; DSA fundamentals — prioritize off-campus drives in Bengaluru, Hyderabad &amp; Pune.
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Action Buttons -->
          <tr>
            <td style="padding:4px 32px 28px;text-align:center;">
              <a href="${appBase}/dashboard" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#ffffff;font-size:14px;font-weight:700;padding:13px 28px;border-radius:8px;text-decoration:none;margin:5px;letter-spacing:0.2px;">
                Open Your Dashboard &rarr;
              </a>
              <a href="${appBase}/archive" target="_blank" style="display:inline-block;background:#162033;border:1px solid #334155;color:#e2e8f0;font-size:14px;font-weight:600;padding:12px 22px;border-radius:8px;text-decoration:none;margin:5px;">
                Browse Archive
              </a>
            </td>
          </tr>

          <!-- Creator Sign-off -->
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">
                Thank you for reading every morning.<br />
                <strong style="color:#e2e8f0;">Md Rounaq Ali</strong> &mdash; <span style="color:#64748b;">Creator, NexBrief</span>
              </p>
            </td>
          </tr>

          <!-- Clean Footer -->
          <tr>
            <td style="background:#0a0f1c;border-top:1px solid #1e293b;padding:22px 32px;text-align:center;">
              <p style="color:#64748b;font-size:12px;margin:0 0 10px 0;line-height:1.6;">
                You are receiving this announcement as a registered member of <strong style="color:#818cf8;">NexBrief Daily</strong>. Manage delivery preferences anytime in your <a href="${appBase}/dashboard" style="color:#94a3b8;text-decoration:underline;">dashboard</a>.
              </p>
              <p style="color:#94a3b8;font-size:12px;margin:0 0 10px 0;line-height:1.6;">
                &copy; ${new Date().getFullYear()} NexBrief. All rights reserved. Developed by <a href="https://md-rounaq-ali.netlify.app/" target="_blank" style="color:#818cf8;text-decoration:underline;font-weight:600;">Md Rounaq Ali</a> for India's engineers.
              </p>
              <p style="color:#64748b;font-size:12px;margin:0;line-height:1.6;">
                Search Creator on Google: &nbsp;<a href="https://www.google.com/search?q=md+rounaq+ali" target="_blank" style="display:inline-block;padding:4px 14px;background:#0f2942;border:1px solid #0284c7;border-radius:20px;color:#38bdf8;font-size:12px;font-weight:600;text-decoration:none;">md rounaq ali &#8599;</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const sendProductUpdateEmail = async (user, { isTest = false } = {}) => {
  await unblockEmailIfBlocked(user.email);
  const subjectPrefix = isTest ? '[TEST] ' : '';
  const data = await sendEmailViaAPI({
    toEmail: user.email,
    toName: user.name || 'Engineer',
    subject: `${subjectPrefix}Introducing NexBrief 2.0 — India-First Hiring, AI Insights & Public Archive`,
    htmlContent: buildProductUpdateEmailHtml(user, { isTest }),
  });
  console.log(`✅ Product update email sent via API → ${user.email} (test=${isTest})`);
  return data;
};

const sendProductUpdateBlast = async (users) => {
  let successCount = 0;
  let failCount = 0;
  for (const user of users) {
    try {
      await sendProductUpdateEmail(user, { isTest: false });
      successCount++;
    } catch (err) {
      console.error(`❌ Product update failed → ${user.email}:`, err.message);
      failCount++;
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  console.log(`📢 Product Update Blast Report: ${successCount} sent, ${failCount} failed`);
  return { successCount, failCount };
};

module.exports = {
  sendWelcomeEmail,
  sendRegistrationOTPEmail,
  sendOTPEmail,
  sendDailyDigest,
  sendTestEmail,
  buildProductUpdateEmailHtml,
  sendProductUpdateEmail,
  sendProductUpdateBlast,
  unblockEmailIfBlocked,
};
