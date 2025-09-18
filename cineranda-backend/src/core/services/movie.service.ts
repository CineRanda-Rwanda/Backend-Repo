import { MovieRepository } from '../../data/repositories/movie.repository';
import { UserRepository } from '../../data/repositories/user.repository';
import { PurchaseRepository } from '../../data/repositories/purchase.repository';
import AppError from '../../utils/AppError';
import { IMovie } from '../../data/models';
import { v4 as uuidv4 } from 'uuid';

export class MovieService {
  private movieRepository: MovieRepository;
  private userRepository: UserRepository;
  private purchaseRepository: PurchaseRepository;

  constructor() {
    this.movieRepository = new MovieRepository();
    this.userRepository = new UserRepository();
    this.purchaseRepository = new PurchaseRepository();
  }

  async getMovies(options: {
    type?: 'movie' | 'series' | 'episode';
    genre?: string;
    language?: string;
    isFeatured?: boolean;
    search?: string;
    page?: number;
    limit?: number;
    sort?: string;
  }) {
    return this.movieRepository.findMovies(options);
  }

  async getMovieById(movieId: string, userId?: string): Promise<any> {
    const movie = await this.movieRepository.findById(movieId);
    
    if (!movie) {
      throw new AppError('Movie not found', 404);
    }
    
    // Check if this is a series and populate episodes
    if (movie.type === 'series') {
      const seriesWithEpisodes = await this.movieRepository.findSeriesWithEpisodes(movieId);
      movie.episodes = seriesWithEpisodes?.episodes || [];
    }
    
    // If userId is provided, check if user has purchased this content
    let hasPurchased = false;
    if (userId) {
      hasPurchased = await this.userRepository.hasAccessToContent(userId, movieId);
    }
    
    // Return movie with purchase info
    return {
      ...movie.toObject(),
      hasPurchased
    };
  }

  async incrementMovieViews(movieId: string, region: string): Promise<void> {
    const regionMapping = {
      'rwanda': 'rwanda',
      'east-africa': 'eastAfrica',
      'other-africa': 'otherAfrica',
      'international': 'international'
    };
    
    const mappedRegion = regionMapping[region] || 'international';
    
    await this.movieRepository.incrementViews(movieId, mappedRegion);
  }

  async incrementTrailerViews(movieId: string, region: string): Promise<void> {
    const regionMapping = {
      'rwanda': 'rwanda',
      'east-africa': 'eastAfrica',
      'other-africa': 'otherAfrica',
      'international': 'international'
    };
    
    const mappedRegion = regionMapping[region] || 'international';
    
    await this.movieRepository.incrementTrailerViews(movieId, mappedRegion);
  }

  async updateWatchProgress(userId: string, movieId: string, progress: number, watchTime: number): Promise<void> {
    await this.userRepository.updateWatchProgress(userId, movieId, progress, watchTime);
  }

  async createMovie(movieData: Partial<IMovie>, adminId: string): Promise<IMovie> {
    if (!movieData.title || !movieData.description || !movieData.type) {
      throw new AppError('Missing required movie information', 400);
    }
    
    // Set uploaded by admin
    movieData.uploadedBy = adminId;
    
    // Create the movie
    return this.movieRepository.create(movieData);
  }

  async updateMovie(movieId: string, movieData: Partial<IMovie>): Promise<IMovie> {
    const movie = await this.movieRepository.update(movieId, movieData);
    
    if (!movie) {
      throw new AppError('Movie not found', 404);
    }
    
    return movie;
  }

  async toggleMovieActive(movieId: string, isActive: boolean): Promise<IMovie> {
    const movie = await this.movieRepository.update(movieId, { isActive });
    
    if (!movie) {
      throw new AppError('Movie not found', 404);
    }
    
    return movie;
  }

  async toggleMovieFeatured(movieId: string, isFeatured: boolean): Promise<IMovie> {
    const movie = await this.movieRepository.update(movieId, { isFeatured });
    
    if (!movie) {
      throw new AppError('Movie not found', 404);
    }
    
    return movie;
  }

  async deleteMovie(movieId: string): Promise<boolean> {
    const deleted = await this.movieRepository.delete(movieId);
    
    if (!deleted) {
      throw new AppError('Movie not found', 404);
    }
    
    return true;
  }

  async purchaseMovie(
    userId: string,
    movieId: string,
    paymentMethod: string,
    pricingTier: string,
    userDetails: {
      ipAddress?: string;
      location?: string;
      deviceInfo?: string;
      conversionSource?: string;
    }
  ): Promise<{ transactionId: string; price: number; currency: string }> {
    // Get movie
    const movie = await this.movieRepository.findById(movieId);
    if (!movie) {
      throw new AppError('Movie not found', 404);
    }
    
    // Check if movie is active
    if (!movie.isActive || !movie.isPublished) {
      throw new AppError('This content is not available for purchase', 400);
    }
    
    // Determine price based on pricing tier
    let price: number;
    let currency: string;
    
    if (pricingTier === 'rwanda') {
      price = movie.pricing.rwanda.price;
      currency = movie.pricing.rwanda.currency;
    } else if (pricingTier === 'east-africa') {
      price = movie.pricing.eastAfrica.price;
      currency = movie.pricing.eastAfrica.currency;
    } else if (pricingTier === 'other-africa') {
      price = movie.pricing.otherAfrica.price;
      currency = movie.pricing.otherAfrica.currency;
    } else {
      price = movie.pricing.international.price;
      currency = movie.pricing.international.currency;
    }
    
    // Generate unique transaction ID
    const transactionId = uuidv4();
    
    // Create purchase record
    await this.purchaseRepository.create({
      user: userId,
      content: movieId,
      contentType: movie.type,
      price,
      currency,
      pricingTier,
      paymentMethod,
      paymentStatus: 'pending',
      transactionId,
      isActive: true,
      userIpAddress: userDetails.ipAddress,
      userLocation: userDetails.location,
      deviceInfo: userDetails.deviceInfo,
      conversionSource: userDetails.conversionSource
    });
    
    return {
      transactionId,
      price,
      currency
    };
  }

  async confirmPurchase(transactionId: string, externalTransactionId?: string): Promise<void> {
    // Find the purchase
    const purchase = await this.purchaseRepository.findByTransactionId(transactionId);
    if (!purchase) {
      throw new AppError('Transaction not found', 404);
    }
    
    // Update purchase status
    await this.purchaseRepository.updatePaymentStatus(
      transactionId,
      'completed',
      externalTransactionId
    );
    
    // Add to user's purchased content
    await this.userRepository.addToPurchasedContent(
      purchase.user.toString(),
      {
        contentId: purchase.content.toString(),
        contentType: purchase.contentType,
        price: purchase.price,
        currency: purchase.currency,
        paymentMethod: purchase.paymentMethod,
        transactionId: purchase.transactionId
      }
    );
    
    // Update movie purchase count and revenue
    const regionMapping = {
      'rwanda': 'rwanda',
      'east-africa': 'eastAfrica',
      'other-africa': 'otherAfrica',
      'international': 'international'
    };
    
    const mappedRegion = regionMapping[purchase.pricingTier] || 'international';
    
    await this.movieRepository.recordPurchase(
      purchase.content.toString(),
      purchase.price,
      mappedRegion
    );
  }

  async getUserWatchHistory(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Get movie details for each watched item
    const watchHistory = await Promise.all(
      user.watchHistory.map(async (historyItem) => {
        const movie = await this.movieRepository.findById(historyItem.contentId.toString());
        return {
          ...historyItem.toObject(),
          movie: movie ? {
            _id: movie._id,
            title: movie.title,
            poster: movie.poster,
            type: movie.type,
            duration: movie.duration
          } : null
        };
      })
    );
    
    return watchHistory.filter(item => item.movie !== null);
  }

  async getUserPurchases(userId: string) {
    return this.purchaseRepository.findUserPurchases(userId);
  }
}