import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import CreateFeatureModal from '../components/CreateFeatureModal';

const CATEGORIES = ['UI/UX', 'Integrations', 'Performance', 'General'];
const STATUSES = ['Under Review', 'Planned', 'In Progress', 'Completed'];

const STATUS_COLORS = {
  'Under Review': 'badge--loading',
  'Planned':      'badge--indigo',
  'In Progress':  'badge--info',
  'Completed':    'badge--success',
};

const CAT_COLORS = {
  'UI/UX':        'cat--indigo',
  'Integrations': 'cat--emerald',
  'Performance':  'cat--amber',
  'General':      'cat--rose',
};

const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

// ─── Vote Button ──────────────────────────────────────────────────────────────

const VoteButton = ({ featureId, initialCount, initialVoted, user, accessToken, onLoginPrompt }) => {
  const [voteCount, setVoteCount] = useState(initialCount);
  const [voted,     setVoted]     = useState(initialVoted);
  const [pending,   setPending]   = useState(false);

  // Sync if parent refreshes the feed
  useEffect(() => {
    setVoteCount(initialCount);
    setVoted(initialVoted);
  }, [initialCount, initialVoted]);

  const handleVote = async (e) => {
    e.preventDefault(); // don't navigate via the parent <Link>
    e.stopPropagation();

    if (!user) {
      onLoginPrompt();
      return;
    }
    if (pending) return;

    // Optimistic update
    const prevCount = voteCount;
    const prevVoted = voted;
    setVoted(!voted);
    setVoteCount(voted ? voteCount - 1 : voteCount + 1);
    setPending(true);

    try {
      const data = await api.toggleFeatureVote(featureId, accessToken);
      // Server truth
      setVoted(data.data.voted);
      setVoteCount(data.data.voteCount);
    } catch {
      // Rollback
      setVoted(prevVoted);
      setVoteCount(prevCount);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      className={`vote-btn${voted ? ' vote-btn--voted' : ''}`}
      onClick={handleVote}
      disabled={pending}
      title={user ? (voted ? 'Remove vote' : 'Upvote') : 'Sign in to vote'}
      aria-label={`${voted ? 'Remove vote' : 'Upvote'} (${voteCount} votes)`}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill={voted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
      </svg>
      <span>{voteCount}</span>
    </button>
  );
};

// ─── Login Prompt Toast ───────────────────────────────────────────────────────

const LoginPrompt = ({ onClose }) => (
  <div className="login-prompt" role="alert">
    <span>Sign in to vote on feature requests</span>
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      <Link to="/login"  className="btn btn--primary btn--sm" onClick={onClose}>Sign in</Link>
      <Link to="/signup" className="btn btn--ghost  btn--sm" onClick={onClose}>Sign up</Link>
    </div>
    <button className="login-prompt-close" onClick={onClose} aria-label="Dismiss">✕</button>
  </div>
);

// ─── Feature Card ─────────────────────────────────────────────────────────────

const FeatureCard = ({ feature, user, accessToken, onLoginPrompt }) => {
  const shortDesc = feature.description.length > 160
    ? feature.description.slice(0, 160).replace(/[*#`_[\]]/g, '') + '…'
    : feature.description.replace(/[*#`_[\]]/g, '');

  return (
    <div className="feature-card-wrap">
      <VoteButton
        featureId={feature._id}
        initialCount={feature.voteCount}
        initialVoted={!!feature.hasVoted}
        user={user}
        accessToken={accessToken}
        onLoginPrompt={onLoginPrompt}
      />
      <Link to={`/features/${feature._id}`} className="feature-card feature-card--inner" id={`feature-${feature._id}`}>
        {/* Top row */}
        <div className="feature-card-top">
          <span className={`cat-pill ${CAT_COLORS[feature.category] || 'cat--indigo'}`}>
            {feature.category}
          </span>
          <span className={`badge ${STATUS_COLORS[feature.status] || 'badge--loading'}`}>
            <span className="badge-dot" />
            {feature.status}
          </span>
        </div>

        {/* Title */}
        <h3 className="feature-card-title">{feature.title}</h3>

        {/* Description preview */}
        <p className="feature-card-desc">{shortDesc}</p>

        {/* Footer */}
        <div className="feature-card-footer">
          <span className="feature-card-author">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            {feature.author?.name || 'Unknown'}
          </span>

          <div className="feature-card-stats">
            <span className="feature-stat" title="Comments">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              {feature.commentCount}
            </span>
            <span className="feature-card-time">{timeAgo(feature.createdAt)}</span>
          </div>
        </div>
      </Link>
    </div>
  );
};

// ─── Pagination ───────────────────────────────────────────────────────────────

const Pagination = ({ page, totalPages, onPage }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination">
      <button className="btn btn--ghost btn--sm" disabled={page <= 1}      onClick={() => onPage(page - 1)}>← Prev</button>
      <span className="pagination-info">Page {page} of {totalPages}</span>
      <button className="btn btn--ghost btn--sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next →</button>
    </div>
  );
};

// ─── FeatureFeedPage ──────────────────────────────────────────────────────────

const FeatureFeedPage = () => {
  const { user, logout, accessToken } = useAuth();
  const navigate = useNavigate();

  const [features,   setFeatures]   = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  const [search,          setSearch]          = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category,        setCategory]        = useState('');
  const [status,          setStatus]          = useState('');
  const [sort,            setSort]            = useState('newest');
  const [page,            setPage]            = useState(1);

  const [modalOpen,    setModalOpen]    = useState(false);
  const [successMsg,   setSuccessMsg]   = useState('');
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // Debounce search (500ms)
  const debounceTimer = useRef(null);
  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(debounceTimer.current);
  }, [search]);

  const fetchFeatures = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 10, sort };
      if (category)        params.category = category;
      if (status)          params.status   = status;
      if (debouncedSearch) params.search   = debouncedSearch;

      const data = await api.getFeatureRequests(params);
      setFeatures(data.data.features);
      setPagination(data.data.pagination);
    } catch (err) {
      setError(err.message || 'Failed to load feature requests.');
    } finally {
      setLoading(false);
    }
  }, [page, sort, category, status, debouncedSearch]);

  useEffect(() => { fetchFeatures(); }, [fetchFeatures]);

  const handleFilter = (setter) => (e) => { setter(e.target.value); setPage(1); };

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const handleSuccess = (feature) => {
    setSuccessMsg(`"${feature.title}" submitted successfully!`);
    fetchFeatures();
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-content">
          <div className="header-brand">
            <div className="header-logo">F</div>
            <div>
              <span className="header-title">Feature Roadmap Portal</span>
              <span className="header-subtitle">Vote · Discuss · Shape the roadmap</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to="/roadmap" className="btn btn--ghost btn--sm">Roadmap</Link>
            {user ? (
              <>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{user.name}</span>
                <Link to="/" className="btn btn--ghost btn--sm">Dashboard</Link>
                <button className="btn btn--sm" id="feed-logout-btn"
                  style={{ background: 'rgba(244,63,94,0.1)', color: 'var(--rose-400)', border: '1px solid rgba(244,63,94,0.2)' }}
                  onClick={handleLogout}>Sign out</button>
              </>
            ) : (
              <>
                <Link to="/login"  className="btn btn--ghost btn--sm">Sign in</Link>
                <Link to="/signup" className="btn btn--primary btn--sm">Sign up</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="main" style={{ maxWidth: 900 }}>

        {/* ── Hero ── */}
        <div className="feed-hero">
          <h1>Feature Requests</h1>
          <p>Browse community ideas, vote for what matters, and submit your own.</p>
          {user ? (
            <button id="open-create-modal" className="btn btn--primary" onClick={() => setModalOpen(true)}>
              + Submit a Feature Request
            </button>
          ) : (
            <Link to="/login" className="btn btn--primary">Sign in to Submit</Link>
          )}
        </div>

        {/* ── Login prompt toast ── */}
        {showLoginPrompt && <LoginPrompt onClose={() => setShowLoginPrompt(false)} />}

        {/* ── Success toast ── */}
        {successMsg && (
          <div className="form-message form-message--success" style={{ marginBottom: 16 }}>✓ {successMsg}</div>
        )}

        {/* ── Controls ── */}
        <div className="feed-controls">
          <div className="feed-search-wrap">
            <svg className="feed-search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input id="feed-search" className="form-input feed-search" type="text"
              placeholder="Search features…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && <button className="feed-search-clear" onClick={() => setSearch('')}>✕</button>}
          </div>

          <div className="feed-filters">
            <select id="feed-category" className="form-input form-select feed-select" value={category} onChange={handleFilter(setCategory)}>
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select id="feed-status" className="form-input form-select feed-select" value={status} onChange={handleFilter(setStatus)}>
              <option value="">All Statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select id="feed-sort" className="form-input form-select feed-select" value={sort} onChange={handleFilter(setSort)}>
              <option value="newest">Newest</option>
              <option value="upvoted">Most Upvoted</option>
              <option value="discussed">Most Discussed</option>
            </select>
          </div>
        </div>

        {/* Results count */}
        {!loading && !error && (
          <div className="feed-meta">
            {pagination.total} result{pagination.total !== 1 ? 's' : ''}
            {debouncedSearch && ` for "${debouncedSearch}"`}
            {category && ` in ${category}`}
            {status && ` · ${status}`}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="feed-state">
            <span className="spinner" style={{ width: 32, height: 32 }} />
            <span>Loading feature requests…</span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="feed-state">
            <div className="form-message form-message--error" style={{ width: '100%' }}>
              {error}
              <button className="btn btn--ghost btn--sm" style={{ marginTop: 8 }} onClick={fetchFeatures}>Retry</button>
            </div>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && features.length === 0 && (
          <div className="feed-empty">
            <div className="feed-empty-icon">💡</div>
            <h3>No feature requests found</h3>
            <p>{debouncedSearch || category || status
              ? 'Try adjusting your search or filters.'
              : 'Be the first to submit a feature request!'}</p>
            {user && <button className="btn btn--primary" onClick={() => setModalOpen(true)}>+ Submit a Feature Request</button>}
          </div>
        )}

        {/* Feed */}
        {!loading && !error && features.length > 0 && (
          <>
            <div className="feature-feed">
              {features.map((f) => (
                <FeatureCard
                  key={f._id}
                  feature={f}
                  user={user}
                  accessToken={accessToken}
                  onLoginPrompt={() => setShowLoginPrompt(true)}
                />
              ))}
            </div>
            <Pagination page={pagination.page} totalPages={pagination.totalPages} onPage={setPage} />
          </>
        )}
      </main>

      <CreateFeatureModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSuccess={handleSuccess} />
    </div>
  );
};

export default FeatureFeedPage;
