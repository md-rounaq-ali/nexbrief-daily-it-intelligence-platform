const cron = require('node-cron');
const User = require('../models/User');
const Digest = require('../models/Digest');
const { fetchAllNewsForDigest } = require('../services/newsService');
const { sendDailyDigest } = require('../services/emailService');

/**
 * Run the daily digest: fetch news (50% IT / 30% Education / 20% General)
 * → save to DB → send to all active subscribers
 */
const runDailyDigest = async (triggerSource = 'cron') => {
  const today = new Date().toISOString().split('T')[0];
  console.log(`\n🗞️  Daily digest starting for ${today} [${triggerSource}]...`);

  try {
    // Check if already sent today
    const existing = await Digest.findOne({ date: today });
    if (existing && existing.status === 'sent') {
      console.log(`⚠️  Already sent for ${today}. Skipping.`);
      return { skipped: true, reason: 'Already sent today.' };
    }

    // Fetch news: 50% IT + 30% Education + 20% General
    const { itNews, educationNews, generalNews } = await fetchAllNewsForDigest();
    console.log(`📰 News: IT=${itNews.length} | Education=${educationNews.length} | General=${generalNews.length}`);

    // Save digest to DB
    let digest = existing || new Digest({ date: today });
    digest.itNews = itNews;
    digest.educationNews = educationNews;
    digest.generalNews = generalNews;
    digest.triggerSource = triggerSource;
    await digest.save();

    // Get subscribed users
    const subscribers = await User.find({ isSubscribed: true }).select('name email');
    if (subscribers.length === 0) {
      console.log('⚠️  No subscribers found.');
      return { skipped: true, reason: 'No subscribers.' };
    }

    console.log(`📬 Sending to ${subscribers.length} subscriber(s)...`);
    const { successCount, failCount } = await sendDailyDigest(digest, subscribers);

    // Update digest status
    digest.sentAt = new Date();
    digest.recipientCount = successCount;
    digest.status = 'sent';
    await digest.save();

    // Increment each user's digest counter
    await User.updateMany({ isSubscribed: true }, { $inc: { digestsReceived: 1 } });

    console.log(`✅ Digest done! Sent: ${successCount}, Failed: ${failCount}\n`);
    return { success: true, sentTo: successCount, failed: failCount };

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
  cron.schedule('30 1 * * *', () => {
    runDailyDigest('cron');
  }, { timezone: 'UTC' });

  console.log('⏰ Daily digest scheduled: 7:00 AM IST (01:30 UTC) | Format: 50% IT / 30% Education / 20% General');
};

module.exports = { startDailyDigestJob, runDailyDigest };
