import mongoose, { Schema, Document, model } from 'mongoose';
import { COINS_TO_RWF_RATE, rwfToCoins } from '../../utils/pricing';

const asPositiveNumber = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
};

const convertRwfToCoins = (amount: number | null): number => {
  if (amount === null) {
    return 0;
  }

  const coins = rwfToCoins(amount);
  return coins ?? 0;
};

const applyLegacyPricingSnapshot = (target: any) => {
  if (!target) {
    return;
  }

  const priceAmount = asPositiveNumber(target.price) ?? asPositiveNumber(target.priceInRwf);
  if (priceAmount !== null) {
    target.price = priceAmount;
    target.priceInRwf = priceAmount;
    target.priceInCoins = convertRwfToCoins(priceAmount);
  } else if (target.priceInCoins !== undefined) {
    const coinsValue = asPositiveNumber(target.priceInCoins);
    target.priceInCoins = coinsValue ?? 0;
    target.priceInRwf = coinsValue ? coinsValue * COINS_TO_RWF_RATE : 0;
  } else {
    target.priceInRwf = target.priceInRwf ?? 0;
    target.priceInCoins = target.priceInCoins ?? 0;
  }
};

const SERIES_ONLY_FIELDS = [
  'seasons',
  'totalSeriesPrice',
  'totalSeriesPriceInRwf',
  'totalSeriesPriceInCoins',
  'discountedSeriesPrice',
  'discountedSeriesPriceInRwf',
  'discountedSeriesPriceInCoins',
  'seriesDiscountPercent',
  'finalSeriesPrice',
  'totalEpisodes'
];

const transformContentPricing = (_doc: any, ret: any) => {
  applyLegacyPricingSnapshot(ret);

  if (ret.contentType !== 'Series') {
    SERIES_ONLY_FIELDS.forEach((field) => {
      if (field === 'seasons') {
        delete ret.seasons;
      } else {
        delete ret[field];
      }
    });
    return ret;
  }

  const totalSeries =
    asPositiveNumber(ret.totalSeriesPrice) ?? asPositiveNumber(ret.totalSeriesPriceInRwf);
  if (totalSeries !== null) {
    ret.totalSeriesPrice = totalSeries;
    ret.totalSeriesPriceInRwf = totalSeries;
    ret.totalSeriesPriceInCoins = convertRwfToCoins(totalSeries);
  } else {
    ret.totalSeriesPriceInRwf = ret.totalSeriesPriceInRwf ?? 0;
    ret.totalSeriesPriceInCoins = ret.totalSeriesPriceInCoins ?? 0;
  }

  const discountedSeries =
    asPositiveNumber(ret.discountedSeriesPrice) ?? asPositiveNumber(ret.discountedSeriesPriceInRwf);
  if (discountedSeries !== null) {
    ret.discountedSeriesPrice = discountedSeries;
    ret.discountedSeriesPriceInRwf = discountedSeries;
    ret.discountedSeriesPriceInCoins = convertRwfToCoins(discountedSeries);
  } else {
    ret.discountedSeriesPriceInRwf = ret.discountedSeriesPriceInRwf ?? 0;
    ret.discountedSeriesPriceInCoins = ret.discountedSeriesPriceInCoins ?? 0;
  }

  if (Array.isArray(ret.seasons)) {
    ret.seasons = ret.seasons.map((season: any) => {
      if (!season || !Array.isArray(season.episodes)) {
        return season;
      }

      season.episodes = season.episodes.map((episode: any) => {
        applyLegacyPricingSnapshot(episode);
        return episode;
      });

      return season;
    });
  }

  return ret;
};

// --- INTERFACES ---
export interface IEpisode {
  _id?: mongoose.Types.ObjectId;
  episodeNumber: number;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  trailerYoutubeLink?: string;
  price: number; // Unified price in RWF
  priceInRwf?: number;
  priceInCoins?: number;
  duration: number; // in minutes
  isFree: boolean;
  isPublished?: boolean;
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
  price: number; // Unified price in RWF
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
  totalSeriesPrice?: number;
  totalSeriesPriceInRwf?: number;
  totalSeriesPriceInCoins?: number;
  seriesDiscountPercent?: number;
  discountedSeriesPrice?: number;
  discountedSeriesPriceInRwf?: number;
  discountedSeriesPriceInCoins?: number;
  
  // Control whether ratings are allowed for this content
  ratingsEnabled?: boolean;
  
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
  price: {
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
    // Unified movie price field (RWF)
    price: {
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
    totalSeriesPrice: {
      type: Number,
      default: 0
    },
    seriesDiscountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    discountedSeriesPrice: {
      type: Number,
      default: 0
    },
    // allow toggling ratings per content
    ratingsEnabled: {
      type: Boolean,
      default: true
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

ContentSchema.set('toJSON', {
  virtuals: true,
  transform: transformContentPricing
});

ContentSchema.set('toObject', {
  virtuals: true,
  transform: transformContentPricing
});

// --- PRE-SAVE HOOK: Auto-calculate series pricing ---
ContentSchema.pre('save', function(next) {
  if (this.contentType === 'Series' && this.seasons && this.seasons.length > 0) {
    let totalPrice = 0;
    
    // Sum up all non-free episode prices
    this.seasons.forEach(season => {
      season.episodes.forEach(episode => {
        if (!episode.isFree) {
          totalPrice += episode.price || 0;
        }
      });
    });
    
    this.totalSeriesPrice = totalPrice;
    
    // Apply discount if set
    const discount = this.seriesDiscountPercent || 0;
    if (discount > 0) {
      this.discountedSeriesPrice = Math.round(totalPrice * (1 - discount / 100));
    } else {
      this.discountedSeriesPrice = totalPrice;
    }
    
    console.log(`Series pricing calculated: Total=${totalPrice} RWF, Discount=${discount}%, Final=${this.discountedSeriesPrice} RWF`);
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
      price: this.discountedSeriesPrice || this.totalSeriesPrice || 0,
      discount: this.seriesDiscountPercent || 0,
      originalPrice: this.totalSeriesPrice || 0,
      currency: 'RWF'
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