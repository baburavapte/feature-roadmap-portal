import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import api from './services/api';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import FeatureFeedPage from './pages/FeatureFeedPage';
import FeatureDetailPage from './pages/FeatureDetailPage';
import RoadmapPage from './pages/RoadmapPage';
import './index.css';

// ─── Task 1 Dashboard (preserved exactly, wrapped in layout) ──────────────────

function Dashboard() {
  const { user, logout, accessToken } = useAuth();
  const navigate = useNavigate();
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/api/health');
      setHealth(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getStatusBadge = () => {
    if (loading) return <span className="badge badge--loading"><span className="badge-dot" />Checking…</span>;
    if (error) return <span className="badge badge--error"><span className="badge-dot" />Offline</span>;
    return <span className="badge badge--success"><span className="badge-dot" />All Systems Online</span>;
  };

  const getDbBadge = () => {
    if (loading) return <span className="badge badge--loading"><span className="badge-dot" />Connecting…</span>;
    if (!health || health.database !== 'connected') return <span className="badge badge--error"><span className="badge-dot" />Disconnected</span>;
    return <span className="badge badge--success"><span className="badge-dot" />Connected</span>;
  };

  const formatUptime = (seconds) => {
    if (!seconds && seconds !== 0) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="header-brand">
            <div className="header-logo">F</div>
            <span className="header-title">Feature Roadmap Portal</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link to="/roadmap" className="btn btn--ghost btn--sm">Roadmap</Link>
            {getStatusBadge()}
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {user.name}
                  {user.role === 'admin' && (
                    <span className="badge badge--loading" style={{ marginLeft: 8, fontSize: 10 }}>admin</span>
                  )}
                </span>
                <button
                  id="logout-btn"
                  onClick={handleLogout}
                  style={{
                    padding: '6px 14px',
                    background: 'rgba(244,63,94,0.1)',
                    color: 'var(--rose-400)',
                    border: '1px solid rgba(244,63,94,0.2)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-family)',
                    transition: 'background 0.2s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(244,63,94,0.18)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(244,63,94,0.1)'}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="main">
        <div className="status-hero">
          <h1>System Status</h1>
          <p>Verifying frontend and backend connectivity for the Feature Roadmap Portal.</p>
        </div>

        {/* Auth Info Panel */}
        {user && (
          <div className="info-panel" style={{ marginBottom: 24 }}>
            <div className="info-panel-title">👤 Authenticated Session</div>
            <ul className="info-list">
              <li>
                <span className="info-list-icon">🪪</span>
                <span className="info-list-label">Name</span>
                <span>{user.name}</span>
              </li>
              <li>
                <span className="info-list-icon">📧</span>
                <span className="info-list-label">Email</span>
                <span>{user.email}</span>
              </li>
              <li>
                <span className="info-list-icon">🔑</span>
                <span className="info-list-label">Role</span>
                <span>{user.role}</span>
              </li>
              <li>
                <span className="info-list-icon">✉️</span>
                <span className="info-list-label">Email Verified</span>
                <span>{user.emailVerified ? '✓ Yes' : '✗ No'}</span>
              </li>
              <li>
                <span className="info-list-icon">🔒</span>
                <span className="info-list-label">Access Token</span>
                <span style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>
                  {accessToken ? `${accessToken.slice(0, 40)}…` : '—'}
                </span>
              </li>
            </ul>
          </div>
        )}

        {/* Status Cards */}
        <div className="status-grid">
          {/* Frontend Card */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Frontend</div>
                <div className="card-value">React + Vite</div>
              </div>
              <div className="card-icon card-icon--indigo">⚡</div>
            </div>
            <div className="card-detail">
              <span className="badge badge--success"><span className="badge-dot" />Running</span>
            </div>
          </div>

          {/* Backend Card */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Backend API</div>
                <div className="card-value">
                  {loading ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className="spinner" /> Checking…
                    </span>
                  ) : error ? 'Unreachable' : 'Express.js'}
                </div>
              </div>
              <div className={`card-icon ${error ? 'card-icon--amber' : 'card-icon--emerald'}`}>🔗</div>
            </div>
            <div className="card-detail">
              {error ? (
                <span className="badge badge--error"><span className="badge-dot" />{error}</span>
              ) : loading ? (
                <span className="badge badge--loading"><span className="badge-dot" />Connecting…</span>
              ) : (
                <span className="badge badge--success"><span className="badge-dot" />Connected</span>
              )}
            </div>
          </div>

          {/* Database Card */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Database</div>
                <div className="card-value">MongoDB</div>
              </div>
              <div className="card-icon card-icon--emerald">🗄️</div>
            </div>
            <div className="card-detail">{getDbBadge()}</div>
          </div>
        </div>

        {/* Health Details */}
        {health && !error && (
          <div className="info-panel">
            <div className="info-panel-title">📋 Health Check Response</div>
            <ul className="info-list">
              <li>
                <span className="info-list-icon">📡</span>
                <span className="info-list-label">Endpoint</span>
                <span>GET /api/health</span>
              </li>
              <li>
                <span className="info-list-icon">✅</span>
                <span className="info-list-label">Status</span>
                <span>{health.status}</span>
              </li>
              <li>
                <span className="info-list-icon">⏱️</span>
                <span className="info-list-label">Uptime</span>
                <span>{formatUptime(health.uptime)}</span>
              </li>
              <li>
                <span className="info-list-icon">🕐</span>
                <span className="info-list-label">Timestamp</span>
                <span>{new Date(health.timestamp).toLocaleString()}</span>
              </li>
              <li>
                <span className="info-list-icon">🗄️</span>
                <span className="info-list-label">Database</span>
                <span>{health.database}</span>
              </li>
            </ul>
          </div>
        )}

        {/* Error Retry */}
        {error && !loading && (
          <div className="info-panel" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Could not reach the backend API. Make sure the server is running on port 5000.
            </p>
            <button
              onClick={fetchHealth}
              style={{
                padding: '10px 24px',
                background: 'linear-gradient(135deg, var(--indigo-500), var(--indigo-600))',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-family)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              Retry Connection
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── App Router ───────────────────────────────────────────────────────────────

function App() {
  return (
    <Routes>
      {/* Public auth routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/verify-email/:token" element={<VerifyEmailPage />} />

      {/* Feature requests (public feed, auth optional) */}
      <Route path="/features" element={<FeatureFeedPage />} />
      <Route path="/features/:id" element={<FeatureDetailPage />} />
      <Route path="/roadmap" element={<RoadmapPage />} />

      {/* Protected system dashboard (Task 1) */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/features" replace />} />
    </Routes>
  );
}

export default App;
