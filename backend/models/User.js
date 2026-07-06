// models/User.js
// Defines the shape of a "User" document in MongoDB, and hashes passwords
// automatically before saving so we NEVER store plain-text passwords.

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true }, // stored as a hash, never plain text
  },
  { timestamps: true } // adds createdAt / updatedAt automatically
);

// Mongoose "pre-save hook": runs automatically right before a user is saved.
// We use it to hash the password so plain text never touches the database.
userSchema.pre('save', async function (next) {
  // Only hash if the password field was changed (avoids re-hashing on every update)
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method: lets us do  user.comparePassword('typed-password')
// to check login attempts against the stored hash.
userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
