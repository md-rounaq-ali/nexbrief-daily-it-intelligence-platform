const fetch = require('node-fetch');

// Brevo API Key
const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.BREVO_SMTP_PASS;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

// Category badge colors for email
const categoryColors = {
  AI: '#6366f1', Cybersecurity: '#ef4444', Software: '#10b981',
  Cloud: '#3b82f6', IT: '#8b5cf6', Education: '#f59e0b',
  Research: '#06b6d4', Science: '#ec4899', General: '#64748b',
};

/**
 * Core helper to send email via Brevo Transactional HTTP API (runs over Port 443 / HTTPS)
 * This bypasses ISP SMTP blocks on ports 587 and 465.
 */
const sendEmailViaAPI = async ({ toEmail, toName, subject, htmlContent }) => {
  try {
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
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
        subject: subject,
        htmlContent: htmlContent,
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

// ─── Daily Digest Email Template ──────────────────────────────────────────────
const buildDigestEmailHtml = (user, digest, dateStr) => {
  const renderCards = (articles) =>
    (articles || []).map(a => `
    <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:16px;">
      <div style="display:inline-block;background:${categoryColors[a.category] || '#6366f1'};color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:0.5px;margin-bottom:10px;text-transform:uppercase;">${a.category}</div>
      <h3 style="color:#f1f5f9;font-size:15px;font-weight:700;margin:0 0 8px 0;line-height:1.4;">${a.title}</h3>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 12px 0;line-height:1.6;">${a.description}</p>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <span style="color:#64748b;font-size:12px;">📰 ${a.source} &nbsp;·&nbsp; ${new Date(a.publishedAt).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}</span>
        <a href="${a.url}" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:12px;font-weight:600;padding:6px 16px;border-radius:8px;text-decoration:none;" target="_blank">Read More →</a>
      </div>
    </div>`).join('');

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
            <span style="color:#e2e8f0;font-size:14px;">📅 ${dateStr} &nbsp;·&nbsp; Good Morning, ${user.name.split(' ')[0]}! ☀️</span>
          </div>
        </td></tr>
        <tr><td style="background:#0f172a;padding:22px 32px 8px;">
          <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0;">Here's your personalized daily briefing — <strong style="color:#818cf8;">50% IT & Tech</strong>, <strong style="color:#f59e0b;">30% Education & Research</strong>, <strong style="color:#64748b;">20% World News</strong>. Curated for engineering students and IT professionals.</p>
        </td></tr>
        <tr><td style="background:#0f172a;padding:20px 32px 8px;">
          <div style="border-left:4px solid #6366f1;padding-left:14px;margin-bottom:18px;">
            <h2 style="color:#f1f5f9;font-size:18px;font-weight:800;margin:0 0 3px 0;">🔴 IT & Technology <span style="font-size:13px;color:#64748b;font-weight:400;">(50%)</span></h2>
            <p style="color:#64748b;font-size:12px;margin:0;">AI · Cybersecurity · Cloud · Software Development</p>
          </div>
          ${renderCards(digest.itNews) || '<p style="color:#64748b;font-size:14px;">No IT news today.</p>'}
        </td></tr>
        <tr><td style="background:#0f172a;padding:16px 32px 8px;">
          <hr style="border:none;border-top:1px solid #1e293b;margin:0 0 20px 0;">
          <div style="border-left:4px solid #f59e0b;padding-left:14px;margin-bottom:18px;">
            <h2 style="color:#f1f5f9;font-size:18px;font-weight:800;margin:0 0 3px 0;">📚 Education & Research <span style="font-size:13px;color:#64748b;font-weight:400;">(30%)</span></h2>
            <p style="color:#64748b;font-size:12px;margin:0;">University · B.Tech · Science · EdTech · Research</p>
          </div>
          ${renderCards(digest.educationNews) || '<p style="color:#64748b;font-size:14px;">No education news today.</p>'}
        </td></tr>
        <tr><td style="background:#0f172a;padding:16px 32px 8px;">
          <hr style="border:none;border-top:1px solid #1e293b;margin:0 0 20px 0;">
          <div style="border-left:4px solid #10b981;padding-left:14px;margin-bottom:18px;">
            <h2 style="color:#f1f5f9;font-size:18px;font-weight:800;margin:0 0 3px 0;">🌐 World Headlines <span style="font-size:13px;color:#64748b;font-weight:400;">(20%)</span></h2>
            <p style="color:#64748b;font-size:12px;margin:0;">Business · Global Events · Other</p>
          </div>
          ${renderCards(digest.generalNews) || '<p style="color:#64748b;font-size:14px;">No world news today.</p>'}
        </td></tr>
        <tr><td style="background:#0f172a;border-radius:0 0 20px 20px;padding:24px 32px;text-align:center;border-top:1px solid #1e293b;">
          <a href="${process.env.APP_URL || 'http://localhost:3000'}/dashboard" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:14px;font-weight:700;padding:12px 28px;border-radius:10px;text-decoration:none;display:inline-block;margin-bottom:16px;">🖥️ Open Full Dashboard</a>
          <p style="color:#475569;font-size:12px;margin:12px 0 0 0;line-height:1.6;">You're subscribed to <strong style="color:#818cf8;">NexBrief Daily</strong> · Delivered every morning at <strong>7:00 AM IST</strong><br/>© ${new Date().getFullYear()} NexBrief</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
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
            <p style="color:#f1f5f9;font-size:16px;font-weight:700;margin:0 0 6px 0;">Hi ${name.split(' ')[0]}, almost there! 👋</p>
            <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 8px 0;">
              You're registering <strong style="color:#6ee7b7;">${email}</strong> on NexBrief.
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
            <hr style="border:none;border-top:1px solid #1e293b;margin-bottom:18px;">
            <p style="color:#475569;font-size:12px;text-align:center;margin:0;">© ${new Date().getFullYear()} NexBrief &nbsp;·&nbsp; Built for IT professionals & engineering students</p>
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
            <p style="color:#f1f5f9;font-size:16px;font-weight:600;margin:0 0 8px 0;">Hi ${user.name.split(' ')[0]},</p>
            <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 24px 0;">We received a request to reset your NexBrief password. Use the code below — valid for <strong style="color:#f1f5f9;">10 minutes</strong>.</p>
            <div style="background:#1e293b;border:2px dashed #6366f1;border-radius:16px;padding:28px;text-align:center;margin-bottom:24px;">
              <div style="color:#94a3b8;font-size:13px;margin-bottom:10px;letter-spacing:1px;text-transform:uppercase;">Your Reset Code</div>
              <div style="font-size:48px;font-weight:900;letter-spacing:12px;color:#818cf8;font-family:monospace;">${otp}</div>
              <div style="color:#64748b;font-size:12px;margin-top:10px;">⏰ Expires in 10 minutes</div>
            </div>
            <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 20px 0;">If you didn't request this, safely ignore this email. Your password will not change.</p>
            <hr style="border:none;border-top:1px solid #1e293b;margin-bottom:20px;">
            <p style="color:#475569;font-size:12px;text-align:center;margin:0;">© ${new Date().getFullYear()} NexBrief &nbsp;·&nbsp; Automated security email</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
};

// ─── Welcome Email ────────────────────────────────────────────────────────────
const buildWelcomeEmailHtml = (user) => {
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
            <h2 style="color:#f1f5f9;font-size:20px;font-weight:700;margin:0 0 12px 0;">Hello, ${user.name}! 👋</h2>
            <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 20px 0;">You've successfully joined <strong style="color:#818cf8;">NexBrief</strong> — the first dedicated daily intelligence platform for <strong style="color:#f1f5f9;">IT professionals and engineering students</strong>. Every morning at <strong style="color:#fff;">7:00 AM IST</strong>, you'll receive:</p>
            <div style="background:#1e293b;border-radius:14px;padding:20px;margin-bottom:22px;">
              <p style="color:#f1f5f9;font-size:14px;margin:0 0 10px 0;">🔴 <strong>50% IT & Technology</strong> — AI, Cybersecurity, Cloud, Software</p>
              <p style="color:#f1f5f9;font-size:14px;margin:0 0 10px 0;">📚 <strong>30% Education & Research</strong> — University, B.Tech, Science, EdTech</p>
              <p style="color:#f1f5f9;font-size:14px;margin:0;">🌐 <strong>20% World Headlines</strong> — Business, Global, Other</p>
            </div>
            <div style="text-align:center;margin-bottom:22px;">
              <a href="${process.env.APP_URL || 'http://localhost:3000'}/dashboard" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:15px;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none;display:inline-block;">🚀 Go to Your Dashboard</a>
            </div>
            <p style="color:#475569;font-size:12px;text-align:center;margin:0;">© ${new Date().getFullYear()} NexBrief · Built for IT professionals & engineering students</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
};

// ─── Send Functions (using HTTP API via Port 443 HTTPS) ───────────────────────
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
  await sendEmailViaAPI({
    toEmail: email,
    toName: name,
    subject: `✉️ NexBrief — Verify Your Email: ${otp}`,
    htmlContent: buildRegistrationOTPHtml(name, email, otp),
  });
  console.log(`✅ Registration OTP sent via API → ${email}`);
};

const sendOTPEmail = async (user, otp) => {
  await sendEmailViaAPI({
    toEmail: user.email,
    toName: user.name,
    subject: `🔐 NexBrief — Your Password Reset Code: ${otp}`,
    htmlContent: buildOTPEmailHtml(user, otp),
  });
  console.log(`✅ Password reset OTP sent via API → ${user.email}`);
};

const sendDailyDigest = async (digest, subscribers) => {
  const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  let successCount = 0, failCount = 0;

  for (const user of subscribers) {
    try {
      await sendEmailViaAPI({
        toEmail: user.email,
        toName: user.name,
        subject: `📰 NexBrief Daily — ${dateStr}`,
        htmlContent: buildDigestEmailHtml(user, digest, dateStr),
      });
      successCount++;
    } catch (err) {
      console.error(`❌ Email failed to send via API → ${user.email}:`, err.message);
      failCount++;
    }
    // Tiny delay to be nice to rate limits (HTTP is very fast)
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`📧 API Digest Send Report: ${successCount} sent, ${failCount} failed`);
  return { successCount, failCount };
};

const sendTestEmail = async (toEmail, digest) => {
  const dateStr = `[TEST] ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
  await sendEmailViaAPI({
    toEmail: toEmail,
    toName: 'Admin',
    subject: `[TEST] NexBrief Daily`,
    htmlContent: buildDigestEmailHtml({ name: 'Admin', email: toEmail }, digest, dateStr),
  });
  console.log(`✅ Test digest email sent via API → ${toEmail}`);
};

module.exports = { sendWelcomeEmail, sendRegistrationOTPEmail, sendOTPEmail, sendDailyDigest, sendTestEmail };
