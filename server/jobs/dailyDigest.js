const cron = require('node-cron');
const User = require('../models/User');
const Digest = require('../models/Digest');
const { fetchAllNewsForDigest } = require('../services/newsService');
const { sendDailyDigest } = require('../services/emailService');
const { sendDailyDigestPush } = require('../services/pushService');
const { getTodayIST } = require('../utils/dateIST');

/**
 * Run the daily digest: fetch FRESH news (50% IT / 30% Education / 20% General)
 * → deduplicate against last 3 days → enrich AI "Why This Matters" → save to DB
 * → send emails to active subscribers → push browser alerts
 */
const runDailyDigest = async (triggerSource = 'cron') => {
  const today = getTodayIST();
  console.log(`\n🗞️  Daily digest starting for ${today} [${triggerSource}]...`);

  try {
    // Check if already sent today
    const existing = await Digest.findOne({ date: today });
    if (existing && existing.status === 'sent') {
      console.log(`⚠️  Already sent for ${today}. Skipping.`);
      return { skipped: true, reason: 'Already sent today.' };
    }

    // Fetch FRESH news (with dedup + AI Why-This-Matters summaries)
    const { itNews, educationNews, generalNews } = await fetchAllNewsForDigest();
    console.log(`📰 Fresh News: IT=${itNews.length} | Education=${educationNews.length} | General=${generalNews.length}`);

    // Save digest to DB BEFORE sending emails so digest._id exists for open tracking pixel!
    const digest = existing || new Digest({ date: today });
    digest.itNews = itNews;
    digest.educationNews = educationNews;
    digest.generalNews = generalNews;
    digest.triggerSource = triggerSource;
    await digest.save();

    // Get subscribed users (include _id & name & email for personalized tracking pixel)
    const subscribers = await User.find({ isSubscribed: true }).select('_id name email');
    let successCount = 0;
    let failCount = 0;

    if (subscribers.length === 0) {
      console.log('⚠️  No email subscribers found.');
    } else {
      console.log(`📬 Sending to ${subscribers.length} subscriber(s)...`);
      const emailResult = await sendDailyDigest(digest, subscribers);
      successCount = emailResult.successCount;
      failCount = emailResult.failCount;
    }

    // Send 7 AM IST Web Push Notification to browser subscribers
    const pushReport = await sendDailyDigestPush(digest);

    // Update digest status
    digest.sentAt = new Date();
    digest.recipientCount = successCount;
    digest.pushSentCount = pushReport.sent || 0;
    digest.status = 'sent';
    await digest.save();

    if (subscribers.length > 0) {
      await User.updateMany({ isSubscribed: true }, { $inc: { digestsReceived: 1 } });
    }

    console.log(`✅ Digest done! Emails Sent: ${successCount}, Failed: ${failCount}, Push Alerts: ${pushReport.sent}\n`);
    return {
      success: true,
      sentTo: successCount,
      failed: failCount,
      pushSent: pushReport.sent,
    };
  } catch (error) {
    console.error('❌ Daily digest error:', error);
    await Digest.findOneAndUpdate({ date: today }, { status: 'failed' }, { upsert: true });
    return { success: false, error: error.message };
  }
};

/**
 * Start node-cron scheduler
 * 7:00 AM IST = 1:30 AM UTC → cron: "30 1 * * *"
 */
const startDailyDigestJob = () => {
  cron.schedule(
    '30 1 * * *',
    () => {
      runDailyDigest('cron');
    },
    { timezone: 'UTC' }
  );

  console.log('⏰ Daily digest scheduled: 7:00 AM IST (01:30 UTC) | Format: 50% IT / 30% Education / 20% General');
  console.log('   🔄 Dedup: Articles from last 3 digests are automatically excluded');
  console.log('   🏢 IT Priority: Jobs/Internships → AI → Frameworks → Cybersecurity → Cloud');
  console.log('   🤖 AI Summaries + 🔔 Web Push + 📧 Open Tracking Enabled');
};

module.exports = { startDailyDigestJob, runDailyDigest };
