import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { CommentComposer } from './CommentComposer';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

export const CommentThread = ({
  comment,
  replies = [],
  onEdit,
  onDelete,
  onReply,
}) => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isAuthor = user && comment.author && user._id === comment.author._id;
  const isAdmin = user && user.role === 'admin';
  const canEdit = !comment.isDeleted && (isAuthor || isAdmin);
  const canDelete = !comment.isDeleted && (isAuthor || isAdmin);

  const handleEditSubmit = async (content) => {
    setSubmitting(true);
    try {
      await onEdit(comment._id, content);
      setIsEditing(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplySubmit = async (content) => {
    setSubmitting(true);
    try {
      await onReply(comment._id, content);
      setIsReplying(false);
    } finally {
      setSubmitting(false);
    }
  };

  const renderContent = () => {
    if (comment.isDeleted) {
      return <p style={{ fontStyle: 'italic', color: 'var(--c-text-sec)' }}>{comment.content}</p>;
    }
    const html = DOMPurify.sanitize(marked.parse(comment.content));
    return (
      <div
        className="markdown-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };

  return (
    <div style={{
      marginTop: '1.5rem',
      paddingLeft: comment.parentComment ? '1.5rem' : '0',
      borderLeft: comment.parentComment ? '2px solid var(--c-surface-3)' : 'none',
    }}>
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {comment.author ? (
              <>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'var(--c-primary-500)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 'bold', fontSize: '0.875rem'
                }}>
                  {comment.author.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                    {comment.author.name}
                    {comment.author.role === 'admin' && (
                      <span className="badge badge--indigo" style={{ marginLeft: '0.5rem', fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>Admin</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--c-text-sec)' }}>
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--c-text-sec)' }}>
                [Deleted User]
              </div>
            )}
          </div>
          
          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {!comment.isDeleted && user && (
              <button
                className="btn btn--secondary"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                onClick={() => setIsReplying(!isReplying)}
              >
                Reply
              </button>
            )}
            {canEdit && (
              <button
                className="btn btn--secondary"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                onClick={() => setIsEditing(!isEditing)}
              >
                Edit
              </button>
            )}
            {canDelete && (
              <button
                className="btn"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'var(--c-rose-500)' }}
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this comment?')) {
                    onDelete(comment._id);
                  }
                }}
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {isEditing ? (
          <CommentComposer
            initialValue={comment.content}
            isEditing={true}
            onSubmit={handleEditSubmit}
            onCancel={() => setIsEditing(false)}
            submitting={submitting}
          />
        ) : (
          renderContent()
        )}
      </div>

      {isReplying && (
        <div style={{ paddingLeft: '2rem' }}>
          <CommentComposer
            isReply={true}
            onSubmit={handleReplySubmit}
            onCancel={() => setIsReplying(false)}
            submitting={submitting}
          />
        </div>
      )}

      {/* Render Replies recursively */}
      {replies && replies.length > 0 && (
        <div className="replies">
          {replies.map(reply => (
            <CommentThread
              key={reply._id}
              comment={reply}
              replies={reply.replies} // Assumes tree structure is pre-built
              onEdit={onEdit}
              onDelete={onDelete}
              onReply={onReply}
            />
          ))}
        </div>
      )}
    </div>
  );
};
