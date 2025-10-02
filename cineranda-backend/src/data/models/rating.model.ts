import mongoose, { Schema, Document } from 'mongoose';

export interface IRating extends Document {
  userId: mongoose.Types.ObjectId;
  movieId: mongoose.Types.ObjectId;
  rating: number; // 1-5 stars
  review?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RatingSchema: Schema = new Schema(
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
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    review: {
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

// Ensure a user can only rate a movie once
RatingSchema.index({ userId: 1, movieId: 1 }, { unique: true });

export const Rating = mongoose.model<IRating>('Rating', RatingSchema);