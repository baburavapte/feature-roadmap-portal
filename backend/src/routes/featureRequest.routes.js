import { Router } from 'express';
import {
  createFeatureRequest,
  getFeatureRequests,
  getFeatureRequestById,
  updateFeatureRequest,
  toggleVote,
  updateFeatureStatus,
} from '../controllers/featureRequest.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { getComments, createComment } from '../controllers/comment.controller.js';

const router = Router();

// ── Optional auth helper ───────────────────────────────────────────────────────
// Attaches req.user if a valid Bearer token is present, but does not 401 on
// missing/absent token — keeps public GET routes publicly accessible while
// allowing hasVoted to be computed for authenticated callers.
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
  try {
    await authenticate(req, res, next);
  } catch {
    next(); // silently continue without user context
  }
};

// ── Public routes (with optional auth for hasVoted) ───────────────────────────
router.get('/', optionalAuth, getFeatureRequests);
router.get('/:id', optionalAuth, getFeatureRequestById);
router.get('/:id/comments', optionalAuth, getComments);

// ── Auth required ─────────────────────────────────────────────────────────────
router.post('/', authenticate, createFeatureRequest);
router.patch('/:id', authenticate, updateFeatureRequest);
router.post('/:id/vote', authenticate, toggleVote);
router.post('/:id/comments', authenticate, createComment);

// ── Admin only ────────────────────────────────────────────────────────────────
router.patch('/:id/status', authenticate, requireRole('admin'), updateFeatureStatus);

export default router;
