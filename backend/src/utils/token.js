import crypto from 'crypto';

/**
 * Generate a cryptographically random opaque token (hex, 64 chars).
 * Used for password reset and email verification tokens.
 * @returns {string}
 */
export const generateOpaqueToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Hash an opaque token for secure storage (SHA-256).
 * Store the hash in the DB; compare hashes when validating.
 * @param {string} token
 * @returns {string}
 */
export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};
