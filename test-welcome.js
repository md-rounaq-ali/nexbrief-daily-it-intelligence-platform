require('dotenv').config({ override: true });
const fetch = require('node-fetch');

const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.BREVO_SMTP_PASS;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

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
            <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 20px 0;">You've successfully joined <strong style="color:#818cf8;">NexBrief</strong> — the first dedicated daily intelligence platform for <strong style="color:#f1f5f9;">IT professionals and engineering students</strong>.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
};

async function testWelcome(toEmail) {
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
            name: 'Test Recipient',
          },
        ],
        subject: `🎉 Welcome to NexBrief, Test!`,
        htmlContent: buildWelcomeEmailHtml({ name: 'Test Recipient', email: toEmail }),
      }),
    });

    const data = await response.json();
    if (response.ok) {
      console.log(`✅ Success sending welcome to ${toEmail}:`, data);
    } else {
      console.error(`❌ Error sending welcome to ${toEmail}:`, data);
    }
  } catch (error) {
    console.error('❌ Failed:', error);
  }
}

// Test sending to both
const testEmailAddress = process.argv[2] || 'tabrasali14@gmail.com';
testWelcome(testEmailAddress);
