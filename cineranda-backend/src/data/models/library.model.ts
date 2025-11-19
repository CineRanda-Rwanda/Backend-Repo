import mongoose, { Schema, Document } from 'mongoose';

export interface ILibrary extends Document {
  userId: mongoose.Types.ObjectId;
  contentId: mongoose.Types.ObjectId;
  contentType: 'Movie' | 'Series';
  addedAt: Date;
}

const librarySchema = new Schema<ILibrary>(
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
      enum: ['Movie', 'Series'],
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false
  }
);

// Compound index for faster queries and uniqueness
librarySchema.index({ userId: 1, contentId: 1 }, { unique: true });

export const Library = mongoose.model<ILibrary>('Library', librarySchema);
