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

  // Extend your existing movie repository with these new methods

  // Get movies with pagination, filtering, and sorting
  async getMovies(
    page: number = 1,
    limit: number = 10,
    filters: any = {},
    sortBy: string = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<{ movies: IMovie[]; total: number; pages: number }> {
    const skip = (page - 1) * limit;
    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Only show active movies
    filters.isActive = true;
    
    const total = await Movie.countDocuments(filters);
    const pages = Math.ceil(total / limit);
    
    const movies = await Movie.find(filters)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('genres', 'name')
      .populate('categories', 'name');
    
    return { movies, total, pages };
  }

  // Search movies by text
  async searchMovies(
    query: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ movies: IMovie[]; total: number; pages: number }> {
    const skip = (page - 1) * limit;
    
    const searchFilter = {
      $text: { $search: query },
      isActive: true
    };
    
    const total = await Movie.countDocuments(searchFilter);
    const pages = Math.ceil(total / limit);
    
    const movies = await Movie.find(searchFilter, { score: { $meta: "textScore" } })
      .sort({ score: { $meta: "textScore" } })
      .skip(skip)
      .limit(limit)
      .populate('genres', 'name')
      .populate('categories', 'name');
    
    return { movies, total, pages };
  }

  // Get movies by genre
  async getMoviesByGenre(
    genreId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ movies: IMovie[]; total: number; pages: number }> {
    return this.getMovies(page, limit, { genres: genreId });
  }

  // Get movies by category
  async getMoviesByCategory(
    categoryId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ movies: IMovie[]; total: number; pages: number }> {
    return this.getMovies(page, limit, { categories: categoryId });
  }

  // Get featured movies
  async getFeaturedMovies(limit: number = 10): Promise<IMovie[]> {
    return Movie.find({ isActive: true, isFeatured: true })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('genres', 'name')
      .populate('categories', 'name');
  }

  // Update movie rating when a new rating is added
  async updateMovieRating(movieId: string, newRating: number): Promise<void> {
    const movie = await Movie.findById(movieId);
    if (!movie) return;
    
    const currentTotal = movie.averageRating * movie.ratingCount;
    const newCount = movie.ratingCount + 1;
    const newAverage = (currentTotal + newRating) / newCount;
    
    await Movie.findByIdAndUpdate(movieId, {
      averageRating: newAverage,
      ratingCount: newCount
    });
  }

  // Increment view count for a movie
  async incrementViewCount(movieId: string): Promise<void> {
    await Movie.findByIdAndUpdate(movieId, { $inc: { viewCount: 1 } });
  }
}