import 'dotenv/config';
import app from './app.js';
import connectDB from './config/db.js';

const PORT = process.env.PORT || 5000;

const start = async () => {
  // Connect to MongoDB
  await connectDB();

  app.listen(PORT, () => {
    console.log(`✓ Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  });
};

start();
