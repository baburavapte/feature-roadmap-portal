const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Build the Authorization header from an optional token string.
 * @param {string|null} token
 * @returns {object}
 */
const authHeader = (token) =>
  token ? { Authorization: `Bearer ${token}` } : {};

/**
 * Parse an API response. Throws a descriptive error on non-2xx.
 * @param {Response} res
 * @returns {Promise<any>}
 */
const handleResponse = async (res) => {
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    const err = new Error(error.message || `Request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
};

/**
 * Lightweight fetch wrapper configured for the backend API.
 * Automatically includes credentials (cookies) for auth.
 */
const api = {
  /**
   * Send a GET request to the API.
   * @param {string} path - API path (e.g. '/api/health')
   * @param {string|null} token - Optional Bearer token
   * @returns {Promise<any>} Parsed JSON response
   */
  async get(path) {
    const res = await fetch(`${API_URL}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(res);
  },

  /**
   * GET with explicit Bearer token (used by AuthContext on hydration).
   * @param {string} path
   * @param {string} token
   * @returns {Promise<any>}
   */
  async getWithToken(path, token) {
    const res = await fetch(`${API_URL}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(token),
      },
    });
    return handleResponse(res);
  },

  /**
   * Send a POST request to the API.
   * @param {string} path - API path
   * @param {object} body - Request body
   * @param {string|null} token - Optional Bearer token
   * @returns {Promise<any>} Parsed JSON response
   */
  async post(path, body, token = null) {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(token),
      },
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  /**
   * Send a PATCH request to the API.
   * @param {string} path - API path
   * @param {object} body - Request body
   * @param {string|null} token - Optional Bearer token
   * @returns {Promise<any>} Parsed JSON response
   */
  async patch(path, body, token = null) {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(token),
      },
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  /**
   * Send a DELETE request to the API.
   * @param {string} path - API path
   * @param {string|null} token - Optional Bearer token
   * @returns {Promise<any>} Parsed JSON response
   */
  async delete(path, token = null) {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(token),
      },
    });
    return handleResponse(res);
  },

  // ─── Feature Requests ─────────────────────────────────────────────────────

  /**
   * Create a feature request (auth required — pass accessToken).
   * @param {{ title, description, category }} data
   * @param {string} token
   */
  async createFeatureRequest(data, token) {
    return this.post('/api/features', data, token);
  },

  /**
   * Get the feature request feed with optional filters/sort/search/pagination.
   * @param {{ page?, limit?, sort?, category?, status?, search? }} params
   */
  async getFeatureRequests(params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
    ).toString();
    return this.get(`/api/features${qs ? `?${qs}` : ''}`);
  },

  /**
   * Get a single feature request by ID.
   * @param {string} id
   */
  async getFeatureRequestById(id) {
    return this.get(`/api/features/${id}`);
  },

  /**
   * Update a feature request (auth required — pass accessToken).
   * @param {string} id
   * @param {{ title?, description?, category? }} data
   * @param {string} token
   */
  async updateFeatureRequest(id, data, token) {
    return this.patch(`/api/features/${id}`, data, token);
  },

  /**
   * Toggle vote on a feature (auth required).
   * @param {string} featureId
   * @param {string} token
   */
  async toggleFeatureVote(featureId, token) {
    return this.post(`/api/features/${featureId}/vote`, {}, token);
  },

  /**
   * Update feature status (admin only).
   * @param {string} featureId
   * @param {string} status
   * @param {string} token
   */
  async updateFeatureStatus(featureId, status, token) {
    return this.patch(`/api/features/${featureId}/status`, { status }, token);
  },

  // ─── Comments ──────────────────────────────────────────────────────────────

  /**
   * Get all comments for a feature request.
   * @param {string} featureId
   */
  async getComments(featureId) {
    return this.get(`/api/features/${featureId}/comments`);
  },

  /**
   * Create a comment for a feature request (auth required).
   * @param {string} featureId
   * @param {{ content: string, parentComment?: string }} data
   * @param {string} token
   */
  async createComment(featureId, data, token) {
    return this.post(`/api/features/${featureId}/comments`, data, token);
  },

  /**
   * Update a comment (auth required).
   * @param {string} commentId
   * @param {{ content: string }} data
   * @param {string} token
   */
  async updateComment(commentId, data, token) {
    return this.patch(`/api/comments/${commentId}`, data, token);
  },

  /**
   * Delete a comment (auth required).
   * @param {string} commentId
   * @param {string} token
   */
  async deleteComment(commentId, token) {
    return this.delete(`/api/comments/${commentId}`, token);
  },
};

export default api;
