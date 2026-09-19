import mongoose from 'mongoose';
import FeatureRequest, { SAFE_AUTHOR_SELECT } from '../models/FeatureRequest.js';

const VALID_CATEGORIES = ['UI/UX', 'Integrations', 'Performance', 'General'];
const VALID_STATUSES = ['Under Review', 'Planned', 'In Progress', 'Completed'];
const VALID_SORTS = ['newest', 'upvoted', 'discussed'];

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * POST /api/features
 * Auth required. Creates a new feature request.
 */
export const createFeatureRequest = async (req, res, next) => {
  try {
    const { title, description, category } = req.body;

    // Validate required fields
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required.' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ success: false, message: 'Description is required.' });
    }
    if (!category) {
      return res.status(400).json({ success: false, message: 'Category is required.' });
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}`,
      });
    }

    const feature = await FeatureRequest.create({
      title: title.trim(),
      description: description.trim(),
      category,
      author: req.user._id,
      // status defaults to 'Under Review' — not settable by normal users
    });

    // Return populated author info
    await feature.populate('author', SAFE_AUTHOR_SELECT);

    return res.status(201).json({
      success: true,
      message: 'Feature request submitted successfully.',
      data: { feature },
    });
  } catch (err) {
    // Mongoose validation error
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((e) => e.message).join('. ');
      return res.status(400).json({ success: false, message });
    }
    next(err);
  }
};

// ─── Get All (Feed) ───────────────────────────────────────────────────────────

/**
 * GET /api/features
 * Public. Supports filtering, sorting, search, and pagination.
 * If an authenticated user is present via optional token, hasVoted is set.
 */
export const getFeatureRequests = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = 'newest',
      category,
      status,
      search,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    // ── Build filter ──────────────────────────────────────────────────────────
    const filter = {};

    if (category && VALID_CATEGORIES.includes(category)) {
      filter.category = category;
    }

    if (status && VALID_STATUSES.includes(status)) {
      filter.status = status;
    }

    // Full-text search — uses the TextSearch index
    if (search && search.trim()) {
      filter.$text = { $search: search.trim() };
    }

    // ── Build sort ────────────────────────────────────────────────────────────
    let sortObj = {};
    const sortKey = VALID_SORTS.includes(sort) ? sort : 'newest';

    if (sortKey === 'newest') {
      sortObj = { createdAt: -1 };
    } else if (sortKey === 'upvoted') {
      sortObj = { voteCount: -1, createdAt: -1 };
    } else if (sortKey === 'discussed') {
      sortObj = { commentCount: -1, createdAt: -1 };
    }

    // If doing text search, include text score in sort
    if (filter.$text) {
      sortObj = { score: { $meta: 'textScore' }, ...sortObj };
    }

    // ── Execute ───────────────────────────────────────────────────────────────
    const userId = req.user?._id ?? null;

    const [features, total] = await Promise.all([
      FeatureRequest.find(filter)
        .select(filter.$text ? { score: { $meta: 'textScore' } } : {})
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .populate('author', SAFE_AUTHOR_SELECT)
        .lean(),
      FeatureRequest.countDocuments(filter),
    ]);

    // Strip voters array; add hasVoted per feature
    const safeFeatures = features.map(({ voters, ...f }) => ({
      ...f,
      hasVoted: userId
        ? (voters ?? []).some((v) => v.toString() === userId.toString())
        : false,
    }));

    return res.status(200).json({
      success: true,
      message: 'Feature requests fetched successfully.',
      data: {
        features: safeFeatures,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Get By ID ────────────────────────────────────────────────────────────────

/**
 * GET /api/features/:id
 * Public. Returns a single feature request with populated author.
 * voters[] is stripped; hasVoted is derived for the requesting user.
 */
export const getFeatureRequestById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid feature request ID.' });
    }

    const raw = await FeatureRequest.findById(id)
      .populate('author', SAFE_AUTHOR_SELECT)
      .lean();

    if (!raw) {
      return res.status(404).json({ success: false, message: 'Feature request not found.' });
    }

    const userId = req.user?._id ?? null;
    const { voters, ...feature } = raw;
    feature.hasVoted = userId
      ? (voters ?? []).some((v) => v.toString() === userId.toString())
      : false;

    return res.status(200).json({
      success: true,
      message: 'Feature request retrieved successfully.',
      data: { feature },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * PATCH /api/features/:id
 * Auth required. Only the original author can edit (admin RBAC in Task 4+).
 * Allows editing: title, description, category.
 * Rejects attempts to modify: status, voteCount, commentCount, voters, author.
 */
export const updateFeatureRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid feature request ID.' });
    }

    const feature = await FeatureRequest.findById(id);
    if (!feature) {
      return res.status(404).json({ success: false, message: 'Feature request not found.' });
    }

    // Only the author can edit (admin override will be added in Task 4)
    if (feature.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorised to edit this feature request.',
      });
    }

    // Whitelist editable fields — silently ignore anything else
    const { title, description, category } = req.body;

    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ success: false, message: 'Title cannot be empty.' });
      feature.title = title.trim();
    }

    if (description !== undefined) {
      if (!description.trim()) return res.status(400).json({ success: false, message: 'Description cannot be empty.' });
      feature.description = description.trim();
    }

    if (category !== undefined) {
      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({
          success: false,
          message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}`,
        });
      }
      feature.category = category;
    }

    await feature.save();
    await feature.populate('author', SAFE_AUTHOR_SELECT);

    return res.status(200).json({
      success: true,
      message: 'Feature request updated successfully.',
      data: { feature },
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((e) => e.message).join('. ');
      return res.status(400).json({ success: false, message });
    }
    next(err);
  }
};

// ─── Toggle Vote (Atomic) ─────────────────────────────────────────────────────

/**
 * POST /api/features/:id/vote
 * Auth required. Atomically toggles the authenticated user's vote.
 *
 * Strategy:
 *   1. Try to REMOVE the vote (user IS in voters[]).
 *   2. If no document was modified, ADD the vote instead.
 * Both operations use findOneAndUpdate — one round-trip each, no race conditions.
 */
export const toggleVote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid feature request ID.' });
    }

    // ── Attempt removal first (user has already voted) ────────────────────────
    const removed = await FeatureRequest.findOneAndUpdate(
      { _id: id, voters: userId },                          // only match if user is a voter
      { $pull: { voters: userId }, $inc: { voteCount: -1 } },
      { new: true, fields: { voteCount: 1 } }               // return only voteCount
    );

    if (removed) {
      // Ensure voteCount never goes below 0 (safety net)
      if (removed.voteCount < 0) {
        await FeatureRequest.updateOne({ _id: id }, { $set: { voteCount: 0 } });
      }
      return res.status(200).json({
        success: true,
        message: 'Vote removed successfully.',
        data: { voted: false, voteCount: Math.max(0, removed.voteCount) },
      });
    }

    // ── Add vote (user has NOT voted yet) ─────────────────────────────────────
    const added = await FeatureRequest.findOneAndUpdate(
      { _id: id, voters: { $ne: userId } },                 // only match if user is NOT a voter
      { $addToSet: { voters: userId }, $inc: { voteCount: 1 } },
      { new: true, fields: { voteCount: 1 } }
    );

    if (!added) {
      // Feature not found (already handled above for the remove case)
      return res.status(404).json({ success: false, message: 'Feature request not found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Vote added successfully.',
      data: { voted: true, voteCount: added.voteCount },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Update Status (Admin only) ───────────────────────────────────────────────

/**
 * PATCH /api/features/:id/status
 * Admin only. Changes only the status field.
 */
export const updateFeatureStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid feature request ID.' });
    }

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const raw = await FeatureRequest.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true }
    ).populate('author', SAFE_AUTHOR_SELECT).lean();

    if (!raw) {
      return res.status(404).json({ success: false, message: 'Feature request not found.' });
    }

    // Strip voters from admin response too
    const { voters, ...feature } = raw;
    feature.hasVoted = false; // admin context — not needed

    return res.status(200).json({
      success: true,
      message: `Status updated to "${status}" successfully.`,
      data: { feature },
    });
  } catch (err) {
    next(err);
  }
};
