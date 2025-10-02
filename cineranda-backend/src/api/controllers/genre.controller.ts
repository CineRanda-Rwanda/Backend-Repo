import { Request, Response, NextFunction } from 'express';
import { GenreRepository } from '../../data/repositories/genre.repository';
import AppError from '../../utils/AppError';
import { AuthRequest } from '../../middleware/auth.middleware';

// First, add an interface for MongoDB errors
interface MongoError extends Error {
  code?: number;
}

export class GenreController {
  private genreRepository: GenreRepository;

  constructor() {
    this.genreRepository = new GenreRepository();
  }

  // Get all genres (public)
  getAllGenres = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const genres = await this.genreRepository.getActiveGenres();
      
      res.status(200).json({
        status: 'success',
        results: genres.length,
        data: { genres }
      });
    } catch (error) {
      next(error);
    }
  };

  // Admin: Create genre
  createGenre = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { name, description } = req.body;
      
      if (!name) {
        return next(new AppError('Genre name is required', 400));
      }

      const genre = await this.genreRepository.create({
        name,
        description,
        isActive: true
      });

      res.status(201).json({
        status: 'success',
        data: { genre }
      });
    } catch (error) {
      // Fix type checking for error
      if (error instanceof Error && (error as MongoError).code === 11000) {
        return next(new AppError('A genre with that name already exists', 400));
      }
      next(error);
    }
  };

  // Admin: Update genre
  updateGenre = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, description, isActive } = req.body;

      const genre = await this.genreRepository.findById(id);
      
      if (!genre) {
        return next(new AppError('Genre not found', 404));
      }

      const updatedGenre = await this.genreRepository.update(id, {
        name,
        description,
        isActive
      });

      res.status(200).json({
        status: 'success',
        data: { genre: updatedGenre }
      });
    } catch (error) {
      // Fix type checking for error
      if (error instanceof Error && (error as MongoError).code === 11000) {
        return next(new AppError('A genre with that name already exists', 400));
      }
      next(error);
    }
  };

  // Admin: Delete genre
  deleteGenre = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const genre = await this.genreRepository.findById(id);
      
      if (!genre) {
        return next(new AppError('Genre not found', 404));
      }

      await this.genreRepository.delete(id);

      res.status(200).json({
        status: 'success',
        data: null
      });
    } catch (error) {
      next(error);
    }
  };
}