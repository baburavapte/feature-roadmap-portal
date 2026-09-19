import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    featureRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeatureRequest',
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for getting comments by feature, sorted by creation
commentSchema.index({ featureRequest: 1, createdAt: 1 });

const Comment = mongoose.model('Comment', commentSchema);

export default Comment;
