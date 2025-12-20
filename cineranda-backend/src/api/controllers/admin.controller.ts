import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { User, IUser } from '../../data/models/user.model'; // Import IUser
import AppError from '../../utils/AppError';

// This interface now correctly types the user property
interface AuthRequest extends Request {
  user?: IUser; // Use the IUser interface for type safety
}

export class AdminController {
  /**
   * Admin creates a new admin account.
   */
  createAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { username, email, password, phoneNumber, pin } = req.body;
      // Basic validation
      if (!username || !email || !password || !phoneNumber || !pin) {
        return next(new AppError('Please provide all required fields for the new admin.', 400));
      }

      // Check if an admin with this email already exists
      const existingAdmin = await User.findOne({ email });
      if (existingAdmin) {
        return next(new AppError('An account with this email already exists.', 409));
      }

      // Create the new admin with only the expected fields for security
      const newAdmin = await User.create({
        username,
        email,
        password,
        phoneNumber,
        pin,
        role: 'admin', // Force the role to be 'admin'
      });

      const adminObject = newAdmin.toObject();
      // The password and pin are already excluded by `select: false` in the schema,
      // so they won't be in the object to delete.

      res.status(201).json({
        status: 'success',
        message: 'New admin account created successfully.',
        data: {
          user: adminObject,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Admin grants a user free access to a specific movie.
   */
  grantFreeAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { userId, contentId } = req.body;
      const user = await User.findById(userId);
      // In a real app, you would also check if the contentId is a valid movie
      if (!user) {
        return next(new AppError('User not found.', 404));
      }

      // Add the movie to the user's purchasedContent array
      user.purchasedContent = user.purchasedContent || [];
      user.purchasedContent.push({
        contentId: contentId,
        purchaseDate: new Date(),
        price: 0, // Price is 0 for free access
        currency: 'BONUS',
      });

      await user.save();

      res.status(200).json({
        status: 'success',
        message: `Successfully granted access to user ${user.username}.`,
      });
    } catch (error) {
      next(error);
    }
  };

  unlockContentForUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { contentId, unlockType, seasonId, seasonNumber, episodeId } = req.body;

      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return next(new AppError('A valid userId parameter is required.', 400));
      }

      if (!contentId || !mongoose.Types.ObjectId.isValid(contentId)) {
        return next(new AppError('A valid contentId is required.', 400));
      }

      const user = await User.findById(userId);
      if (!user) {
        return next(new AppError('User not found.', 404));
      }

      const ContentModel = mongoose.model('Content');
      const content = await ContentModel.findById(contentId);

      if (!content) {
        return next(new AppError('Content not found.', 404));
      }

      const normalizedType = (typeof unlockType === 'string'
        ? unlockType
        : content.contentType === 'Series'
          ? 'series'
          : 'movie'
      ).toLowerCase();

      const parsedSeasonNumber = seasonNumber !== undefined ? Number(seasonNumber) : undefined;
      if (seasonNumber !== undefined && !Number.isFinite(parsedSeasonNumber)) {
        return next(new AppError('seasonNumber must be a valid number.', 400));
      }

      if (seasonId && (!mongoose.Types.ObjectId.isValid(seasonId))) {
        return next(new AppError('seasonId must be a valid identifier.', 400));
      }

      if (episodeId && !mongoose.Types.ObjectId.isValid(episodeId)) {
        return next(new AppError('episodeId must be a valid identifier.', 400));
      }

      if (normalizedType === 'season' && !seasonId && parsedSeasonNumber === undefined) {
        return next(new AppError('Provide either seasonId or seasonNumber to unlock a season.', 400));
      }

      if (normalizedType === 'episode' && !episodeId) {
        return next(new AppError('episodeId is required to unlock an episode.', 400));
      }

      const ensureArray = <T>(value: T[] | undefined | null): T[] => value || [];

      const collectEpisodeIds = (seasons: any[] = []): string[] => {
        const ids: string[] = [];
        seasons.forEach((season: any) => {
          (season?.episodes || []).forEach((episode: any) => {
            if (episode?._id) {
              ids.push(episode._id.toString());
            }
          });
        });
        return ids;
      };

      const findSeason = (): any => {
        if (!content.seasons || !Array.isArray(content.seasons)) {
          return null;
        }

        let targetSeason: any = null;

        if (seasonId && mongoose.Types.ObjectId.isValid(seasonId)) {
          targetSeason = content.seasons.find((season: any) => season?._id?.toString() === seasonId);
        }

        if (!targetSeason && parsedSeasonNumber !== undefined) {
          targetSeason = content.seasons.find((season: any) => season?.seasonNumber === parsedSeasonNumber);
        }

        return targetSeason;
      };

      const findEpisode = () => {
        if (!episodeId) {
          return { episode: null, parentSeason: null };
        }

        if (!content.seasons || !Array.isArray(content.seasons)) {
          return { episode: null, parentSeason: null };
        }

        for (const season of content.seasons) {
          if (parsedSeasonNumber !== undefined && season?.seasonNumber !== parsedSeasonNumber) {
            continue;
          }
          if (seasonId && mongoose.Types.ObjectId.isValid(seasonId) && season?._id?.toString() !== seasonId) {
            continue;
          }

          const episode = (season?.episodes || []).find((ep: any) => ep?._id?.toString() === episodeId);
          if (episode) {
            return { episode, parentSeason: season };
          }
        }

        return { episode: null, parentSeason: null };
      };

      if (['movie', 'series', 'content'].includes(normalizedType)) {
        user.purchasedContent = ensureArray(user.purchasedContent);

        const alreadyOwned = user.purchasedContent.some(
          (purchase: any) => purchase?.contentId?.toString() === contentId
        );

        if (alreadyOwned) {
          return next(new AppError('User already owns this content.', 400));
        }

        const episodeIdsAtPurchase = content.contentType === 'Series'
          ? collectEpisodeIds(content.seasons)
          : [];

        user.purchasedContent.push({
          contentId: content._id,
          purchaseDate: new Date(),
          price: 0,
          currency: 'RWF',
          episodeIdsAtPurchase
        });
      } else if (normalizedType === 'season') {
        const season = findSeason();
        if (!season || !season?._id) {
          return next(new AppError('Season not found for provided identifiers.', 404));
        }

        user.purchasedSeasons = ensureArray(user.purchasedSeasons);
        const alreadyOwnedSeason = user.purchasedSeasons.some(
          (entry: any) => entry?.seasonId?.toString() === season._id.toString()
        );

        if (alreadyOwnedSeason) {
          return next(new AppError('User already owns this season.', 400));
        }

        user.purchasedSeasons.push({
          contentId: content._id,
          seasonId: season._id,
          seasonNumber: season.seasonNumber,
          purchaseDate: new Date(),
          price: 0,
          currency: 'RWF',
          episodeIdsAtPurchase: (season.episodes || [])
            .filter((ep: any) => ep?._id)
            .map((ep: any) => ep._id.toString())
        });
      } else if (normalizedType === 'episode') {
        const { episode } = findEpisode();
        if (!episode || !episode?._id) {
          return next(new AppError('Episode not found for provided identifiers.', 404));
        }

        user.purchasedEpisodes = ensureArray(user.purchasedEpisodes);
        const alreadyOwnedEpisode = user.purchasedEpisodes.some(
          (entry: any) => entry?.episodeId?.toString() === episode._id.toString()
        );

        if (alreadyOwnedEpisode) {
          return next(new AppError('User already owns this episode.', 400));
        }

        user.purchasedEpisodes.push({
          contentId: content._id,
          episodeId: episode._id,
          purchaseDate: new Date(),
          price: 0,
          currency: 'RWF'
        });
      } else {
        return next(new AppError('Invalid unlockType. Use movie, series, season, or episode.', 400));
      }

      await user.save();
      const updatedUser = await User.findById(userId).select('-pin');

      res.status(200).json({
        status: 'success',
        message: `Unlocked ${normalizedType} for user successfully.`,
        data: {
          user: updatedUser,
          unlockType: normalizedType
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Placeholder for analytics dashboard data.
   */
  getAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const Content = mongoose.model('Content');
      const Purchase = mongoose.model('Purchase');
      
      // Overview stats
      const totalUsers = await User.countDocuments();
      const activeUsers = await User.countDocuments({ isActive: true });
      const pendingUsers = await User.countDocuments({ pendingVerification: true });
      
      // Content stats
      const totalContent = await Content.countDocuments();
      const movies = await Content.countDocuments({ contentType: 'Movie' });
      const series = await Content.countDocuments({ contentType: 'Series' });
      const published = await Content.countDocuments({ isPublished: true });
      const drafts = await Content.countDocuments({ isPublished: false });
      
      // Revenue stats
      const revenueData = await Purchase.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amountPaid' },
            totalTransactions: { $sum: 1 }
          }
        }
      ]);
      const revenue = revenueData[0] || { totalRevenue: 0, totalTransactions: 0 };
      
      // Wallet stats
      const walletData = await User.aggregate([
        {
          $group: {
            _id: null,
            totalBalance: { $sum: '$walletBalance' },
            totalBonusBalance: { $sum: '$bonusBalance' },
            totalCombined: { $sum: { $add: ['$walletBalance', '$bonusBalance'] } }
          }
        }
      ]);
      const wallet = walletData[0] || { totalBalance: 0, totalBonusBalance: 0, totalCombined: 0 };

      res.status(200).json({
        status: 'success',
        data: {
          overview: {
            totalUsers,
            activeUsers,
            pendingUsers,
            newUsersToday: 0 // Could add date filtering
          },
          content: {
            totalContent,
            movies,
            series,
            published,
            drafts
          },
          revenue: {
            totalRevenue: revenue.totalRevenue,
            currency: 'RWF'
          },
          transactions: {
            total: revenue.totalTransactions,
            successful: revenue.totalTransactions
          },
          walletStats: {
            totalBalance: wallet.totalBalance,
            totalBonusBalance: wallet.totalBonusBalance,
            totalCombined: wallet.totalCombined
          }
        },
      });
    } catch (error) {
      next(error);
    }
  };

  deleteUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;

      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return next(new AppError('A valid userId parameter is required.', 400));
      }

      const deletedUser = await User.findByIdAndDelete(userId);

      if (!deletedUser) {
        return next(new AppError('User not found.', 404));
      }

      res.status(200).json({
        status: 'success',
        message: 'User deleted successfully.'
      });
    } catch (error) {
      next(error);
    }
  };

  updateTwoFactorStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const adminId = req.user?._id;
      const { enabled } = req.body;

      if (!adminId) {
        return next(new AppError('Admin context missing. Please log in again.', 401));
      }

      if (typeof enabled !== 'boolean') {
        return next(new AppError('The "enabled" field must be provided as true or false.', 400));
      }

      const adminUser = await User.findById(adminId).select('+twoFactorSecret');

      if (!adminUser) {
        return next(new AppError('Admin account not found.', 404));
      }

      if (enabled) {
        if (!adminUser.twoFactorSecret) {
          return next(new AppError('Complete 2FA setup before enabling it.', 400));
        }
        adminUser.isTwoFactorEnabled = true;
      } else {
        adminUser.isTwoFactorEnabled = false;
        adminUser.twoFactorSecret = undefined;
      }

      await adminUser.save();

      res.status(200).json({
        status: 'success',
        message: `Two-factor authentication ${enabled ? 'enabled' : 'disabled'} for admin.`,
        data: { isTwoFactorEnabled: adminUser.isTwoFactorEnabled }
      });
    } catch (error) {
      next(error);
    }
  };
}