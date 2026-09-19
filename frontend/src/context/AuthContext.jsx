import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

/**
 * AuthProvider — wraps the app and provides auth state + methods.
 *
 * Access token lives in memory only (never localStorage/sessionStorage).
 * Refresh token lives in an httpOnly cookie managed by the server.
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true); // true while hydrating on mount

  /**
   * Silently refresh tokens using the httpOnly refresh cookie.
   * Returns the new access token on success, null on failure.
   */
  const silentRefresh = useCallback(async () => {
    try {
      const data = await api.post('/api/auth/refresh', {});
      if (data?.data?.accessToken) {
        setAccessToken(data.data.accessToken);
        return data.data.accessToken;
      }
    } catch {
      // Refresh token expired or missing — user must log in
      setUser(null);
      setAccessToken(null);
    }
    return null;
  }, []);

  /**
   * Fetch current user from /api/auth/me using the access token.
   * Called on mount to hydrate auth state.
   */
  const fetchMe = useCallback(async (token) => {
    try {
      const data = await api.getWithToken('/api/auth/me', token);
      if (data?.data?.user) {
        setUser(data.data.user);
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }, []);

  /**
   * On mount: try to get a fresh access token via silent refresh,
   * then fetch the current user profile.
   */
  useEffect(() => {
    const hydrate = async () => {
      setLoading(true);
      try {
        const token = await silentRefresh();
        if (token) {
          await fetchMe(token);
        }
      } finally {
        setLoading(false);
      }
    };
    hydrate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Login — call the API, store token in memory, set user.
   * @param {{ email: string, password: string }} credentials
   */
  const login = useCallback(async (credentials) => {
    const data = await api.post('/api/auth/login', credentials);
    if (data?.data?.accessToken) {
      setAccessToken(data.data.accessToken);
      setUser(data.data.user);
    }
    return data;
  }, []);

  /**
   * Signup — create account.
   * @param {{ name: string, email: string, password: string, confirmPassword: string }} formData
   */
  const signup = useCallback(async (formData) => {
    const data = await api.post('/api/auth/signup', formData);
    return data;
  }, []);

  /**
   * Logout — invalidate server session and clear local state.
   */
  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout', {});
    } finally {
      setUser(null);
      setAccessToken(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, accessToken, loading, login, signup, logout, silentRefresh, setAccessToken, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * useAuth — consume the auth context.
 * Must be used inside an AuthProvider.
 */
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

export default AuthContext;
