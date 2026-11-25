require('dotenv').config();
const mongoose = require('mongoose');
const Digest = require('./server/models/Digest');
const { getTodayIST } = require('./server/utils/dateIST');

const clearToday = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI is not set in environment variables (.env).');
    }
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('✅ Connected successfully!\n');

    const today = getTodayIST();
    console.log(`🔍 Searching for digest on IST date: ${today}`);

    const result = await Digest.deleteOne({ date: today });
    if (result.deletedCount > 0) {
      console.log(`🗑️ Successfully deleted today's digest (${today}) from the database!`);
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
