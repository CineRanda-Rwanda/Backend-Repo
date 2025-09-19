import mongoose, { Schema, Document, model } from 'mongoose';

// --- SUB-SCHEMAS ---
const SubtitleSchema = new Schema({
  en: { type: String }, // URL to English subtitle file
  fr: { type: String }, // URL to French subtitle file
  kin: { type: String }, // URL to Kinyarwanda subtitle file
}, { _id: false });

const EpisodeSchema = new Schema({
  episodeNumber: { type: Number, required: true },
  title: { type: String, required: true },
  description: { type: String },
  videoUrl: { type: String, required: true },
  duration: { type: Number }, // in minutes
  isFree: { type: Boolean, default: false },
  subtitles: SubtitleSchema,
});

const SeasonSchema = new Schema({
  seasonNumber: { type: Number, required: true },
  episodes: [EpisodeSchema],
});

// --- MAIN CONTENT INTERFACE & SCHEMA ---
export interface IContent extends Document {
  title: string;
  description: string;
  posterImageUrl: string;
  trailerYoutubeLink: string;
  genre: string[];
  cast?: string[];
  director?: string;
  releaseDate?: Date;
  isPublished: boolean;
  
  priceInRwf: number;
  priceInCoins: number;

  contentType: 'Movie' | 'Series';
  
  // Movie-specific
  movieFileUrl?: string;
  duration?: number;
  subtitles?: { en?: string; fr?: string; kin?: string; };

  // Series-specific
  seasons?: { seasonNumber: number; episodes: any[] }[];
}

const ContentSchema = new Schema<IContent>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    posterImageUrl: { type: String, required: true },
    trailerYoutubeLink: { type: String, required: true },
    genre: [{ type: String, required: true }],
    cast: [{ type: String }],
    director: { type: String },
    releaseDate: { type: Date },
    isPublished: { type: Boolean, default: false },
    
    priceInRwf: { type: Number, required: true, min: 0 },
    priceInCoins: { type: Number, required: true, min: 0 },

    contentType: { type: String, enum: ['Movie', 'Series'], required: true },

    // Movie-specific
    movieFileUrl: { type: String },
    duration: { type: Number },
    subtitles: SubtitleSchema,

    // Series-specific
    seasons: [SeasonSchema],
  },
  { timestamps: true }
);

// We will export it as 'Content' for clarity in our code
export const Content = model<IContent>('Content', ContentSchema);