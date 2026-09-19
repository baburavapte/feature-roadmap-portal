import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const STATUS_COLORS = {
  'Under Review': 'badge--loading',
  'Planned':      'badge--indigo',
  'In Progress':  'badge--info',
};

const CAT_COLORS = {
  'UI/UX':        'cat--indigo',
  'Integrations': 'cat--emerald',
  'Performance':  'cat--amber',
  'General':      'cat--rose',
};

// Minimal Feature Card for Roadmap
const RoadmapCard = ({ feature }) => {
  const shortDesc = feature.description.length > 100
    ? feature.description.slice(0, 100).replace(/[*#`_[\]]/g, '') + '…'
    : feature.description.replace(/[*#`_[\]]/g, '');

  return (
    <Link to={`/features/${feature._id}`} className="feature-card feature-card--inner" style={{ marginBottom: '1rem', display: 'block' }}>
      <div className="feature-card-top">
        <span className={`cat-pill ${CAT_COLORS[feature.category] || 'cat--indigo'}`}>
          {feature.category}
        </span>
      </div>
      <h3 className="feature-card-title" style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>{feature.title}</h3>
      <p className="feature-card-desc" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>{shortDesc}</p>
      
      <div className="feature-card-footer" style={{ marginTop: 'auto' }}>
        {feature.author && (
          <span className="feature-card-author">
             <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{marginRight: 4}}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            {feature.author.name}
          </span>
        )}
        <div className="feature-card-stats" style={{ gap: '12px' }}>
          <span className="feature-stat" title="Votes">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: 4}}>
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
            </svg>
            {feature.voteCount}
          </span>
          <span className="feature-stat" title="Comments">
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{marginRight: 4}}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {feature.commentCount}
          </span>
        </div>
      </div>
    </Link>
  );
};

const RoadmapColumn = ({ title, status, features, loading }) => {
  return (
    <div className="roadmap-column" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, minWidth: '280px' }}>
      <div className="roadmap-column-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '0.5rem', borderBottom: '2px solid var(--border-color)', marginBottom: '1rem' }}>
        <span className={`badge ${STATUS_COLORS[status] || 'badge--loading'}`}>
          <span className="badge-dot" />
          {title}
        </span>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
          {loading ? '...' : features.length}
        </span>
      </div>
      
      <div className="roadmap-column-content">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--c-text-sec)' }}>
            <span className="spinner" style={{ width: 24, height: 24, margin: '0 auto 1rem' }} />
          </div>
        ) : features.length > 0 ? (
          features.map(f => <RoadmapCard key={f._id} feature={f} />)
        ) : (
          <div className="feed-empty" style={{ padding: '2rem 1rem', background: 'var(--surface)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
             <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>No features in this stage.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const RoadmapPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [columns, setColumns] = useState({
    'Under Review': [],
    'Planned': [],
    'In Progress': []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRoadmap = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch 3 columns concurrently
      const [underReview, planned, inProgress] = await Promise.all([
        api.getFeatureRequests({ status: 'Under Review', limit: 50 }),
        api.getFeatureRequests({ status: 'Planned', limit: 50 }),
        api.getFeatureRequests({ status: 'In Progress', limit: 50 })
      ]);
      
      setColumns({
        'Under Review': underReview.data.features,
        'Planned': planned.data.features,
        'In Progress': inProgress.data.features
      });
    } catch (err) {
      setError(err.message || 'Failed to load roadmap.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoadmap();
  }, [fetchRoadmap]);

  const handleLogout = async () => { 
    await logout(); 
    navigate('/login'); 
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to="/features" className="btn btn--ghost btn--sm">Feature Feed</Link>
            {user ? (
              <>
                <Link to="/" className="btn btn--ghost btn--sm">Dashboard</Link>
                <button className="btn btn--sm"
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

      <main className="main" style={{ maxWidth: 1200 }}>
        <div className="feed-hero" style={{ marginBottom: '2rem' }}>
          <h1>Public Roadmap</h1>
          <p>See what we're working on and what's coming next.</p>
        </div>

        {error && !loading && (
          <div className="feed-state">
            <div className="form-message form-message--error" style={{ width: '100%', maxWidth: 600 }}>
              {error}
              <button className="btn btn--ghost btn--sm" style={{ marginTop: 8 }} onClick={fetchRoadmap}>Retry</button>
            </div>
          </div>
        )}

        {!error && (
          <div className="roadmap-grid" style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '24px', 
            alignItems: 'flex-start' 
          }}>
            <RoadmapColumn 
              title="Under Review" 
              status="Under Review"
              features={columns['Under Review']} 
              loading={loading} 
            />
            <RoadmapColumn 
              title="Planned" 
              status="Planned"
              features={columns['Planned']} 
              loading={loading} 
            />
            <RoadmapColumn 
              title="In Progress" 
              status="In Progress"
              features={columns['In Progress']} 
              loading={loading} 
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default RoadmapPage;
