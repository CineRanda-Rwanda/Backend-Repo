import { Request, Response, NextFunction } from 'express';
import { WatchHistoryRepository } from '../../data/repositories/watchHistory.repository';
import { MovieRepository } from '../../data/repositories/movie.repository';
import { AuthRequest } from '../../middleware/auth.middleware';
import AppError from '../../utils/AppError';
import mongoose from 'mongoose';

export class WatchHistoryController {
  private watchHistoryRepository: WatchHistoryRepository;
  private movieRepository: MovieRepository;

  constructor() {
    this.watchHistoryRepository = new WatchHistoryRepository();
    this.movieRepository = new MovieRepository();
  }

  // Get user's watch history
  getUserWatchHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }
      // Use type assertion to fix TypeScript error
      const userId = req.user._id as mongoose.Types.ObjectId;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const watchHistory = await this.watchHistoryRepository.getUserWatchHistory(userId.toString(), limit);
      
      res.status(200).json({
        status: 'success',
        results: watchHistory.length,
        data: { watchHistory }
      });
    } catch (error) {
      next(error);
    }
  };

  // Get user's in-progress movies (continue watching)
  getInProgressMovies = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }
      // Use type assertion to fix TypeScript error
      const userId = req.user._id as mongoose.Types.ObjectId;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const inProgress = await this.watchHistoryRepository.getInProgressMovies(userId.toString(), limit);
      
      res.status(200).json({
        status: 'success',
        results: inProgress.length,
        data: { inProgress }
      });
    } catch (error) {
      next(error);
    }
  };

  // Update watch progress
  updateWatchProgress = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }
      // Use type assertion to fix TypeScript error
      const userId = req.user._id as mongoose.Types.ObjectId;
      const { movieId, watchedDuration } = req.body;
      
      if (!movieId || watchedDuration === undefined) {
        return next(new AppError('Movie ID and watched duration are required', 400));
      }
      
      // Verify movie exists and get duration
      const movie = await this.movieRepository.findById(movieId);
      if (!movie) {
        return next(new AppError('Movie not found', 404));
      }
      
      // Update watch history
      const movieDuration = movie.duration || 0;
      const history = await this.watchHistoryRepository.updateWatchProgress(
        userId.toString(),
        movieId,
        watchedDuration,
        movieDuration
      );
      
      // Increment view count if this is a new view
      if (watchedDuration <= 10 && movieDuration > 0) { // Just started watching
        await this.movieRepository.incrementViewCount(movieId);
      }
      
      res.status(200).json({
        status: 'success',
        data: { watchProgress: history }
      });
    } catch (error) {
      next(error);
    }
  };
}