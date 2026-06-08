require('dotenv').config();
const mongoose = require('mongoose');
const Digest = require('./server/models/Digest');

const clearAll = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('✅ Connected successfully!\n');

    console.log('⚠️ Deleting ALL digests from the database...');
    const result = await Digest.deleteMany({});
    console.log(`🗑️ Successfully deleted all ${result.deletedCount} digests from the database!`);
    console.log('Your dashboard history is now completely fresh and clean.');

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
};

clearAll();
