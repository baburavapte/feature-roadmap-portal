import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import AuthLayout from '../components/AuthLayout';

const ResetPasswordPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.post(`/api/auth/reset-password/${token}`, form);
      setSuccess(data.message || 'Password reset successfully!');
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.message || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Choose a new password" subtitle="Make it strong — at least 8 characters, 1 uppercase, 1 number.">
      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        {error && <div className="form-message form-message--error">{error}</div>}
        {success && (
          <div className="form-message form-message--success">
            <strong>{success}</strong>
            <span style={{ display: 'block', marginTop: 4, fontSize: 13, opacity: 0.8 }}>
              Redirecting to login…
            </span>
          </div>
        )}

        {!success && (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="reset-password">New password</label>
              <input
                id="reset-password"
                className="form-input"
                type="password"
                name="password"
                autoComplete="new-password"
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reset-confirm">Confirm new password</label>
              <input
                id="reset-confirm"
                className="form-input"
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="••••••••"
                value={form.confirmPassword}
                onChange={handleChange}
                required
              />
            </div>

            <button id="reset-submit" className="btn btn--primary" type="submit" disabled={loading}>
              {loading
                ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Resetting…</>
                : 'Reset password'}
            </button>
          </>
        )}

        <p className="auth-footer-text">
          <Link to="/login" className="auth-link">← Back to login</Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default ResetPasswordPage;
