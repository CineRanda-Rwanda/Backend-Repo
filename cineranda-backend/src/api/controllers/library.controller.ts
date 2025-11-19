import { Response, NextFunction } from 'express';
import { LibraryRepository } from '../../data/repositories/library.repository';
import { Content } from '../../data/models/movie.model';
import { AuthRequest } from '../../middleware/auth.middleware';
import AppError from '../../utils/AppError';
import mongoose from 'mongoose';

const libraryRepository = new LibraryRepository();

export class LibraryController {
  /**
   * POST /library - Add content to user library
   */
  addToLibrary = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }
      const userId = req.user._id.toString();
      const { contentId, contentType } = req.body;

      // Validation
      if (!contentId || !contentType) {
        throw new AppError('Content ID and type are required', 400);
      }

      if (!['Movie', 'Series'].includes(contentType)) {
        throw new AppError('Content type must be either Movie or Series', 400);
      }

      if (!mongoose.Types.ObjectId.isValid(contentId)) {
        throw new AppError('Invalid content ID', 400);
      }

      // Check if content exists
      const content = await Content.findById(contentId);
      if (!content) {
        throw new AppError('Content not found', 404);
      }

      // Check if already in library
      const alreadyExists = await libraryRepository.isInLibrary(userId, contentId);
      if (alreadyExists) {
        return res.status(409).json({
          status: 'error',
          message: 'Content already in library'
        });
      }

      // Add to library
      const libraryItem = await libraryRepository.addToLibrary(userId, contentId, contentType);

      res.status(200).json({
        status: 'success',
        message: 'Content added to library',
        data: {
          libraryItem: {
            _id: libraryItem._id,
            userId: libraryItem.userId,
            contentId: libraryItem.contentId,
            contentType: libraryItem.contentType,
            addedAt: libraryItem.addedAt
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /library - Get user's library
   */
  getLibrary = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }
      const userId = req.user._id.toString();
      const {
        page = '1',
        limit = '20',
        contentType,
        sortBy = 'addedAt',
        sortOrder = 'desc'
      } = req.query;

      // Validation
      if (contentType && !['Movie', 'Series'].includes(contentType as string)) {
        throw new AppError('Invalid content type', 400);
      }

      if (sortBy && !['addedAt', 'title'].includes(sortBy as string)) {
        throw new AppError('Invalid sortBy parameter', 400);
      }

      if (sortOrder && !['asc', 'desc'].includes(sortOrder as string)) {
        throw new AppError('Invalid sortOrder parameter', 400);
      }

      const result = await libraryRepository.getUserLibrary(userId, {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        contentType: contentType as 'Movie' | 'Series' | undefined,
        sortBy: sortBy as 'addedAt' | 'title',
        sortOrder: sortOrder as 'asc' | 'desc'
      });

      res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /library/:contentId - Remove content from library
   */
  removeFromLibrary = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }
      const userId = req.user._id.toString();
      const { contentId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(contentId)) {
        throw new AppError('Invalid content ID', 400);
      }

      const removed = await libraryRepository.removeFromLibrary(userId, contentId);

      if (!removed) {
        return res.status(404).json({
          status: 'error',
          message: 'Content not found in library'
        });
      }

      res.status(200).json({
        status: 'success',
        message: 'Content removed from library'
      });
    } catch (error) {
      next(error);
    }
  }
}
