import mongoose, { Schema, Document, model } from 'mongoose';

// --- INTERFACES ---
export interface IEpisode {
  _id?: mongoose.Types.ObjectId;
  episodeNumber: number;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  trailerYoutubeLink?: string;
  priceInRwf: number;
  priceInCoins: number;
  duration: number; // in minutes
  isFree: boolean;
  isPublished?: boolean;     // ✅ ADD THIS LINE
  subtitles?: {
    en?: string;
    fr?: string;
    kin?: string;
  };
  releaseDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISeason {
  _id?: mongoose.Types.ObjectId;
  seasonNumber: number;
  seasonTitle?: string;
  episodes: IEpisode[];
}

export interface IGenre extends Document {
  name: string;
  description?: string;
}

export interface ICategory extends Document {
  name: string;
  description?: string;
}

// --- MAIN CONTENT INTERFACE ---
export interface IContent extends Document {
  title: string;
  description: string;
  posterImageUrl: string;
  trailerYoutubeLink?: string;
  cast?: string[];
  director?: string;
  releaseYear: number;
  isPublished: boolean;
  contentType: 'Movie' | 'Series';
  
  // Movie-specific fields
  movieFileUrl?: string;
  duration?: number;
  priceInRwf?: number;
  priceInCoins?: number;
  subtitles?: {
    en?: string;
    fr?: string;
    kin?: string;
  };

  // Series-specific fields
  seasons?: ISeason[];
  
  // Series pricing (auto-calculated)
  totalSeriesPriceInRwf?: number;
  totalSeriesPriceInCoins?: number;
  seriesDiscountPercent?: number;
  discountedSeriesPriceInRwf?: number;
  discountedSeriesPriceInCoins?: number;
  
  // Common fields
  genres: mongoose.Types.ObjectId[] | IGenre[];
  categories: mongoose.Types.ObjectId[] | ICategory[];
  language?: string;
  ageRating?: string;
  
  // Metadata
  viewCount?: number;
  averageRating?: number;
  ratingCount?: number;
  isFeatured?: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

// --- SUB-SCHEMAS ---
const SubtitleSchema = new Schema({
  en: { type: String },
  fr: { type: String },
  kin: { type: String },
}, { _id: false });

const EpisodeSchema = new Schema<IEpisode>({
  episodeNumber: { 
    type: Number, 
    required: true 
  },
  title: { 
    type: String, 
    required: true,
    trim: true
  },
  description: { 
    type: String,
    trim: true
  },
  videoUrl: { 
    type: String, 
    required: true 
  },
  thumbnailUrl: {
    type: String
  },
  trailerYoutubeLink: { 
    type: String 
  },
  // Episode pricing - REQUIRED for non-free episodes
  priceInRwf: { 
    type: Number,
    required: function(this: IEpisode) {
      return !this.isFree;
    },
    min: 0,
    default: 0
  },
  priceInCoins: { 
    type: Number,
    required: function(this: IEpisode) {
      return !this.isFree;
    },
    min: 0,
    default: 0
  },
  duration: { 
    type: Number,
    required: true,
    min: 1
  },
  isFree: { 
    type: Boolean, 
    default: false 
  },
  isPublished: {              // ✅ ADD THIS FIELD
    type: Boolean,
    default: true             // Default to published
  },
  subtitles: SubtitleSchema,
  releaseDate: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const SeasonSchema = new Schema<ISeason>({
  seasonNumber: { 
    type: Number, 
    required: true,
    min: 1
  },
  seasonTitle: {
    type: String,
    trim: true
  },
  episodes: {
    type: [EpisodeSchema],
    default: [] // ✅ Allow empty episodes
  }
}, { _id: true });

// --- MAIN CONTENT SCHEMA ---
const ContentSchema = new Schema<IContent>(
  {
    title: { 
      type: String, 
      required: [true, 'Title is required'],
      trim: true,
      index: true
    },
    description: { 
      type: String, 
      required: [true, 'Description is required'],
      trim: true
    },
    posterImageUrl: { 
      type: String, 
      required: [true, 'Poster image is required']
    },
    trailerYoutubeLink: { 
      type: String 
    },
    cast: [{ 
      type: String,
      trim: true
    }],
    director: { 
      type: String,
      trim: true
    },
    releaseYear: { 
      type: Number,
      required: true,
      min: 1900,
      max: new Date().getFullYear() + 5
    },
    isPublished: { 
      type: Boolean, 
      default: false 
    },
    contentType: { 
      type: String, 
      enum: {
        values: ['Movie', 'Series'],
        message: '{VALUE} is not a valid content type'
      },
      required: true 
    },

    // --- MOVIE-SPECIFIC FIELDS ---
    movieFileUrl: { 
      type: String,
      required: function(this: IContent) {
        return this.contentType === 'Movie';
      }
    },
    duration: { 
      type: Number,
      required: function(this: IContent) {
        return this.contentType === 'Movie';
      },
      min: 1
    },
    priceInRwf: { 
      type: Number,
      required: function(this: IContent) {
        return this.contentType === 'Movie';
      },
      min: 0
    },
    priceInCoins: { 
      type: Number,
      required: function(this: IContent) {
        return this.contentType === 'Movie';
      },
      min: 0
    },
    subtitles: SubtitleSchema,

    // --- SERIES-SPECIFIC FIELDS ---
    seasons: {
      type: [SeasonSchema],
      default: [] // ✅ Allow empty seasons for series
    },
    
    // Series pricing (auto-calculated from episodes)
    totalSeriesPriceInRwf: {
      type: Number,
      default: 0
    },
    totalSeriesPriceInCoins: {
      type: Number,
      default: 0
    },
    seriesDiscountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    discountedSeriesPriceInRwf: {
      type: Number,
      default: 0
    },
    discountedSeriesPriceInCoins: {
      type: Number,
      default: 0
    },
    
    // --- COMMON FIELDS ---
    genres: [{
      type: Schema.Types.ObjectId,
      ref: 'Genre',
      required: true
    }],
    categories: [{
      type: Schema.Types.ObjectId,
      ref: 'Category'
    }],
    language: {
      type: String,
      default: 'English'
    },
    ageRating: {
      type: String,
      enum: ['G', 'PG', 'PG-13', 'R', 'NC-17', 'NR'],
      default: 'NR'
    },
    
    // --- METADATA ---
    viewCount: {
      type: Number,
      default: 0,
      min: 0
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: 0
    },
    isFeatured: {
      type: Boolean,
      default: false
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// --- PRE-SAVE HOOK: Auto-calculate series pricing ---
ContentSchema.pre('save', function(next) {
  if (this.contentType === 'Series' && this.seasons && this.seasons.length > 0) {
    let totalRwf = 0;
    let totalCoins = 0;
    
    // Sum up all non-free episode prices
    this.seasons.forEach(season => {
      season.episodes.forEach(episode => {
        if (!episode.isFree) {
          totalRwf += episode.priceInRwf || 0;
          totalCoins += episode.priceInCoins || 0;
        }
      });
    });
    
    this.totalSeriesPriceInRwf = totalRwf;
    this.totalSeriesPriceInCoins = totalCoins;
    
    // Apply discount if set
    const discount = this.seriesDiscountPercent || 0;
    if (discount > 0) {
      this.discountedSeriesPriceInRwf = Math.round(totalRwf * (1 - discount / 100));
      this.discountedSeriesPriceInCoins = Math.round(totalCoins * (1 - discount / 100));
    } else {
      this.discountedSeriesPriceInRwf = totalRwf;
      this.discountedSeriesPriceInCoins = totalCoins;
    }
    
    console.log(`Series pricing calculated: Total=${totalRwf} RWF, Discount=${discount}%, Final=${this.discountedSeriesPriceInRwf} RWF`);
  }
  
  next();
});

// --- INDEXES for better query performance ---
ContentSchema.index({ contentType: 1, isPublished: 1 });
ContentSchema.index({ genres: 1 });
ContentSchema.index({ categories: 1 });
ContentSchema.index({ releaseYear: -1 });
ContentSchema.index({ isFeatured: 1, isPublished: 1 });
ContentSchema.index({ averageRating: -1 });
ContentSchema.index({ viewCount: -1 });
ContentSchema.index({ title: 'text', description: 'text' });

// --- INSTANCE METHODS ---
ContentSchema.methods.incrementViewCount = function() {
  this.viewCount = (this.viewCount || 0) + 1;
  return this.save();
};

ContentSchema.methods.updateRating = function(newRating: number) {
  const currentTotal = this.averageRating * this.ratingCount;
  this.ratingCount += 1;
  this.averageRating = (currentTotal + newRating) / this.ratingCount;
  return this.save();
};

// --- VIRTUAL: Get final price for series ---
ContentSchema.virtual('finalSeriesPrice').get(function(this: IContent) {
  if (this.contentType === 'Series') {
    return {
      rwf: this.discountedSeriesPriceInRwf || this.totalSeriesPriceInRwf || 0,
      coins: this.discountedSeriesPriceInCoins || this.totalSeriesPriceInCoins || 0,
      discount: this.seriesDiscountPercent || 0,
      originalPrice: {
        rwf: this.totalSeriesPriceInRwf || 0,
        coins: this.totalSeriesPriceInCoins || 0
      }
    };
  }
  return null;
});

// --- VIRTUAL: Get total episode count for series ---
ContentSchema.virtual('totalEpisodes').get(function(this: IContent) {
  if (this.contentType === 'Series' && this.seasons) {
    return this.seasons.reduce((total, season) => total + season.episodes.length, 0);
  }
  return 0;
});

// Export Content model
export const Content = model<IContent>('Content', ContentSchema);

// --- LEGACY MOVIE MODEL (DEPRECATED - Keep for backward compatibility) ---
// NOTE: This appears to be unused. Consider removing after migration.
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

// Export Movie model (DEPRECATED)
export const Movie = mongoose.model<IMovie>('Movie', MovieSchema);