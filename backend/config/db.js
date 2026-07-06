// config/db.js
// This file's ONLY job is to connect to MongoDB using Mongoose.
// We keep it separate so server.js doesn't get cluttered.

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    // If the database can't connect, there's no point running the server.
    process.exit(1);
  }
};

module.exports = connectDB;
