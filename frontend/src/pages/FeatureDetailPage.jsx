import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { CommentComposer } from '../components/CommentComposer';
import { CommentThread } from '../components/CommentThread';

const CATEGORIES = ['UI/UX', 'Integrations', 'Performance', 'General'];
const VALID_STATUSES = ['Under Review', 'Planned', 'In Progress', 'Completed'];

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

const formatDate = (d) =>
  new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

// ─── Safe Markdown renderer ──────────────────────────────────────────────────
const renderMarkdown = (text) => {
  if (!text) return '';
  return DOMPurify.sanitize(marked.parse(text));
};

// ─── Edit Form ────────────────────────────────────────────────────────────────
const EditForm = ({ feature, accessToken, onSave, onCancel }) => {
  const [form, setForm] = useState({
    title: feature.title,
    description: feature.description,
    category: feature.category,
  });
  const [error,  setError]  = useState('');
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim())       return setError('Title is required.');
    if (!form.description.trim()) return setError('Description is required.');
    if (!CATEGORIES.includes(form.category)) return setError('Please select a valid category.');
    setSaving(true);
    try {
      const data = await api.updateFeatureRequest(feature._id, form, accessToken);
      onSave(data.data.feature);
    } catch (err) {
      setError(err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form" noValidate>
      {error && <div className="form-message form-message--error">{error}</div>}
      <div className="form-group">
        <label className="form-label" htmlFor="edit-title">Title</label>
        <input id="edit-title" className="form-input" type="text" name="title"
          value={form.title} onChange={handleChange} maxLength={200} required />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="edit-category">Category</label>
        <select id="edit-category" className="form-input form-select" name="category"
          value={form.category} onChange={handleChange} required>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="edit-desc">
          Description <span className="form-label-hint">Markdown supported</span>
        </label>
        <textarea id="edit-desc" className="form-input form-textarea" name="description"
          value={form.description} onChange={handleChange} rows={10} required />
      </div>
      <div className="modal-footer" style={{ padding: 0, border: 'none' }}>
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>Cancel</button>
        <button id="edit-save-btn" type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Saving…</> : 'Save Changes'}
        </button>
      </div>
    </form>
  );
};

// ─── Admin Status Control ─────────────────────────────────────────────────────
const AdminStatusControl = ({ featureId, currentStatus, accessToken, onStatusChange }) => {
  const [status,  setStatus]  = useState(currentStatus);
  const [saving,  setSaving]  = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  // Keep in sync if feature refreshes
  useEffect(() => { setStatus(currentStatus); }, [currentStatus]);

  const handleChange = async (e) => {
    const newStatus = e.target.value;
    setStatus(newStatus);
    setSaving(true);
    setMessage('');
    setIsError(false);
    try {
      const data = await api.updateFeatureStatus(featureId, newStatus, accessToken);
      onStatusChange(data.data.feature.status);
      setMessage(`Status updated to "${newStatus}"`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setIsError(true);
      setMessage(err.message || 'Failed to update status.');
      setStatus(currentStatus); // revert
      setTimeout(() => setMessage(''), 4000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-status-control">
      <div className="admin-status-label">
        <span className="admin-badge">⚙ Admin</span>
        <span>Status Control</span>
      </div>
      <div className="admin-status-row">
        <select
          id="admin-status-select"
          className="form-input form-select"
          style={{ maxWidth: 200 }}
          value={status}
          onChange={handleChange}
          disabled={saving}
        >
          {VALID_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {saving && <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />}
      </div>
      {message && (
        <div className={`form-message ${isError ? 'form-message--error' : 'form-message--success'}`}
          style={{ marginTop: 8, padding: '8px 12px', fontSize: 13 }}>
          {message}
        </div>
      )}
    </div>
  );
};

// ─── Vote Button (detail page) ────────────────────────────────────────────────
const DetailVoteButton = ({ featureId, initialCount, initialVoted, user, accessToken, onLoginRedirect }) => {
  const [voteCount, setVoteCount] = useState(initialCount);
  const [voted,     setVoted]     = useState(initialVoted);
  const [pending,   setPending]   = useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => {
    setVoteCount(initialCount);
    setVoted(initialVoted);
  }, [initialCount, initialVoted]);

  const handleVote = async () => {
    if (!user) { onLoginRedirect(); return; }
    if (pending) return;

    const prevCount = voteCount;
    const prevVoted = voted;
    setVoted(!voted);
    setVoteCount(voted ? voteCount - 1 : voteCount + 1);
    setPending(true);
    setError('');

    try {
      const data = await api.toggleFeatureVote(featureId, accessToken);
      setVoted(data.data.voted);
      setVoteCount(data.data.voteCount);
    } catch (err) {
      setVoted(prevVoted);
      setVoteCount(prevCount);
      setError(err.message || 'Vote failed. Try again.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="detail-vote-wrap">
      <button
        id="detail-vote-btn"
        className={`detail-vote-btn${voted ? ' detail-vote-btn--voted' : ''}`}
        onClick={handleVote}
        disabled={pending}
        title={user ? (voted ? 'Remove vote' : 'Upvote this feature') : 'Sign in to vote'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill={voted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
        </svg>
        <span className="detail-vote-label">
          {voted ? 'Voted' : 'Upvote'}
        </span>
        <span className="detail-vote-count">{voteCount}</span>
      </button>
      {error && <div className="form-message form-message--error" style={{ marginTop: 8, fontSize: 13 }}>{error}</div>}
      {!user && (
        <Link to="/login" className="btn btn--ghost btn--sm" style={{ marginTop: 8 }}>Sign in to vote</Link>
      )}
    </div>
  );
};

// ─── FeatureDetailPage ────────────────────────────────────────────────────────
const FeatureDetailPage = () => {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { user, accessToken, logout } = useAuth();

  const [feature,     setFeature]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [editing,     setEditing]     = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [comments,    setComments]    = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  const isAuthor = user && feature && feature.author?._id === user.id;
  const isAdmin  = user?.role === 'admin';

  const fetchFeature = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getFeatureRequestById(id);
      setFeature(data.data.feature);
    } catch (err) {
      setError(err.message || 'Failed to load feature request.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const data = await api.getComments(id);
      setComments(data.data.comments);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setCommentsLoading(false);
    }
  }, [id]);

  useEffect(() => { 
    fetchFeature(); 
    fetchComments();
  }, [fetchFeature, fetchComments]);

  const handleSave = (updated) => {
    setFeature(updated);
    setEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleStatusChange = (newStatus) => {
    setFeature((prev) => ({ ...prev, status: newStatus }));
  };

  const handleCommentSubmit = async (content) => {
    await api.createComment(id, { content }, accessToken);
    setFeature((prev) => ({ ...prev, commentCount: prev.commentCount + 1 }));
    await fetchComments();
  };

  const handleCommentReply = async (parentId, content) => {
    await api.createComment(id, { content, parentComment: parentId }, accessToken);
    setFeature((prev) => ({ ...prev, commentCount: prev.commentCount + 1 }));
    await fetchComments();
  };

  const handleCommentEdit = async (commentId, content) => {
    await api.updateComment(commentId, { content }, accessToken);
    await fetchComments();
  };

  const handleCommentDelete = async (commentId) => {
    await api.deleteComment(commentId, accessToken);
    setFeature((prev) => ({ ...prev, commentCount: Math.max(0, prev.commentCount - 1) }));
    await fetchComments();
  };

  // Build comment tree
  const buildCommentTree = (flatComments) => {
    const map = {};
    const roots = [];
    flatComments.forEach((c) => { map[c._id] = { ...c, replies: [] }; });
    flatComments.forEach((c) => {
      if (c.parentComment && map[c.parentComment]) {
        map[c.parentComment].replies.push(map[c._id]);
      } else {
        roots.push(map[c._id]);
      }
    });
    return roots;
  };

  const commentTree = buildCommentTree(comments);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="header-brand">
            <div className="header-logo">F</div>
            <span className="header-title">Feature Roadmap Portal</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to="/features" className="btn btn--ghost btn--sm">← Back to Feed</Link>
            {user && (
              <button className="btn btn--sm"
                style={{ background: 'rgba(244,63,94,0.1)', color: 'var(--rose-400)', border: '1px solid rgba(244,63,94,0.2)' }}
                onClick={handleLogout}>Sign out</button>
            )}
          </div>
        </div>
      </header>

      <main className="main" style={{ maxWidth: 800 }}>
        {/* Loading */}
        {loading && (
          <div className="feed-state">
            <span className="spinner" style={{ width: 32, height: 32 }} />
            <span>Loading…</span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="feed-state">
            <div className="form-message form-message--error" style={{ width: '100%' }}>
              {error}
              <button className="btn btn--ghost btn--sm" style={{ marginTop: 8 }} onClick={fetchFeature}>Retry</button>
            </div>
          </div>
        )}

        {/* Content */}
        {!loading && !error && feature && (
          <>
            {saveSuccess && (
              <div className="form-message form-message--success" style={{ marginBottom: 20 }}>
                ✓ Changes saved successfully.
              </div>
            )}

            {/* Detail card */}
            <div className="detail-card">
              {editing ? (
                <EditForm feature={feature} accessToken={accessToken} onSave={handleSave} onCancel={() => setEditing(false)} />
              ) : (
                <>
                  {/* Badges */}
                  <div className="detail-badges">
                    <span className={`cat-pill ${CAT_COLORS[feature.category] || 'cat--indigo'}`}>
                      {feature.category}
                    </span>
                    <span className={`badge ${STATUS_COLORS[feature.status] || 'badge--loading'}`}>
                      <span className="badge-dot" />{feature.status}
                    </span>
                  </div>

                  {/* Title */}
                  <h1 className="detail-title">{feature.title}</h1>

                  {/* Meta */}
                  <div className="detail-meta">
                    <span>
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                      </svg>
                      {feature.author?.name || 'Unknown'}
                    </span>
                    <span>·</span>
                    <span>{formatDate(feature.createdAt)}</span>
                    {feature.updatedAt !== feature.createdAt && (
                      <span style={{ opacity: 0.6 }}>· edited</span>
                    )}
                  </div>

                  {/* Voting + stats row */}
                  <div className="detail-actions">
                    <DetailVoteButton
                      featureId={feature._id}
                      initialCount={feature.voteCount}
                      initialVoted={!!feature.hasVoted}
                      user={user}
                      accessToken={accessToken}
                      onLoginRedirect={() => navigate('/login')}
                    />
                    <div className="detail-stats" style={{ border: 'none', marginBottom: 0, paddingBottom: 0 }}>
                      <span className="feature-stat">
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        {feature.commentCount} comment{feature.commentCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: 'var(--border-color)', margin: '20px 0' }} />

                  {/* Admin status control */}
                  {isAdmin && (
                    <AdminStatusControl
                      featureId={feature._id}
                      currentStatus={feature.status}
                      accessToken={accessToken}
                      onStatusChange={handleStatusChange}
                    />
                  )}

                  {/* Author edit button */}
                  {isAuthor && !isAdmin && (
                    <button id="edit-feature-btn" className="btn btn--ghost btn--sm"
                      style={{ marginBottom: 20 }} onClick={() => setEditing(true)}>
                      ✏️ Edit
                    </button>
                  )}
                  {isAuthor && isAdmin && (
                    <button id="edit-feature-btn" className="btn btn--ghost btn--sm"
                      style={{ marginBottom: 20, marginTop: 12 }} onClick={() => setEditing(true)}>
                      ✏️ Edit
                    </button>
                  )}

                  {/* Description */}
                  <div className="detail-description">
                    <div
                      className="markdown-body"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(feature.description) }}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Comments Section */}
            <div className="detail-card" style={{ marginTop: 24 }}>
              <h3>Discussion ({feature.commentCount})</h3>
              <div style={{ marginTop: '1.5rem', marginBottom: '2rem' }}>
                <CommentComposer onSubmit={handleCommentSubmit} />
              </div>
              
              {commentsLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--c-text-sec)' }}>
                  <span className="spinner" style={{ width: 24, height: 24, margin: '0 auto 1rem' }} />
                  <div>Loading comments...</div>
                </div>
              ) : commentTree.length > 0 ? (
                <div className="comments-list">
                  {commentTree.map(comment => (
                    <CommentThread
                      key={comment._id}
                      comment={comment}
                      replies={comment.replies}
                      onEdit={handleCommentEdit}
                      onDelete={handleCommentDelete}
                      onReply={handleCommentReply}
                    />
                  ))}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--c-text-sec)' }}>
                  No comments yet. Be the first to share your thoughts!
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default FeatureDetailPage;
