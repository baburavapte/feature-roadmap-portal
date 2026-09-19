import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

// Configure marked to be safe and use breaks
marked.setOptions({
  gfm: true,
  breaks: true,
});

export const CommentComposer = ({
  onSubmit,
  onCancel,
  initialValue = '',
  isEditing = false,
  isReply = false,
  submitting = false,
}) => {
  const [content, setContent] = useState(initialValue);
  const [error, setError] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
        <p style={{ color: 'var(--c-text-sec)', marginBottom: '1rem' }}>
          Please log in to join the discussion.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Comment cannot be empty.');
      return;
    }
    setError('');
    await onSubmit(content);
    if (!isEditing) {
      setContent('');
      setPreviewMode(false);
    }
  };

  const renderPreview = () => {
    if (!content.trim()) return <p style={{ color: 'var(--c-text-sec)', padding: '0.75rem' }}>Nothing to preview.</p>;
    const html = DOMPurify.sanitize(marked.parse(content));
    return (
      <div
        className="markdown-content"
        style={{ padding: '0.75rem', minHeight: '120px', border: '1px solid transparent' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };

  return (
    <div style={{ marginBottom: isReply ? '0' : '2rem', marginTop: isReply ? '1rem' : '0' }}>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn--secondary"
            style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', ...( !previewMode ? { background: 'var(--c-surface-3)' } : {}) }}
            onClick={() => setPreviewMode(false)}
          >
            Write
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', ...( previewMode ? { background: 'var(--c-surface-3)' } : {}) }}
            onClick={() => setPreviewMode(true)}
          >
            Preview
          </button>
        </div>

        {previewMode ? (
          <div className="input" style={{ minHeight: '120px', background: 'var(--c-surface-2)', padding: 0 }}>
            {renderPreview()}
          </div>
        ) : (
          <textarea
            className="input"
            rows="4"
            placeholder="Write your comment... (Markdown supported)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={submitting}
          />
        )}

        {error && <div style={{ color: 'var(--c-rose-500)', fontSize: '0.875rem', marginTop: '0.5rem' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
          {onCancel && (
            <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={submitting}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn btn--primary" disabled={submitting || !content.trim()}>
            {submitting ? 'Submitting...' : (isEditing ? 'Save Changes' : (isReply ? 'Reply' : 'Post Comment'))}
          </button>
        </div>
      </form>
    </div>
  );
};
