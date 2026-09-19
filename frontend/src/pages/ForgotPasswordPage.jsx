import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import AuthLayout from '../components/AuthLayout';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const data = await api.post('/api/auth/forgot-password', { email });
      setResult(data);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link."
    >
      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        {error && <div className="form-message form-message--error">{error}</div>}

        {result && (
          <div className="form-message form-message--success">
            <strong>{result.message}</strong>
            {result.data?.devResetToken && (
              <div className="dev-token-block">
                <span className="dev-label">DEV — Reset token:</span>
                <code className="dev-token">{result.data.devResetToken}</code>
                <span className="dev-label">Use at:</span>
                <code className="dev-token">/reset-password/{result.data.devResetToken}</code>
                <Link
                  to={`/reset-password/${result.data.devResetToken}`}
                  className="btn btn--ghost btn--sm"
                >
                  Reset password →
                </Link>
              </div>
            )}
          </div>
        )}

        {!result && (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="forgot-email">Email address</label>
              <input
                id="forgot-email"
                className="form-input"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                required
              />
            </div>

            <button id="forgot-submit" className="btn btn--primary" type="submit" disabled={loading}>
              {loading
                ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Sending…</>
                : 'Send reset link'}
            </button>
          </>
        )}

        <p className="auth-footer-text">
          Remember your password?{' '}
          <Link to="/login" className="auth-link">Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
