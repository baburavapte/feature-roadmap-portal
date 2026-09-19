import mongoose from 'mongoose';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

/**
 * Connect to MongoDB with retry logic.
 * Retries up to MAX_RETRIES times before giving up.
 */
const connectDB = async (attempt = 1) => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // Give MongoDB more time to be ready
    });
    console.log(`✓ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      console.warn(`✗ MongoDB connection attempt ${attempt} failed: ${error.message}`);
      console.warn(`  Retrying in ${RETRY_DELAY_MS / 1000}s... (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return connectDB(attempt + 1);
    }
    console.error(`✗ MongoDB connection error after ${MAX_RETRIES} attempts: ${error.message}`);
    console.error('  The server will continue without a database connection.');
    console.error('  Auth routes require MongoDB — start MongoDB and restart the server.');
  }
};

export default connectDB;
