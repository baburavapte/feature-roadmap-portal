import { verifyAccessToken } from '../utils/jwt.js';
import User from '../models/User.js';

/**
 * authenticate — verify the access JWT and attach req.user.
 *
 * Reads the token from:
 *   1. Authorization header: "Bearer <token>"
 *   2. Falls back to req.cookies.accessToken (if ever used)
 *
 * Responds with 401 on missing/invalid/expired token.
 */
export const authenticate = async (req, res, next) => {
  try {
    let token;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No token provided.',
      });
    }

    // Throws if expired or invalid
    const decoded = verifyAccessToken(token);

    // Fetch fresh user from DB to ensure account still exists and get latest role
    const user = await User.findById(decoded.id).select('-password -refreshTokens -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Access token expired.',
        code: 'TOKEN_EXPIRED',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid access token.',
    });
  }
};

/**
 * requireRole — factory middleware for role-based access control.
 *
 * Usage: router.get('/admin', authenticate, requireRole('admin'), handler)
 *
 * @param {...string} roles - Allowed roles
 * @returns {import('express').RequestHandler}
 */
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}.`,
      });
    }

    next();
  };
};
