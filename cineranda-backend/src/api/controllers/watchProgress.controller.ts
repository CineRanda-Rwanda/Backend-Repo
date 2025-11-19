import { Response, NextFunction } from 'express';
import { WatchProgressRepository } from '../../data/repositories/watchProgress.repository';
import { Content } from '../../data/models/movie.model';
import { AuthRequest } from '../../middleware/auth.middleware';
import AppError from '../../utils/AppError';
import mongoose from 'mongoose';

const watchProgressRepository = new WatchProgressRepository();

export class WatchProgressController {
  /**
   * POST /watch-progress - Save or update watch progress
   */
  saveProgress = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }
      const userId = req.user._id.toString();
      const {
        contentId,
        contentType,
        episodeId,
        seasonNumber,
        episodeNumber,
        progress,
        duration,
        lastWatchedAt
      } = req.body;

      // Validation
      if (!contentId || !contentType || progress === undefined || duration === undefined) {
        throw new AppError('Content ID, type, progress, and duration are required', 400);
      }

      if (!['Movie', 'Episode'].includes(contentType)) {
        throw new AppError('Content type must be either Movie or Episode', 400);
      }

      if (!mongoose.Types.ObjectId.isValid(contentId)) {
        throw new AppError('Invalid content ID', 400);
      }

      if (contentType === 'Episode' && (!episodeId || !seasonNumber || !episodeNumber)) {
        throw new AppError('Episode ID, season number, and episode number are required for episodes', 400);
      }

      if (progress < 0 || duration < 0) {
        throw new AppError('Progress and duration must be non-negative', 400);
      }

      if (episodeId && !mongoose.Types.ObjectId.isValid(episodeId)) {
        throw new AppError('Invalid episode ID', 400);
      }

      // Check if content exists
      const content = await Content.findById(contentId);
      if (!content) {
        throw new AppError('Content not found', 404);
      }

      // Save progress
      const watchProgress = await watchProgressRepository.saveProgress({
        userId,
        contentId,
        contentType,
        episodeId,
        seasonNumber,
        episodeNumber,
        progress,
        duration,
        lastWatchedAt: lastWatchedAt ? new Date(lastWatchedAt) : new Date()
      });

      res.status(200).json({
        status: 'success',
        message: 'Watch progress saved',
        data: {
          watchProgress: {
            _id: watchProgress._id,
            userId: watchProgress.userId,
            contentId: watchProgress.contentId,
            contentType: watchProgress.contentType,
            episodeId: watchProgress.episodeId,
            seasonNumber: watchProgress.seasonNumber,
            episodeNumber: watchProgress.episodeNumber,
            progress: watchProgress.progress,
            duration: watchProgress.duration,
            percentageWatched: watchProgress.percentageWatched,
            lastWatchedAt: watchProgress.lastWatchedAt,
            isCompleted: watchProgress.isCompleted
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /:contentId - Get watch progress for specific content
   */
  getProgress = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }
      const userId = req.user._id.toString();
      const { contentId } = req.params;
      const { episodeId } = req.query;

      if (!mongoose.Types.ObjectId.isValid(contentId)) {
        throw new AppError('Invalid content ID', 400);
      }

      if (episodeId && !mongoose.Types.ObjectId.isValid(episodeId as string)) {
        throw new AppError('Invalid episode ID', 400);
      }

      const watchProgress = await watchProgressRepository.getProgress(
        userId,
        contentId,
        episodeId as string | undefined
      );

      if (!watchProgress) {
        return res.status(404).json({
          status: 'error',
          message: 'No watch progress found for this content'
        });
      }

      res.status(200).json({
        status: 'success',
        data: {
          watchProgress: {
            contentId: watchProgress.contentId,
            contentType: watchProgress.contentType,
            episodeId: watchProgress.episodeId,
            seasonNumber: watchProgress.seasonNumber,
            episodeNumber: watchProgress.episodeNumber,
            progress: watchProgress.progress,
            duration: watchProgress.duration,
            percentageWatched: watchProgress.percentageWatched,
            lastWatchedAt: watchProgress.lastWatchedAt,
            isCompleted: watchProgress.isCompleted
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /watch-progress - Get continue watching list
   */
  getContinueWatching = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }
      const userId = req.user._id.toString();
      const { limit = '10', excludeCompleted = 'true' } = req.query;

      const limitNum = parseInt(limit as string);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
        throw new AppError('Limit must be between 1 and 50', 400);
      }

      const continueWatching = await watchProgressRepository.getContinueWatching(userId, {
        limit: limitNum,
        excludeCompleted: excludeCompleted === 'true'
      });

      res.status(200).json({
        status: 'success',
        data: {
          continueWatching
        }
      });
    } catch (error) {
      next(error);
    }
  }
}
