import mongoose from 'mongoose';

// ─── Safe author projection ────────────────────────────────────────────────────
// Reused wherever author is populated — never exposes sensitive fields.
export const SAFE_AUTHOR_SELECT = 'name email role createdAt';

// ─── Schema ───────────────────────────────────────────────────────────────────

const featureRequestSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },

    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
    },

    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: ['UI/UX', 'Integrations', 'Performance', 'General'],
        message: 'Category must be one of: UI/UX, Integrations, Performance, General',
      },
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: {
        values: ['Under Review', 'Planned', 'In Progress', 'Completed'],
        message: 'Invalid status value',
      },
      default: 'Under Review',
      index: true,
    },

    // Atomic vote count — kept in sync by the voting system (Task 4)
    voteCount: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },

    // Atomic comment count — kept in sync by the comment system (Task 4/5)
    commentCount: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },

    // User IDs who have voted — used for deduplication in the voting system
    voters: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true, // createdAt + updatedAt
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Compound index for the feed queries (sort + filter)
featureRequestSchema.index({ createdAt: -1 });
featureRequestSchema.index({ voteCount: -1, createdAt: -1 });
featureRequestSchema.index({ commentCount: -1, createdAt: -1 });
featureRequestSchema.index({ category: 1, createdAt: -1 });
featureRequestSchema.index({ status: 1, createdAt: -1 });

// Full-text search index on title and description
featureRequestSchema.index(
  { title: 'text', description: 'text' },
  { weights: { title: 10, description: 3 }, name: 'TextSearch' }
);

const FeatureRequest = mongoose.model('FeatureRequest', featureRequestSchema);

export default FeatureRequest;
