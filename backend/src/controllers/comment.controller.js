import mongoose from 'mongoose';
import Comment from '../models/Comment.js';
import FeatureRequest, { SAFE_AUTHOR_SELECT } from '../models/FeatureRequest.js';

/**
 * GET /api/features/:id/comments
 * Fetch all comments for a feature request.
 * Returns them flat, sorted by createdAt.
 * Soft-deleted comments have their content and author masked.
 */
export const getComments = async (req, res, next) => {
  try {
    const { id: featureId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(featureId)) {
      return res.status(400).json({ success: false, message: 'Invalid feature request ID.' });
    }

    const comments = await Comment.find({ featureRequest: featureId })
      .populate('author', SAFE_AUTHOR_SELECT)
      .sort({ createdAt: 1 })
      .lean();

    // Mask deleted comments
    const safeComments = comments.map(c => {
      if (c.isDeleted) {
        return {
          ...c,
          content: '[This comment has been deleted]',
          author: null, // Hide author info
        };
      }
      return c;
    });

    return res.status(200).json({
      success: true,
      data: { comments: safeComments },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/features/:id/comments
 * Create a new comment (top-level or reply).
 */
export const createComment = async (req, res, next) => {
  try {
    const { id: featureId } = req.params;
    const { content, parentComment } = req.body;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(featureId)) {
      return res.status(400).json({ success: false, message: 'Invalid feature request ID.' });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Comment content is required.' });
    }

    // Check if feature exists
    const feature = await FeatureRequest.findById(featureId);
    if (!feature) {
      return res.status(404).json({ success: false, message: 'Feature request not found.' });
    }

    // Check parent comment if provided
    if (parentComment) {
      if (!mongoose.Types.ObjectId.isValid(parentComment)) {
        return res.status(400).json({ success: false, message: 'Invalid parent comment ID.' });
      }
      const parent = await Comment.findById(parentComment);
      if (!parent) {
        return res.status(404).json({ success: false, message: 'Parent comment not found.' });
      }
      if (parent.featureRequest.toString() !== featureId.toString()) {
        return res.status(400).json({ success: false, message: 'Parent comment belongs to a different feature.' });
      }
    }

    const comment = await Comment.create({
      featureRequest: featureId,
      author: userId,
      content: content.trim(),
      parentComment: parentComment || null,
    });

    await comment.populate('author', SAFE_AUTHOR_SELECT);

    // Atomically increment commentCount
    await FeatureRequest.updateOne({ _id: featureId }, { $inc: { commentCount: 1 } });

    return res.status(201).json({
      success: true,
      message: 'Comment added successfully.',
      data: { comment },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/comments/:id
 * Edit a comment. Only author or admin can edit.
 */
export const updateComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user._id;
    const isAdmin = req.user.role === 'admin';

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid comment ID.' });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Comment content is required.' });
    }

    const comment = await Comment.findById(id);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found.' });
    }

    if (comment.isDeleted) {
      return res.status(400).json({ success: false, message: 'Cannot edit a deleted comment.' });
    }

    if (comment.author.toString() !== userId.toString() && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this comment.' });
    }

    comment.content = content.trim();
    await comment.save();
    await comment.populate('author', SAFE_AUTHOR_SELECT);

    return res.status(200).json({
      success: true,
      message: 'Comment updated successfully.',
      data: { comment },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/comments/:id
 * Delete a comment. Only author or admin can delete.
 * Uses soft delete (isDeleted = true) to preserve thread structure.
 * Decrements feature's commentCount.
 */
export const deleteComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const isAdmin = req.user.role === 'admin';

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid comment ID.' });
    }

    const comment = await Comment.findById(id);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found.' });
    }

    if (comment.isDeleted) {
      return res.status(400).json({ success: false, message: 'Comment is already deleted.' });
    }

    if (comment.author.toString() !== userId.toString() && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this comment.' });
    }

    // Soft delete
    comment.isDeleted = true;
    await comment.save();

    // Decrement commentCount, ensure >= 0
    await FeatureRequest.updateOne(
      { _id: comment.featureRequest, commentCount: { $gt: 0 } },
      { $inc: { commentCount: -1 } }
    );

    return res.status(200).json({
      success: true,
      message: 'Comment deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
};
