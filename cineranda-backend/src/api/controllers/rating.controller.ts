import { Request, Response, NextFunction } from 'express';
import { Rating } from '../../data/models/rating.model';
import { MovieRepository } from '../../data/repositories/movie.repository';
import { AuthRequest } from '../../middleware/auth.middleware';
import AppError from '../../utils/AppError';
import mongoose from 'mongoose';

export class RatingController {
  private movieRepository: MovieRepository;

  constructor() {
    this.movieRepository = new MovieRepository();
  }

  // Submit a rating and review
  submitRating = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }
      const userId = req.user._id as mongoose.Types.ObjectId;
      const { movieId, rating, review } = req.body;
      
      if (!movieId || !rating) {
        return next(new AppError('Movie ID and rating are required', 400));
      }
      
      if (rating < 1 || rating > 5) {
        return next(new AppError('Rating must be between 1 and 5', 400));
      }
      
      // Verify movie exists
      const movie = await this.movieRepository.findById(movieId);
      if (!movie) {
        return next(new AppError('Movie not found', 404));
      }
      
      // Check if user already rated this movie
      const existingRating = await Rating.findOne({ userId, movieId });
      
      if (existingRating) {
        // Update existing rating
        existingRating.rating = rating;
        if (review !== undefined) {
          existingRating.review = review;
        }
        await existingRating.save();
        
        res.status(200).json({
          status: 'success',
          data: { rating: existingRating }
        });
      } else {
        // Create new rating
        const newRating = await Rating.create({
          userId,
          movieId,
          rating,
          review
        });
        
        // Update movie's average rating
        await this.movieRepository.updateMovieRating(movieId, rating);
        
        res.status(201).json({
          status: 'success',
          data: { rating: newRating }
        });
      }
    } catch (error) {
      next(error);
    }
  };

  // Get ratings for a movie
  getMovieRatings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { movieId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;
      
      // Get movie first to verify it exists
      const movie = await this.movieRepository.findById(movieId);
      if (!movie) {
        return next(new AppError('Movie not found', 404));
      }
      
      // Get ratings with pagination
      const total = await Rating.countDocuments({ movieId });
      const ratings = await Rating.find({ movieId })
        .populate('userId', 'username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      
      const pages = Math.ceil(total / limit);
      
      res.status(200).json({
        status: 'success',
        results: ratings.length,
        pagination: {
          total,
          page,
          pages,
          limit
        },
        data: { 
          ratings,
          averageRating: movie.averageRating,
          ratingCount: movie.ratingCount
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Get user's rating for a specific movie
  getUserRatingForMovie = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }
      const userId = req.user._id as mongoose.Types.ObjectId;
      const { movieId } = req.params;
      
      const rating = await Rating.findOne({ userId, movieId });
      
      if (!rating) {
        return res.status(200).json({
          status: 'success',
          data: { rating: null }
        });
      }
      
      res.status(200).json({
        status: 'success',
        data: { rating }
      });
    } catch (error) {
      next(error);
    }
  };

  // Delete a rating
  deleteRating = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }
      const userId = req.user._id as mongoose.Types.ObjectId;
      const { id } = req.params;
      
      const rating = await Rating.findById(id);
      
      if (!rating) {
        return next(new AppError('Rating not found', 404));
      }
      
      // Check if rating belongs to user
      if (rating.userId.toString() !== userId.toString()) {
        return next(new AppError('You are not authorized to delete this rating', 403));
      }
      
      await rating.deleteOne();
      
      res.status(200).json({
        status: 'success',
        data: null
      });
    } catch (error) {
      next(error);
    }
  };
}