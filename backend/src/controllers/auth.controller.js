import User from '../models/User.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { generateOpaqueToken, hashToken } from '../utils/token.js';
import { setRefreshTokenCookie, clearAuthCookies } from '../utils/cookie.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Validate email format */
const isValidEmail = (email) => /^\S+@\S+\.\S+$/.test(email);

/** Validate password strength */
const validatePassword = (password) => {
  if (!password || password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return null;
};

/**
 * Issue both tokens and set the refresh cookie.
 * Returns the access token string to be sent in the response body.
 */
const issueTokenPair = async (user, res) => {
  const payload = { id: user._id, email: user.email, role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken({ id: user._id });

  const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Store refresh token in user document (with expiry, for rotation + invalidation)
  await User.findByIdAndUpdate(user._id, {
    $push: {
      refreshTokens: { token: refreshToken, expiresAt: refreshExpiry },
    },
  });

  setRefreshTokenCookie(res, refreshToken);
  return accessToken;
};

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/auth/signup
 */
export const signup = async (req, res, next) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    // Input validation
    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address.' });
    }

    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ success: false, message: pwError });

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    // Duplicate check
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    // Email verification token
    const verificationToken = generateOpaqueToken();
    const hashedVerificationToken = hashToken(verificationToken);
    const verificationExpires = new Date(
      Date.now() + Number(process.env.EMAIL_VERIFICATION_TOKEN_EXPIRES_IN || 86400000)
    );

    // Create user (password hashing happens in the pre-save hook)
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      emailVerificationToken: hashedVerificationToken,
      emailVerificationExpires: verificationExpires,
    });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully. Please verify your email.',
      data: {
        user: user.toSafeObject(),
        // DEV ONLY: Return token so you can test without a real email service.
        // Remove this field (or gate it behind NODE_ENV check) in production.
        devEmailVerificationToken: verificationToken,
        verifyEmailUrl: `/api/auth/verify-email/${verificationToken}`,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    // Fetch user with password field (normally excluded)
    const user = await User.findByEmail(email, true).select('+refreshTokens');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const passwordMatch = await user.comparePassword(password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const accessToken = await issueTokenPair(user, res);

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      data: {
        user: user.toSafeObject(),
        accessToken,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/refresh
 * Rotate refresh token — invalidates old, issues new pair.
 */
export const refresh = async (req, res, next) => {
  try {
    const incomingToken = req.cookies?.refreshToken;

    if (!incomingToken) {
      return res.status(401).json({ success: false, message: 'No refresh token provided.' });
    }

    // Verify signature and expiry
    let decoded;
    try {
      decoded = verifyRefreshToken(incomingToken);
    } catch {
      clearAuthCookies(res);
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
    }

    // Find user and match the stored token
    const user = await User.findById(decoded.id).select('+refreshTokens');
    if (!user) {
      clearAuthCookies(res);
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    const tokenEntry = user.refreshTokens.find((t) => t.token === incomingToken);
    if (!tokenEntry) {
      // Token reuse detected — clear all sessions (possible token theft)
      await User.findByIdAndUpdate(decoded.id, { $set: { refreshTokens: [] } });
      clearAuthCookies(res);
      return res.status(401).json({ success: false, message: 'Refresh token reuse detected. All sessions cleared.' });
    }

    // Remove old token (rotation)
    await User.findByIdAndUpdate(decoded.id, {
      $pull: { refreshTokens: { token: incomingToken } },
    });

    // Issue new pair
    const accessToken = await issueTokenPair(user, res);

    return res.status(200).json({
      success: true,
      message: 'Tokens refreshed.',
      data: { accessToken },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 */
export const logout = async (req, res, next) => {
  try {
    const incomingToken = req.cookies?.refreshToken;

    if (incomingToken) {
      // Remove just this device's refresh token
      // req.user may be set if authenticate middleware was applied; fall back to decoding
      try {
        const decoded = verifyRefreshToken(incomingToken);
        await User.findByIdAndUpdate(decoded.id, {
          $pull: { refreshTokens: { token: incomingToken } },
        });
      } catch {
        // Token already expired — nothing to clean up in DB, still clear cookies
      }
    }

    clearAuthCookies(res);

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 * Requires authenticate middleware.
 */
export const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Authenticated user retrieved.',
    data: { user: req.user.toSafeObject() },
  });
};

/**
 * POST /api/auth/forgot-password
 */
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const user = await User.findByEmail(email);

    // Always return 200 to prevent email enumeration
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account exists for this email, a reset link has been sent.',
      });
    }

    const resetToken = generateOpaqueToken();
    const hashedResetToken = hashToken(resetToken);
    const resetExpires = new Date(
      Date.now() + Number(process.env.RESET_TOKEN_EXPIRES_IN || 3600000)
    );

    user.passwordResetToken = hashedResetToken;
    user.passwordResetExpires = resetExpires;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: 'If an account exists for this email, a reset link has been sent.',
      data: {
        // DEV ONLY — remove from production
        devResetToken: resetToken,
        resetUrl: `/api/auth/reset-password/${resetToken}`,
        expiresAt: resetExpires,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/reset-password/:token
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (!password || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'Password and confirmPassword are required.' });
    }

    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ success: false, message: pwError });

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    const hashedToken = hashToken(token);

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires +refreshTokens');

    if (!user) {
      return res.status(400).json({ success: false, message: 'Password reset token is invalid or has expired.' });
    }

    // Update password and clear all sessions + reset token
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokens = []; // Invalidate all existing sessions
    await user.save();

    clearAuthCookies(res);

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. Please log in with your new password.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/verify-email/:token
 */
export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;

    const hashedToken = hashToken(token);

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() },
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Email verification token is invalid or has expired.',
      });
    }

    if (user.emailVerified) {
      return res.status(200).json({
        success: true,
        message: 'Email is already verified.',
      });
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully.',
      data: { user: user.toSafeObject() },
    });
  } catch (err) {
    next(err);
  }
};
