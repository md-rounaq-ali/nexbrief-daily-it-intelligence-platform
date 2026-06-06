require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./server/models/User');
const Digest = require('./server/models/Digest');

const view = async () => {
  try {
    const uri = process.env.MONGODB_URI || "mongodb+srv://nexbriefuser:NexBrief2024@cluster0.ef3ntf5.mongodb.net/nexbrief?appName=Cluster0";
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('✅ Connected successfully!\n');

    console.log('👥 --- REGISTERED USERS & SUBSCRIBERS ---');
    const users = await User.find().sort({ isAdmin: -1, createdAt: -1 });
    if (users.length === 0) {
      console.log('No users found in database.');
    } else {
      console.table(users.map(u => ({
        Name: u.name,
        Email: u.email,
        Admin: u.isAdmin ? '👑 Yes' : 'No',
        Subscribed: u.isSubscribed ? '✅ Active' : '⏸ Paused',
        'Digests Recv': u.digestsReceived,
        Joined: u.createdAt.toLocaleDateString('en-IN')
      })));
    }

    console.log('\n📰 --- RECENT NEWSLETTER DIGESTS ---');
    const digests = await Digest.find().sort({ date: -1 }).limit(10);
    if (digests.length === 0) {
      console.log('No sent digests found in database.');
    } else {
      console.table(digests.map(d => ({
        Date: d.date,
        Status: d.status.toUpperCase(),
        'Recipient Count': d.recipientCount,
        'Trigger Source': d.triggerSource || 'cron-job',
        'Sent At': d.sentAt ? new Date(d.sentAt).toLocaleString('en-IN') : '—'
      })));
    }

  } catch (err) {
    console.error('❌ Database Connection Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
};

view();
