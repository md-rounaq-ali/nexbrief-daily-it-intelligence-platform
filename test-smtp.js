require('dotenv').config({ override: true });
const fetch = require('node-fetch');

const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.BREVO_SMTP_PASS;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

console.log('Testing Brevo Transactional HTTP API (Port 443)...');
console.log('API Key:', BREVO_API_KEY ? 'Present (starts with ' + BREVO_API_KEY.slice(0, 10) + '...)' : 'MISSING');
console.log('Sender Email:', process.env.FROM_EMAIL);
console.log('Sender Name:', process.env.FROM_NAME);

async function testAPI() {
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
            email: process.env.FROM_EMAIL,
            name: 'Sender Test',
          },
        ],
        subject: 'Test Email via Brevo HTTP API',
        htmlContent: '<h3>Connection Successful!</h3><p>This email proves the Brevo HTTP API is fully functional on Port 443.</p>',
      }),
    });

    const data = await response.json();
    if (response.ok) {
      console.log('✅ Success! Email sent via Brevo API.');
      console.log('Response:', data);
    } else {
      console.error('❌ Brevo API returned error response:', data);
    }
  } catch (error) {
    console.error('❌ Failed to connect to Brevo API:', error);
  }
}

testAPI();
