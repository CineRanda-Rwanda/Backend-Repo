import { WatchHistory, IWatchHistory } from '../models/watchHistory.model';
import { BaseRepository } from './base.repository';
import mongoose from 'mongoose';

export class WatchHistoryRepository extends BaseRepository<IWatchHistory> {
  constructor() {
    super(WatchHistory);
  }

  async getUserWatchHistory(userId: string, limit: number = 20): Promise<IWatchHistory[]> {
    return WatchHistory.find({ userId })
      .sort({ lastWatched: -1 })
      .limit(limit)
      .populate({
        path: 'movieId',
        select: 'title thumbnailUrl duration'
      });
  }

  async getInProgressMovies(userId: string, limit: number = 10): Promise<IWatchHistory[]> {
    return WatchHistory.find({ 
      userId, 
      completed: false 
    })
      .sort({ lastWatched: -1 })
      .limit(limit)
      .populate({
        path: 'movieId',
        select: 'title thumbnailUrl duration'
      });
  }

  async updateWatchProgress(
    userId: string,
    movieId: string,
    watchedDuration: number,
    movieDuration: number
  ): Promise<IWatchHistory> {
    // Calculate if movie is completed (watched more than 90%)
    const completed = watchedDuration >= movieDuration * 0.9;
    
    return WatchHistory.findOneAndUpdate(
      { userId, movieId },
      {
        watchedDuration,
        completed,
        lastWatched: new Date()
      },
      { upsert: true, new: true }
    );
  }
}