import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

// ─── Sub-schemas ─────────────────────────────────────────────────────────────

const refreshTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { _id: false }
);

// ─── User Schema ──────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
      index: true,
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never returned by default
    },

    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    // Stored as hashed strings; raw tokens are sent to the client
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },

    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },

    // Array supports multi-device sessions; each entry is a stored refresh JWT
    refreshTokens: {
      type: [refreshTokenSchema],
      select: false,
      default: [],
    },
  },
  {
    timestamps: true, // Adds createdAt + updatedAt automatically
  }
);

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Hash password before saving if it has been modified.
 */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
  next();
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

/**
 * Compare a plain-text password against the stored hash.
 * @param {string} candidatePassword
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Return a safe user object (no password, tokens, or sensitive fields).
 * @returns {object}
 */
userSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    emailVerified: this.emailVerified,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

// ─── Static Methods ───────────────────────────────────────────────────────────

/**
 * Find a user by email, optionally selecting the password field.
 * @param {string} email
 * @param {boolean} includePassword
 * @returns {Promise<import('mongoose').Document|null>}
 */
userSchema.statics.findByEmail = function (email, includePassword = false) {
  const query = this.findOne({ email: email.toLowerCase().trim() });
  if (includePassword) query.select('+password');
  return query;
};

const User = mongoose.model('User', userSchema);

export default User;
