require('dotenv').config();
const mongoose = require('mongoose');
const Digest = require('./server/models/Digest');

const clearToday = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('✅ Connected successfully!\n');

    const today = new Date().toISOString().split('T')[0];
    console.log(`🔍 Searching for digest on date: ${today}`);

    const result = await Digest.deleteOne({ date: today });
    if (result.deletedCount > 0) {
      console.log(`🗑️ Successfully deleted today's digest (${today}) from the database!`);
      console.log('Now the system is ready to be triggered automatically at 1:17 PM IST.');
    } else {
      console.log(`⚠️ No digest entry found for today (${today}) in the database.`);
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
};

clearToday();
