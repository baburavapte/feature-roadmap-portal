const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * Set the httpOnly refresh-token cookie on the response.
 * @param {import('express').Response} res
 * @param {string} token - signed refresh JWT
 */
export const setRefreshTokenCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: IS_PROD,          // HTTPS only in production
    sameSite: 'lax',          // Protects against CSRF while allowing same-site redirects
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/',
  });
};

/**
 * Clear both auth cookies (refreshToken) on the response.
 * @param {import('express').Response} res
 */
export const clearAuthCookies = (res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/',
  });
};
