import { WatchProgress, IWatchProgress } from '../models/watchProgress.model';
import mongoose from 'mongoose';

export class WatchProgressRepository {
  /**
   * Save or update watch progress
   */
  async saveProgress(data: {
    userId: string;
    contentId: string;
    contentType: 'Movie' | 'Episode';
    episodeId?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    progress: number;
    duration: number;
    lastWatchedAt?: Date;
  }): Promise<IWatchProgress> {
    const {
      userId,
      contentId,
      contentType,
      episodeId,
      seasonNumber,
      episodeNumber,
      progress,
      duration,
      lastWatchedAt = new Date()
    } = data;

    const query: any = {
      userId: new mongoose.Types.ObjectId(userId),
      contentId: new mongoose.Types.ObjectId(contentId)
    };

    // For episodes, include episodeId in the query
    if (contentType === 'Episode' && episodeId) {
      query.episodeId = new mongoose.Types.ObjectId(episodeId);
    }

    const updateData: any = {
      contentType,
      progress,
      duration,
      lastWatchedAt
    };

    // Calculate percentageWatched
    if (duration > 0) {
      updateData.percentageWatched = Math.round((progress / duration) * 100 * 100) / 100;
      updateData.isCompleted = updateData.percentageWatched >= 95;
    }

    if (episodeId) {
      updateData.episodeId = new mongoose.Types.ObjectId(episodeId);
    }
    if (seasonNumber !== undefined) {
      updateData.seasonNumber = seasonNumber;
    }
    if (episodeNumber !== undefined) {
      updateData.episodeNumber = episodeNumber;
    }

    const watchProgress = await WatchProgress.findOneAndUpdate(
      query,
      updateData,
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    );

    return watchProgress;
  }

  /**
   * Get watch progress for specific content
   */
  async getProgress(
    userId: string,
    contentId: string,
    episodeId?: string
  ): Promise<IWatchProgress | null> {
    const query: any = {
      userId: new mongoose.Types.ObjectId(userId),
      contentId: new mongoose.Types.ObjectId(contentId)
    };

    if (episodeId) {
      query.episodeId = new mongoose.Types.ObjectId(episodeId);
    }

    return await WatchProgress.findOne(query);
  }

  /**
   * Get continue watching list
   */
  async getContinueWatching(
    userId: string,
    options: {
      limit?: number;
      excludeCompleted?: boolean;
    } = {}
  ) {
    const { limit = 10, excludeCompleted = true } = options;

    const query: any = {
      userId: new mongoose.Types.ObjectId(userId)
    };

    if (excludeCompleted) {
      query.isCompleted = false;
    }

    const continueWatching = await WatchProgress.find(query)
      .sort({ lastWatchedAt: -1 })
      .limit(limit)
      .populate({
        path: 'contentId',
        select: 'title contentType posterImageUrl duration'
      })
      .lean();

    // Filter out items where content was deleted
    const validContinueWatching = continueWatching.filter((item: any) => item.contentId !== null);

    return validContinueWatching.map((item: any) => ({
      _id: item._id,
      content: {
        _id: item.contentId._id,
        title: item.contentId.title,
        contentType: item.contentType,
        posterImageUrl: item.contentId.posterImageUrl,
        duration: item.duration
      },
      progress: item.progress,
      percentageWatched: item.percentageWatched,
      lastWatchedAt: item.lastWatchedAt,
      episodeId: item.episodeId,
      seasonNumber: item.seasonNumber,
      episodeNumber: item.episodeNumber
    }));
  }

  /**
   * Delete watch progress
   */
  async deleteProgress(userId: string, contentId: string, episodeId?: string): Promise<boolean> {
    const query: any = {
      userId: new mongoose.Types.ObjectId(userId),
      contentId: new mongoose.Types.ObjectId(contentId)
    };

    if (episodeId) {
      query.episodeId = new mongoose.Types.ObjectId(episodeId);
    }

    const result = await WatchProgress.deleteOne(query);
    return result.deletedCount > 0;
  }

  /**
   * Get total watch time for user
   */
  async getTotalWatchTime(userId: string): Promise<number> {
    const result = await WatchProgress.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId)
        }
      },
      {
        $group: {
          _id: null,
          totalTime: { $sum: '$progress' }
        }
      }
    ]);

    return result.length > 0 ? result[0].totalTime : 0;
  }

  /**
   * Get watch progress for all episodes of a series
   */
  async getSeriesProgress(userId: string, seriesId: string) {
    return await WatchProgress.find({
      userId: new mongoose.Types.ObjectId(userId),
      contentId: new mongoose.Types.ObjectId(seriesId),
      contentType: 'Episode'
    }).sort({ seasonNumber: 1, episodeNumber: 1 });
  }
}
