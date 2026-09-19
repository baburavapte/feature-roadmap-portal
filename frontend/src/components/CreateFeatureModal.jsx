import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const CATEGORIES = ['UI/UX', 'Integrations', 'Performance', 'General'];

/**
 * CreateFeatureModal — modal form to submit a new feature request.
 *
 * @param {{ isOpen: boolean, onClose: () => void, onSuccess: (feature) => void }} props
 */
const CreateFeatureModal = ({ isOpen, onClose, onSuccess }) => {
  const { accessToken } = useAuth();
  const [form, setForm] = useState({ title: '', description: '', category: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const titleRef = useRef(null);

  // Focus title on open
  useEffect(() => {
    if (isOpen) {
      setForm({ title: '', description: '', category: '' });
      setError('');
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.title.trim()) return setError('Title is required.');
    if (form.title.trim().length < 5) return setError('Title must be at least 5 characters.');
    if (!form.description.trim()) return setError('Description is required.');
    if (form.description.trim().length < 10) return setError('Description must be at least 10 characters.');
    if (!form.category) return setError('Please select a category.');

    setLoading(true);
    try {
      const data = await api.createFeatureRequest(form, accessToken);
      onSuccess(data.data.feature);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to submit feature request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        {/* Header */}
        <div className="modal-header">
          <h2 id="modal-title" className="modal-title">Submit a Feature Request</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="modal-body auth-form" noValidate>
          {error && <div className="form-message form-message--error">{error}</div>}

          <div className="form-group">
            <label className="form-label" htmlFor="fr-title">Title</label>
            <input
              id="fr-title"
              ref={titleRef}
              className="form-input"
              type="text"
              name="title"
              placeholder="A short, clear summary of your request"
              value={form.title}
              onChange={handleChange}
              maxLength={200}
              required
            />
            <span className="form-hint">{form.title.length}/200</span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="fr-category">Category</label>
            <select
              id="fr-category"
              className="form-input form-select"
              name="category"
              value={form.category}
              onChange={handleChange}
              required
            >
              <option value="">Select a category…</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="fr-description">
              Description
              <span className="form-label-hint">Markdown supported</span>
            </label>
            <textarea
              id="fr-description"
              className="form-input form-textarea"
              name="description"
              placeholder={`Describe your feature request in detail.\n\nInclude:\n- The problem you're solving\n- Your proposed solution\n- Any alternatives you've considered`}
              value={form.description}
              onChange={handleChange}
              rows={8}
              required
            />
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button id="create-feature-submit" type="submit" className="btn btn--primary" disabled={loading}>
              {loading
                ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Submitting…</>
                : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateFeatureModal;
