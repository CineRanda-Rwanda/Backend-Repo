import mongoose, { Schema, Document } from 'mongoose';

// Interface for pricing information
export interface IPricing {
  price: number;
  currency: string;
  isActive: boolean;
  discount?: number;
}

// Interface for media assets
export interface IMediaAsset {
  url?: string;
  key?: string;
  bucket?: string;
  thumbnails?: {
    small?: string;
    medium?: string;
    large?: string;
  };
}

// Interface for video content (trailer or movie)
export interface IVideoContent {
  youtubeUrl?: string;
  youtubeId?: string;
  awsUrl?: string;
  awsKey?: string;
  bucket?: string;
  availableOn: ('youtube' | 'aws')[];
  defaultChannel: 'youtube' | 'aws';
}

// Interface for series information
export interface ISeriesInfo {
  seriesTitle?: string;
  totalSeasons?: number;
  totalEpisodes?: number;
  isComplete?: boolean;
  releaseSchedule?: {
    episodesPerWeek: number;
    releaseDay: string;
  };
}

// Interface for episode information
export interface IEpisodeInfo {
  parentSeries?: mongoose.Types.ObjectId;
  seasonNumber?: number;
  episodeNumber?: number;
  releaseSchedule?: Date;
}

// Interface for regional analytics
export interface IRegionalData {
  rwanda: number;
  eastAfrica: number;
  otherAfrica: number;
  international: number;
  total?: number;
}

// Main Movie interface
export interface IMovie extends Document {
  title: string;
  description: string;
  director: string;
  actors: string[];
  genre: string;
  language: 'kinyarwanda' | 'english' | 'french' | 'swahili';
  duration: number;
  releaseDate: Date;
  type: 'movie' | 'series' | 'episode';
  seriesInfo?: ISeriesInfo;
  episodeInfo?: IEpisodeInfo;
  poster: IMediaAsset;
  trailer: IVideoContent;
  movie: IVideoContent;
  pricing: {
    rwanda: IPricing;
    eastAfrica: IPricing;
    otherAfrica: IPricing;
    international: IPricing;
  };
  seriesBundlePricing?: {
    rwanda: IPricing;
    eastAfrica: IPricing;
    otherAfrica: IPricing;
    international: IPricing;
  };
  coinPricing?: {
    coins: number;
    isActive: boolean;
  };
  isActive: boolean;
  isFeatured: boolean;
  isPublished: boolean;
  views: number;
  trailerViews: number;
  purchases: number;
  rating: number;
  totalRatings: number;
  likes: number;
  viewsBreakdown: IRegionalData;
  revenue: IRegionalData & { total: number };
  uploadedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const movieSchema: Schema = new Schema(
  {
    title: {
      type: String,
      required: [true, 'Movie title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
      type: String,
      required: [true, 'Movie description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    director: {
      type: String,
      required: [true, 'Director name is required'],
      trim: true
    },
    actors: [String],
    genre: {
      type: String,
      enum: [
        'action', 'comedy', 'drama', 'horror', 'romance', 'thriller',
        'documentary', 'animation', 'sci-fi', 'fantasy', 'crime',
        'adventure', 'family', 'musical', 'war', 'western',
        'biography', 'sport', 'historical'
      ],
      required: [true, 'Genre is required']
    },
    language: {
      type: String,
      enum: ['kinyarwanda', 'english', 'french', 'swahili'],
      required: [true, 'Language is required']
    },
    duration: {
      type: Number,
      required: [true, 'Duration is required in minutes']
    },
    releaseDate: {
      type: Date,
      required: [true, 'Release date is required']
    },
    type: {
      type: String,
      enum: ['movie', 'series', 'episode'],
      required: [true, 'Content type is required']
    },
    
    // Series-specific information
    seriesInfo: {
      seriesTitle: String,
      totalSeasons: {
        type: Number,
        min: [1, 'Must have at least 1 season']
      },
      totalEpisodes: Number,
      isComplete: {
        type: Boolean,
        default: false
      },
      releaseSchedule: {
        episodesPerWeek: {
          type: Number,
          default: 2
        },
        releaseDay: {
          type: String,
          enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
          default: 'friday'
        }
      }
    },
    
    // Episode-specific information
    episodeInfo: {
      parentSeries: {
        type: Schema.Types.ObjectId,
        ref: 'Movie'
      },
      seasonNumber: {
        type: Number,
        min: [1, 'Season number must be at least 1']
      },
      episodeNumber: {
        type: Number,
        min: [1, 'Episode number must be at least 1']
      },
      releaseSchedule: Date
    },
    
    // Media assets
    poster: {
      url: String,
      key: String,
      bucket: String,
      thumbnails: {
        small: String,
        medium: String,
        large: String
      }
    },
    
    // Trailer information
    trailer: {
      youtubeUrl: String,
      youtubeId: String,
      awsUrl: String,
      awsKey: String,
      bucket: String,
      availableOn: {
        type: [String],
        enum: ['youtube', 'aws'],
        default: ['youtube']
      },
      defaultChannel: {
        type: String,
        enum: ['youtube', 'aws'],
        default: 'youtube'
      }
    },
    
    // Movie content information
    movie: {
      youtubeUrl: String,
      youtubeId: String,
      awsUrl: String,
      awsKey: String,
      bucket: String,
      availableOn: {
        type: [String],
        enum: ['youtube', 'aws']
      },
      defaultChannel: {
        type: String,
        enum: ['youtube', 'aws'],
        default: 'youtube'
      }
    },
    
    // 4-tier regional pricing
    pricing: {
      rwanda: {
        price: {
          type: Number,
          min: [0, 'Price cannot be negative']
        },
        currency: {
          type: String,
          default: 'RWF'
        },
        isActive: {
          type: Boolean,
          default: true
        }
      },
      eastAfrica: {
        price: {
          type: Number,
          min: [0, 'Price cannot be negative']
        },
        currency: {
          type: String,
          default: 'USD'
        },
        isActive: {
          type: Boolean,
          default: true
        }
      },
      otherAfrica: {
        price: {
          type: Number,
          min: [0, 'Price cannot be negative']
        },
        currency: {
          type: String,
          default: 'USD'
        },
        isActive: {
          type: Boolean,
          default: true
        }
      },
      international: {
        price: {
          type: Number,
          min: [0, 'Price cannot be negative']
        },
        currency: {
          type: String,
          default: 'USD'
        },
        isActive: {
          type: Boolean,
          default: true
        }
      }
    },
    
    // Series bundle pricing with discounts
    seriesBundlePricing: {
      rwanda: {
        price: Number,
        currency: {
          type: String,
          default: 'RWF'
        },
        discount: {
          type: Number,
          min: [0, 'Discount cannot be negative'],
          max: [100, 'Discount cannot exceed 100%']
        },
        isActive: {
          type: Boolean,
          default: true
        }
      },
      eastAfrica: {
        price: Number,
        currency: {
          type: String,
          default: 'USD'
        },
        discount: {
          type: Number,
          min: [0, 'Discount cannot be negative'],
          max: [100, 'Discount cannot exceed 100%']
        },
        isActive: {
          type: Boolean,
          default: true
        }
      },
      otherAfrica: {
        price: Number,
        currency: {
          type: String,
          default: 'USD'
        },
        discount: {
          type: Number,
          min: [0, 'Discount cannot be negative'],
          max: [100, 'Discount cannot exceed 100%']
        },
        isActive: {
          type: Boolean,
          default: true
        }
      },
      international: {
        price: Number,
        currency: {
          type: String,
          default: 'USD'
        },
        discount: {
          type: Number,
          min: [0, 'Discount cannot be negative'],
          max: [100, 'Discount cannot exceed 100%']
        },
        isActive: {
          type: Boolean,
          default: true
        }
      }
    },
    
    // Future coin-based pricing
    coinPricing: {
      coins: {
        type: Number,
        min: [0, 'Coin price cannot be negative']
      },
      isActive: {
        type: Boolean,
        default: false
      }
    },
    
    // Content status
    isActive: {
      type: Boolean,
      default: true
    },
    isFeatured: {
      type: Boolean,
      default: false
    },
    isPublished: {
      type: Boolean,
      default: false
    },
    
    // Analytics
    views: {
      type: Number,
      default: 0
    },
    trailerViews: {
      type: Number,
      default: 0
    },
    purchases: {
      type: Number,
      default: 0
    },
    rating: {
      type: Number,
      min: [0, 'Rating cannot be negative'],
      max: [5, 'Rating cannot exceed 5'],
      default: 0
    },
    totalRatings: {
      type: Number,
      default: 0
    },
    likes: {
      type: Number,
      default: 0
    },
    
    // Regional analytics
    viewsBreakdown: {
      rwanda: {
        type: Number,
        default: 0
      },
      eastAfrica: {
        type: Number,
        default: 0
      },
      otherAfrica: {
        type: Number,
        default: 0
      },
      international: {
        type: Number,
        default: 0
      }
    },
    
    // Revenue tracking
    revenue: {
      rwanda: {
        type: Number,
        default: 0
      },
      eastAfrica: {
        type: Number,
        default: 0
      },
      otherAfrica: {
        type: Number,
        default: 0
      },
      international: {
        type: Number,
        default: 0
      },
      total: {
        type: Number,
        default: 0
      }
    },
    
    // Admin tracking
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Upload user reference is required']
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for episodes when viewing a series
movieSchema.virtual('episodes', {
  ref: 'Movie',
  localField: '_id',
  foreignField: 'episodeInfo.parentSeries',
  options: { sort: { 'episodeInfo.seasonNumber': 1, 'episodeInfo.episodeNumber': 1 } }
});

// Indexes for efficient queries
movieSchema.index({ title: 'text', description: 'text' });
movieSchema.index({ genre: 1 });
movieSchema.index({ 'episodeInfo.parentSeries': 1 });
movieSchema.index({ type: 1 });
movieSchema.index({ isFeatured: 1 });

// Pre-save middleware to update total revenue
movieSchema.pre('save', function(next) {
  if (this.isModified('revenue.rwanda') || 
      this.isModified('revenue.eastAfrica') || 
      this.isModified('revenue.otherAfrica') || 
      this.isModified('revenue.international')) {
    this.revenue.total = 
      this.revenue.rwanda + 
      this.revenue.eastAfrica + 
      this.revenue.otherAfrica + 
      this.revenue.international;
  }
  next();
});

const Movie = mongoose.model<IMovie>('Movie', movieSchema);

export default Movie;