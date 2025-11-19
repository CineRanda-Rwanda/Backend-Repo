import mongoose, { Schema, Document } from 'mongoose';

export interface IWatchProgress extends Document {
  userId: mongoose.Types.ObjectId;
  contentId: mongoose.Types.ObjectId;
  contentType: 'Movie' | 'Episode';
  episodeId?: mongoose.Types.ObjectId;
  seasonNumber?: number;
  episodeNumber?: number;
  progress: number; // Time in seconds
  duration: number; // Total duration in seconds
  percentageWatched: number;
  isCompleted: boolean;
  lastWatchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const watchProgressSchema = new Schema<IWatchProgress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    contentId: {
      type: Schema.Types.ObjectId,
      ref: 'Content',
      required: true,
      index: true
    },
    contentType: {
      type: String,
      enum: ['Movie', 'Episode'],
      required: true
    },
    episodeId: {
      type: Schema.Types.ObjectId,
      required: false
    },
    seasonNumber: {
      type: Number,
      required: false
    },
    episodeNumber: {
      type: Number,
      required: false
    },
    progress: {
      type: Number,
      required: true,
      min: 0
    },
    duration: {
      type: Number,
      required: true,
      min: 0
    },
    percentageWatched: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    isCompleted: {
      type: Boolean,
      default: false
    },
    lastWatchedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Compound index for unique user-content combinations
watchProgressSchema.index({ userId: 1, contentId: 1, episodeId: 1 }, { unique: true });

// Index for continue watching queries
watchProgressSchema.index({ userId: 1, lastWatchedAt: -1 });

// Pre-save hook to calculate percentage and completion status
watchProgressSchema.pre('save', function (next) {
  if (this.duration > 0) {
    this.percentageWatched = Math.round((this.progress / this.duration) * 100 * 100) / 100;
    this.isCompleted = this.percentageWatched >= 95;
  }
  next();
});

export const WatchProgress = mongoose.model<IWatchProgress>('WatchProgress', watchProgressSchema);
