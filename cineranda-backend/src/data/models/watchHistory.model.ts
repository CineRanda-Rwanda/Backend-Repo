import mongoose, { Schema, Document } from 'mongoose';

export interface IWatchHistory extends Document {
  userId: mongoose.Types.ObjectId;
  movieId: mongoose.Types.ObjectId;
  watchedDuration: number; // in seconds
  completed: boolean;
  lastWatched: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WatchHistorySchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    movieId: {
      type: Schema.Types.ObjectId,
      ref: 'Movie',
      required: true
    },
    watchedDuration: {
      type: Number,
      default: 0
    },
    completed: {
      type: Boolean,
      default: false
    },
    lastWatched: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Ensure unique user-movie pairs, but allow updates
WatchHistorySchema.index({ userId: 1, movieId: 1 }, { unique: true });

export const WatchHistory = mongoose.model<IWatchHistory>('WatchHistory', WatchHistorySchema);