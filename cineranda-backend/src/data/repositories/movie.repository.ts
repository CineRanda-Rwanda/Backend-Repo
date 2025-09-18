import { Movie, IMovie } from '../models';
import { BaseRepository } from './base.repository';

export class MovieRepository extends BaseRepository<IMovie> {
  constructor() {
    super(Movie);
  }

  async findMovies(
    options: {
      type?: 'movie' | 'series' | 'episode';
      genre?: string;
      language?: string;
      isFeatured?: boolean;
      isPublished?: boolean;
      search?: string;
      page?: number;
      limit?: number;
      sort?: string;
    } = {}
  ): Promise<{ movies: IMovie[]; total: number; pages: number }> {
    const {
      type,
      genre,
      language,
      isFeatured,
      isPublished = true,
      search,
      page = 1,
      limit = 10,
      sort = '-createdAt'
    } = options;

    // Build filter
    const filter: any = { isPublished };
    
    if (type) filter.type = type;
    if (genre) filter.genre = genre;
    if (language) filter.language = language;
    if (isFeatured !== undefined) filter.isFeatured = isFeatured;
    
    // Add text search if provided
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { director: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Execute query
    const [movies, total] = await Promise.all([
      this.model
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit),
      this.model.countDocuments(filter)
    ]);

    return {
      movies,
      total,
      pages: Math.ceil(total / limit)
    };
  }

  async findSeriesWithEpisodes(seriesId: string): Promise<IMovie | null> {
    return this.model
      .findById(seriesId)
      .populate({
        path: 'episodes',
        options: {
          sort: { 'episodeInfo.seasonNumber': 1, 'episodeInfo.episodeNumber': 1 }
        }
      });
  }

  async incrementViews(
    movieId: string, 
    region: 'rwanda' | 'eastAfrica' | 'otherAfrica' | 'international'
  ): Promise<void> {
    const update: any = { $inc: { views: 1 } };
    
    // Also increment the region-specific view count
    if (region === 'rwanda') {
      update.$inc['viewsBreakdown.rwanda'] = 1;
    } else if (region === 'eastAfrica') {
      update.$inc['viewsBreakdown.eastAfrica'] = 1;
    } else if (region === 'otherAfrica') {
      update.$inc['viewsBreakdown.otherAfrica'] = 1;
    } else if (region === 'international') {
      update.$inc['viewsBreakdown.international'] = 1;
    }
    
    await this.model.findByIdAndUpdate(movieId, update);
  }

  async incrementTrailerViews(movieId: string): Promise<void> {
    await this.model.findByIdAndUpdate(movieId, { 
      $inc: { trailerViews: 1 } 
    });
  }

  async recordPurchase(
    movieId: string,
    amount: number,
    region: 'rwanda' | 'eastAfrica' | 'otherAfrica' | 'international'
  ): Promise<void> {
    const update: any = { 
      $inc: { purchases: 1 } 
    };
    
    // Add revenue to the correct region
    if (region === 'rwanda') {
      update.$inc['revenue.rwanda'] = amount;
    } else if (region === 'eastAfrica') {
      update.$inc['revenue.eastAfrica'] = amount;
    } else if (region === 'otherAfrica') {
      update.$inc['revenue.otherAfrica'] = amount;
    } else if (region === 'international') {
      update.$inc['revenue.international'] = amount;
    }
    
    update.$inc['revenue.total'] = amount;
    
    await this.model.findByIdAndUpdate(movieId, update);
  }

  async toggleLike(movieId: string, increment: boolean): Promise<void> {
    const update = increment ? 
      { $inc: { likes: 1 } } : 
      { $inc: { likes: -1 } };
    
    await this.model.findByIdAndUpdate(movieId, update);
  }
}