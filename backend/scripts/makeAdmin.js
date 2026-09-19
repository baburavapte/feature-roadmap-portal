/**
 * Dev-only script: promote a user to admin by email.
 *
 * Usage:
 *   npm run make:admin -- user@example.com
 *
 * WARNING: This script is for local development only.
 *          Remove or restrict access before deploying to production.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User.js';

const email = process.argv[2];

if (!email) {
  console.error('Usage: npm run make:admin -- <email>');
  process.exit(1);
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/feature_roadmap';

try {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.');

  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase().trim() },
    { $set: { role: 'admin' } },
    { new: true }
  );

  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  console.log(`✅ ${user.name} (${user.email}) is now an admin.`);
  await mongoose.disconnect();
  process.exit(0);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
