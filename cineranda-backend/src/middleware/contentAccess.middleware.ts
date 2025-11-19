import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { User } from '../data/models/user.model';
import { Content } from '../data/models/movie.model';
import AppError from '../utils/AppError';

/**
 * Check if user has access to specific content (movie or full series)
 * UPDATED: Admins bypass purchase checks
 */
export const checkContentAccess = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const { contentId } = req.params;

    // Get content
    const content = await Content.findById(contentId);
    if (!content) {
      return next(new AppError('Content not found', 404));
    }

    // **ADMIN BYPASS**: Admins can watch everything
    if (req.user.role === 'admin') {
      console.log('🔓 Admin access granted - bypassing purchase checks');
      (req as any).content = content;
      return next();
    }

    // Get user with purchased content
    const user = await User.findById(req.user._id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Check if user has purchased this content
    const hasPurchased = user.purchasedContent?.some(
      (pc: any) => pc.contentId.toString() === contentId
    );

    if (!hasPurchased) {
      return next(new AppError('You need to purchase this content to watch', 403));
    }

    // Attach content to request for use in controller
    (req as any).content = content;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user has access to specific episode
 * UPDATED: Admins bypass purchase checks
 */
export const checkEpisodeAccess = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const { contentId, episodeId } = req.params;

    // Get series
    const series = await Content.findOne({ _id: contentId, contentType: 'Series' });
    if (!series) {
      return next(new AppError('Series not found', 404));
    }

    // Find the episode
    let episode: any = null;
    let seasonNumber: number = 0;

    for (const season of series.seasons || []) {
      const foundEpisode = season.episodes.find(
        (ep: any) => ep._id.toString() === episodeId
      );
      if (foundEpisode) {
        episode = foundEpisode;
        seasonNumber = season.seasonNumber;
        break;
      }
    }

    if (!episode) {
      return next(new AppError('Episode not found', 404));
    }

    // **ADMIN BYPASS**: Admins can watch everything
    if (req.user.role === 'admin') {
      console.log('🔓 Admin access granted - bypassing purchase checks');
      (req as any).episode = episode;
      (req as any).series = series;
      (req as any).seasonNumber = seasonNumber;
      return next();
    }

    // Check if episode is free
    if (episode.isFree) {
      (req as any).episode = episode;
      (req as any).series = series;
      (req as any).seasonNumber = seasonNumber;
      return next();
    }

    // Get user with purchased content
    const user = await User.findById(req.user._id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Check if user purchased the full series
    const hasFullSeries = user.purchasedContent?.some(
      (pc: any) => pc.contentId.toString() === contentId
    );

    if (hasFullSeries) {
      // Check if episode was added after series purchase
      const seriesPurchase = user.purchasedContent?.find(
        (pc: any) => pc.contentId.toString() === contentId
      );
      
      if (seriesPurchase && seriesPurchase.episodeIdsAtPurchase) {
        const episodeIdStr = episodeId.toString();
        const purchasedEpisodeIds = seriesPurchase.episodeIdsAtPurchase as string[];
        const wasAvailableAtPurchase = purchasedEpisodeIds.includes(episodeIdStr);
        
        if (!wasAvailableAtPurchase) {
          // Check if user has purchased this specific locked episode separately
          const hasPurchasedLockedEpisode = user.purchasedEpisodes?.some(
            (pe: any) => pe.episodeId.toString() === episodeId
          );
          
          if (hasPurchasedLockedEpisode) {
            // User bought the locked episode separately - allow access
            (req as any).episode = episode;
            (req as any).series = series;
            (req as any).seasonNumber = seasonNumber;
            return next();
          }
          
          return next(new AppError(
            `This episode was added to ${series.title} after you purchased the full series. Please purchase this episode separately or upgrade your purchase.`,
            403
          ));
        }
      }
      
      (req as any).episode = episode;
      (req as any).series = series;
      (req as any).seasonNumber = seasonNumber;
      return next();
    }

    // Check if user purchased the season containing this episode
    const seasonPurchase = user.purchasedSeasons?.find(
      (ps: any) => ps.contentId.toString() === contentId && ps.seasonNumber === seasonNumber
    );

    if (seasonPurchase) {
      // Check if episode was added after season purchase
      if (seasonPurchase.episodeIdsAtPurchase) {
        const episodeIdStr = episodeId.toString();
        const purchasedEpisodeIds = seasonPurchase.episodeIdsAtPurchase as string[];
        const wasAvailableAtPurchase = purchasedEpisodeIds.includes(episodeIdStr);
        
        if (!wasAvailableAtPurchase) {
          return next(new AppError(
            `This episode was added to Season ${seasonNumber} after you purchased it. Please purchase this episode separately.`,
            403
          ));
        }
      }
      
      (req as any).episode = episode;
      (req as any).series = series;
      (req as any).seasonNumber = seasonNumber;
      return next();
    }

    // Check if user purchased this specific episode
    const hasPurchasedEpisode = user.purchasedEpisodes?.some(
      (pe: any) => pe.episodeId.toString() === episodeId
    );

    if (!hasPurchasedEpisode) {
      return next(new AppError('You need to purchase this episode or the full series to watch', 403));
    }

    // Attach episode and series to request
    (req as any).episode = episode;
    (req as any).series = series;
    (req as any).seasonNumber = seasonNumber;
    next();
  } catch (error) {
    next(error);
  }
};