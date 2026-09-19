import { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import AuthLayout from '../components/AuthLayout';

const VerifyEmailPage = () => {
  const { token } = useParams();
  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
  const [message, setMessage] = useState('');
  const didVerify = useRef(false); // Prevent double-call in React StrictMode

  useEffect(() => {
    if (didVerify.current) return; // Already ran
    didVerify.current = true;

    const verify = async () => {
      try {
        const data = await api.post(`/api/auth/verify-email/${token}`, {});
        setMessage(data.message || 'Email verified successfully!');
        setStatus('success');
      } catch (err) {
        setMessage(err.message || 'Verification failed. The link may have expired.');
        setStatus('error');
      }
    };

    if (token) verify();
    else {
      setMessage('No verification token provided.');
      setStatus('error');
    }
  }, [token]);

  return (
    <AuthLayout title="Email Verification" subtitle="Verifying your email address…">
      <div className="auth-form">
        {status === 'verifying' && (
          <div className="form-message form-message--loading">
            <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
            <span>Verifying your email…</span>
          </div>
        )}

        {status === 'success' && (
          <div className="form-message form-message--success">
            <strong>✓ {message}</strong>
            <Link to="/login" className="btn btn--primary" style={{ marginTop: 16, textAlign: 'center' }}>
              Sign in →
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="form-message form-message--error">
            <strong>✗ {message}</strong>
            <p className="auth-footer-text" style={{ marginTop: 12 }}>
              <Link to="/signup" className="auth-link">Try signing up again</Link>
            </p>
          </div>
        )}
      </div>
    </AuthLayout>
  );
};

export default VerifyEmailPage;
