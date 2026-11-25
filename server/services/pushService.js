const webpush = require('web-push');
const AppConfig = require('../models/AppConfig');
const PushSubscription = require('../models/PushSubscription');

let cachedVapidKeys = null;
let vapidConfigured = false;

/**
 * Resolve VAPID keys from environment variables OR persist an auto-generated
 * pair in MongoDB so push subscriptions work reliably across Render deploys.
 */
const getVapidKeys = async () => {
  if (cachedVapidKeys) return cachedVapidKeys;

  const envPub = (process.env.VAPID_PUBLIC_KEY || '').trim();
  const envPriv = (process.env.VAPID_PRIVATE_KEY || '').trim();

  if (envPub && envPriv) {
    cachedVapidKeys = { publicKey: envPub, privateKey: envPriv };
    return cachedVapidKeys;
  }

  // Fallback to MongoDB stored keys
  try {
    let record = await AppConfig.findOne({ key: 'vapid_keys' });
    if (record?.value?.publicKey && record?.value?.privateKey) {
      cachedVapidKeys = {
        publicKey: record.value.publicKey,
        privateKey: record.value.privateKey,
      };
      return cachedVapidKeys;
    }

    const generated = webpush.generateVAPIDKeys();
    await AppConfig.findOneAndUpdate(
      { key: 'vapid_keys' },
      { key: 'vapid_keys', value: generated },
      { upsert: true, new: true }
    );
    cachedVapidKeys = generated;
    console.log('🔐 Generated and stored persistent VAPID keys in MongoDB for Web Push.');
    return cachedVapidKeys;
  } catch (err) {
    console.warn('⚠️ Failed persisting VAPID keys to DB, using ephemeral fallback:', err.message);
    cachedVapidKeys = webpush.generateVAPIDKeys();
    return cachedVapidKeys;
  }
};

/**
 * Ensure web-push is initialized with valid VAPID subject + keys.
 */
const ensureWebPushConfigured = async () => {
  const keys = await getVapidKeys();
  if (!vapidConfigured) {
    const subject =
      (process.env.VAPID_SUBJECT || '').trim() ||
      `mailto:${process.env.FROM_EMAIL || 'tabrasali7@gmail.com'}`;
    webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
    vapidConfigured = true;
  }
  return keys;
};

/**
 * Send a Web Push notification to all active subscribed browsers.
 */
const sendPushToAllSubscribers = async ({ title, body, url = '/dashboard', tag = 'nexbrief-daily' }) => {
  try {
    await ensureWebPushConfigured();
    const subs = await PushSubscription.find({ isActive: true });
    if (!subs.length) {
      return { total: 0, sent: 0, failed: 0, removed: 0 };
    }

    const payload = JSON.stringify({
      title: title || '☀️ Your NexBrief is ready!',
      body: body || 'Fresh IT jobs, AI breakthroughs & student tech news delivered.',
      icon: '/images/icon-192.png',
      badge: '/images/badge-96.png',
      url,
      tag,
      timestamp: Date.now(),
    });

    let sent = 0;
    let failed = 0;
    let removed = 0;

    // Send in batches of 15 for speed + resource friendliness
    const batchSize = 15;
    for (let i = 0; i < subs.length; i += batchSize) {
      const batch = subs.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: sub.keys },
              payload,
              { TTL: 60 * 60 * 12 } // 12 hours TTL
            );
            sent++;
            sub.lastNotifiedAt = new Date();
            sub.failCount = 0;
            await sub.save();
          } catch (err) {
            // 404 / 410 = browser revoked permission or unsubscribed
            if (err.statusCode === 404 || err.statusCode === 410) {
              await PushSubscription.deleteOne({ _id: sub._id });
              removed++;
            } else {
              failed++;
              sub.failCount = (sub.failCount || 0) + 1;
              if (sub.failCount >= 5) {
                sub.isActive = false;
              }
              await sub.save();
            }
          }
        })
      );
    }

    console.log(`🔔 Web Push report: sent=${sent}, removed=${removed}, failed=${failed}`);
    return { total: subs.length, sent, failed, removed };
  } catch (error) {
    console.error('❌ Web Push broadcast error:', error.message);
    return { total: 0, sent: 0, failed: 0, removed: 0, error: error.message };
  }
};

/**
 * Send morning 7 AM IST digest push notification with real article counts.
 */
const sendDailyDigestPush = async (digest) => {
  const itCount = digest?.itNews?.length || 0;
  const eduCount = digest?.educationNews?.length || 0;
  const worldCount = digest?.generalNews?.length || 0;
  const total = itCount + eduCount + worldCount;

  const topHeadline = digest?.itNews?.[0]?.title
    ? ` Top story: ${digest.itNews[0].title.slice(0, 75)}${digest.itNews[0].title.length > 75 ? '…' : ''}`
    : '';

  return sendPushToAllSubscribers({
    title: '☀️ Your NexBrief is ready!',
    body: `${itCount} IT & job alerts + ${eduCount} education updates (${total} total).${topHeadline}`,
    url: digest?.date ? `/archive/${digest.date}` : '/dashboard',
    tag: `nexbrief-${digest?.date || 'daily'}`,
  });
};

module.exports = {
  getVapidKeys,
  ensureWebPushConfigured,
  sendPushToAllSubscribers,
  sendDailyDigestPush,
};
