import { Request, Response, NextFunction } from 'express';
import { Favorite } from '../../data/models/favorite.model';
import { Content } from '../../data/models/movie.model';
import { AuthRequest } from '../../middleware/auth.middleware';
import AppError from '../../utils/AppError';

export class FavoriteController {
  // Removed movieRepository dependency

  constructor() {
    // No initialization needed
  }

  // Add movie to favorites
  addToFavorites = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }
      const userId = req.user._id;
      const { movieId } = req.body;
      
      if (!movieId) {
        return next(new AppError('Movie ID is required', 400));
      }
      
      // Verify movie exists
      const movie = await Content.findById(movieId);
      if (!movie) {
        return next(new AppError('Movie not found', 404));
      }
      
      // Check if already in favorites
      const existingFavorite = await Favorite.findOne({ userId, movieId });
      if (existingFavorite) {
        return res.status(200).json({
          status: 'success',
          message: 'Movie already in favorites',
          data: { favorite: existingFavorite }
        });
      }
      
      // Add to favorites
      const favorite = await Favorite.create({
        userId,
        movieId
      });
      
      res.status(201).json({
        status: 'success',
        message: 'Movie added to favorites',
        data: { favorite }
      });
    } catch (error) {
      next(error);
    }
  };

  // Remove movie from favorites
  removeFromFavorites = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }
      const userId = req.user._id;
      const { movieId } = req.params;
      
      const result = await Favorite.deleteOne({ userId, movieId });
      
      if (result.deletedCount === 0) {
        return next(new AppError('Movie not found in favorites', 404));
      }
      
      res.status(200).json({
        status: 'success',
        message: 'Movie removed from favorites',
        data: null
      });
    } catch (error) {
      next(error);
    }
  };

  // Get user's favorites
  getUserFavorites = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }
      const userId = req.user._id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;
      
      const total = await Favorite.countDocuments({ userId });
      const favorites = await Favorite.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'movieId',
          select: 'title posterImageUrl genres categories averageRating'
        });
      
      const pages = Math.ceil(total / limit);
      
      res.status(200).json({
        status: 'success',
        results: favorites.length,
        pagination: {
          total,
          page,
          pages,
          limit
        },
        data: { favorites }
      });
    } catch (error) {
      next(error);
    }
  };

  // Check if movie is in user's favorites
  checkFavoriteStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }
      const userId = req.user._id;
      const { movieId } = req.params;
      
      const isFavorite = await Favorite.exists({ userId, movieId });
      
      res.status(200).json({
        status: 'success',
        data: { isFavorite: !!isFavorite }
      });
    } catch (error) {
      next(error);
    }
  };
}