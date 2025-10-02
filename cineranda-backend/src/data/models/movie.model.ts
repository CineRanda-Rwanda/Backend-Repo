import mongoose, { Schema, Document, model } from 'mongoose';

// --- SUB-SCHEMAS ---
const SubtitleSchema = new Schema({
  en: { type: String },
  fr: { type: String },
  kin: { type: String },
});

const EpisodeSchema = new Schema({
  episodeNumber: { type: Number, required: true },
  title: { type: String, required: true },
  description: { type: String },
  videoUrl: { type: String, required: true },
  trailerYoutubeLink: { type: String }, // Episode-specific trailer
  priceInRwf: { type: Number }, // Episode-specific price
  priceInCoins: { type: Number }, // Episode-specific price in coins
  duration: { type: Number }, // in minutes
  isFree: { type: Boolean, default: false },
  subtitles: SubtitleSchema,
}, { timestamps: true });

const SeasonSchema = new Schema({
  seasonNumber: { type: Number, required: true },
  episodes: [EpisodeSchema],
});

// --- CONTENT MODEL ---
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
  
  // New fields
  genres?: mongoose.Types.ObjectId[];
  categories?: mongoose.Types.ObjectId[];
  releaseYear?: number;
  language?: string;
  ageRating?: string;
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
    
    // Add new fields
    genres: [{
      type: Schema.Types.ObjectId,
      ref: 'Genre'
    }],
    categories: [{
      type: Schema.Types.ObjectId,
      ref: 'Category'
    }],
    releaseYear: {
      type: Number
    },
    language: {
      type: String
    },
    ageRating: {
      type: String
    }
  },
  { timestamps: true }
);

// Export Content model
export const Content = model<IContent>('Content', ContentSchema);

// --- MOVIE MODEL ---
export interface IMovie extends Document {
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  trailerUrl?: string;
  director?: string;
  cast?: string[];
  genres: mongoose.Types.ObjectId[]; 
  categories: mongoose.Types.ObjectId[]; 
  releaseYear?: number;
  duration?: number; 
  ageRating?: string;
  coinPrice: number;
  language?: string;
  subtitles?: string[];
  isActive: boolean;
  isFeatured: boolean;
  averageRating: number; 
  ratingCount: number;   
  viewCount: number;     
  createdAt: Date;
  updatedAt: Date;
}

const MovieSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    thumbnailUrl: {
      type: String,
      required: true
    },
    videoUrl: {
      type: String,
      required: true
    },
    trailerUrl: {
      type: String
    },
    coinPrice: {
      type: Number,
      required: true,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isFeatured: {
      type: Boolean,
      default: false
    },
    genres: [{
      type: Schema.Types.ObjectId,
      ref: 'Genre'
    }],
    categories: [{
      type: Schema.Types.ObjectId,
      ref: 'Category'
    }],
    director: {
      type: String,
      trim: true
    },
    cast: [{
      type: String,
      trim: true
    }],
    releaseYear: {
      type: Number
    },
    duration: {
      type: Number
    },
    ageRating: {
      type: String
    },
    language: {
      type: String
    },
    subtitles: [{
      type: String
    }],
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    ratingCount: {
      type: Number,
      default: 0
    },
    viewCount: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

// Add text index for search
MovieSchema.index(
  { title: 'text', description: 'text', director: 'text' },
  { weights: { title: 10, description: 5, director: 3 } }
);

// Export Movie model
export const Movie = mongoose.model<IMovie>('Movie', MovieSchema);