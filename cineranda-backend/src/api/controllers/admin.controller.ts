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
   * Rich analytics snapshot for the admin dashboard.
   */
  getAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const Content = mongoose.model('Content');
      const Purchase = mongoose.model('Purchase');

      interface TimeFrame {
        start: Date;
        end: Date;
        previousStart: Date;
        previousEnd: Date;
      }

      interface RangeStat {
        value: number;
        previous: number;
        changePercent: number;
        baseBefore: number;
        percentOfExisting: number;
      }

      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);

      const subtractDays = (base: Date, days: number) => {
        const clone = new Date(base);
        clone.setDate(clone.getDate() - days);
        return clone;
      };

      const buildFrame = (start: Date, end: Date): TimeFrame => {
        const span = Math.max(end.getTime() - start.getTime(), 1);
        const previousStart = new Date(start.getTime() - span);
        return {
          start,
          end,
          previousStart,
          previousEnd: start
        };
      };

      const frames: Record<string, TimeFrame> = {
        today: buildFrame(startOfToday, now),
        thisWeek: buildFrame(subtractDays(now, 7), now),
        last14Days: buildFrame(subtractDays(now, 14), now),
        last30Days: buildFrame(subtractDays(now, 30), now),
        last90Days: buildFrame(subtractDays(now, 90), now)
      };

      const changePercent = (current: number, previous: number) => {
        if (previous === 0) {
          return current > 0 ? 100 : 0;
        }
        return Number((((current - previous) / previous) * 100).toFixed(2));
      };

      const percentOfBase = (value: number, base: number) => {
        if (base <= 0) {
          return value > 0 ? 100 : 0;
        }
        return Number(((value / base) * 100).toFixed(2));
      };

      const countUsersInFrame = async (frame: TimeFrame): Promise<RangeStat> => {
        const current = await User.countDocuments({ createdAt: { $gte: frame.start, $lt: frame.end } });
        const previous = await User.countDocuments({ createdAt: { $gte: frame.previousStart, $lt: frame.previousEnd } });
        const baseBefore = await User.countDocuments({ createdAt: { $lt: frame.start } });
        return {
          value: current,
          previous,
          changePercent: changePercent(current, previous),
          baseBefore,
          percentOfExisting: percentOfBase(current, baseBefore)
        };
      };

      const purchaseMatchBase: Record<string, any> = {
        status: 'completed',
        purchaseType: 'content'
      };

      const sumRevenueBetween = async (start: Date, end: Date): Promise<number> => {
        const [result] = await Purchase.aggregate([
          { $match: { ...purchaseMatchBase, createdAt: { $gte: start, $lt: end } } },
          { $group: { _id: null, total: { $sum: '$amountPaid' } } }
        ]);
        return result?.total || 0;
      };

      const sumRevenueBefore = async (end: Date): Promise<number> => {
        const [result] = await Purchase.aggregate([
          { $match: { ...purchaseMatchBase, createdAt: { $lt: end } } },
          { $group: { _id: null, total: { $sum: '$amountPaid' } } }
        ]);
        return result?.total || 0;
      };

      const userGrowth: Record<string, RangeStat> = {};
      for (const [key, frame] of Object.entries(frames)) {
        userGrowth[key] = await countUsersInFrame(frame);
      }

      const revenueGrowth: Record<string, RangeStat> = {};
      for (const [key, frame] of Object.entries(frames)) {
        const current = await sumRevenueBetween(frame.start, frame.end);
        const previous = await sumRevenueBetween(frame.previousStart, frame.previousEnd);
        const baseBefore = await sumRevenueBefore(frame.start);
        revenueGrowth[key] = {
          value: current,
          previous,
          changePercent: changePercent(current, previous),
          baseBefore,
          percentOfExisting: percentOfBase(current, baseBefore)
        };
      }

      const [lifetimeRevenueAggregate] = await Purchase.aggregate([
        { $match: purchaseMatchBase },
        {
          $group: {
            _id: null,
            total: { $sum: '$amountPaid' },
            transactions: { $sum: 1 }
          }
        }
      ]);

      const lifetimeRevenue = lifetimeRevenueAggregate?.total || 0;
      const lifetimeTransactions = lifetimeRevenueAggregate?.transactions || 0;

      const totalUsers = await User.countDocuments();
      const activeUsers = await User.countDocuments({ isActive: true });
      const inactiveUsers = totalUsers - activeUsers;

      const allowedContentTypes = ['Movie', 'Series', 'Episode', 'Season'];
      const requestedContentType =
        typeof req.query.contentType === 'string' && allowedContentTypes.includes(req.query.contentType)
          ? req.query.contentType
          : undefined;

      const parsedLimit = parseInt(req.query.contentLimit as string, 10);
      const contentLimit = Math.min(parsedLimit > 0 ? parsedLimit : 10, 50);

      const calendarRangeInput = parseInt(req.query.calendarRangeDays as string, 10) || 30;
      const calendarRangeDays = Math.min(Math.max(calendarRangeInput, 7), 90);

      const userRankingInput = parseInt(req.query.userRankingLimit as string, 10) || 10;
      const userRankingLimit = Math.min(Math.max(userRankingInput, 5), 50);

      const allowedSortFields = new Set([
        'uniqueUsers',
        'totalRevenue',
        'totalUnlocks',
        'today',
        'last14Days',
        'last30Days',
        'last90Days'
      ]);
      const sortByParam = typeof req.query.sortBy === 'string' && allowedSortFields.has(req.query.sortBy)
        ? (req.query.sortBy as string)
        : 'uniqueUsers';
      const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';

      const contentFilter: Record<string, any> = {};
      if (requestedContentType) {
        contentFilter.contentType = requestedContentType;
      }
      const totalContent = await Content.countDocuments(contentFilter);

      const contentPurchaseMatch: Record<string, any> = {
        ...purchaseMatchBase,
        contentId: { $ne: null }
      };
      if (requestedContentType) {
        contentPurchaseMatch.contentType = requestedContentType;
      }

      const aggregatedContent = await Purchase.aggregate([
        { $match: contentPurchaseMatch },
        {
          $group: {
            _id: '$contentId',
            totalRevenue: { $sum: '$amountPaid' },
            totalUnlocks: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
            contentType: { $last: '$contentType' }
          }
        },
        {
          $project: {
            contentId: '$_id',
            totalRevenue: 1,
            totalUnlocks: 1,
            uniqueUsers: { $size: '$uniqueUsers' },
            contentType: 1
          }
        }
      ]);

      const totalUnlocks = aggregatedContent.reduce((acc, item) => acc + (item.totalUnlocks || 0), 0);

      const [totalClientsAggregate] = await Purchase.aggregate([
        { $match: contentPurchaseMatch },
        { $group: { _id: '$userId' } },
        { $count: 'count' }
      ]);
      const totalClients = totalClientsAggregate?.count || 0;

      const candidateCap = Math.min(Math.max(contentLimit * 3, contentLimit), 60);
      const candidates = aggregatedContent
        .sort((a, b) => {
          if (b.uniqueUsers === a.uniqueUsers) {
            return (b.totalUnlocks || 0) - (a.totalUnlocks || 0);
          }
          return b.uniqueUsers - a.uniqueUsers;
        })
        .slice(0, candidateCap);

      const contentIds = candidates.map(item => item.contentId).filter(Boolean);
      const rawContentDocs = await Content.find({ _id: { $in: contentIds } })
        .select('title contentType posterImageUrl isPublished price');
      const contentDocMap = new Map(rawContentDocs.map(doc => [doc._id.toString(), doc]));

      const calendarStartDate = subtractDays(startOfToday, calendarRangeDays - 1);
      const formatDate = (date: Date) => date.toISOString().slice(0, 10);
      const calendarDates: string[] = [];
      for (let i = 0; i < calendarRangeDays; i += 1) {
        const day = new Date(calendarStartDate);
        day.setDate(calendarStartDate.getDate() + i);
        calendarDates.push(formatDate(day));
      }

      const userCalendarRaw = await User.aggregate([
        { $match: { createdAt: { $gte: calendarStartDate } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt'
              }
            },
            count: { $sum: 1 }
          }
        }
      ]);

      const revenueCalendarRaw = await Purchase.aggregate([
        { $match: { ...purchaseMatchBase, createdAt: { $gte: calendarStartDate } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt'
              }
            },
            total: { $sum: '$amountPaid' }
          }
        }
      ]);

      const userCalendarMap = new Map(userCalendarRaw.map(item => [item._id, item.count]));
      const revenueCalendarMap = new Map(revenueCalendarRaw.map(item => [item._id, item.total]));

      const calendarSeries = calendarDates.map(date => ({
        date,
        users: userCalendarMap.get(date) || 0,
        revenue: revenueCalendarMap.get(date) || 0
      }));

      const calendarInsightPayload = {
        rangeDays: calendarRangeDays,
        startDate: calendarDates[0] || formatDate(calendarStartDate),
        endDate: calendarDates[calendarDates.length - 1] || formatDate(startOfToday),
        series: calendarSeries
      };

      const countUniquePurchasersBetween = async (
        contentId: mongoose.Types.ObjectId,
        startDate: Date,
        endDate: Date
      ) => {
        if (startDate >= endDate) {
          return 0;
        }

        const matchStage: Record<string, any> = {
          ...purchaseMatchBase,
          contentId,
          createdAt: { $gte: startDate, $lt: endDate }
        };

        if (requestedContentType) {
          matchStage.contentType = requestedContentType;
        }

        const [result] = await Purchase.aggregate([
          { $match: matchStage },
          { $group: { _id: '$userId' } },
          { $count: 'count' }
        ]);
        return result?.count || 0;
      };

      const buildUserRanking = async (
        startDate: Date,
        endDate: Date,
        limit: number
      ): Promise<Array<{ userId: mongoose.Types.ObjectId; unlocks: number; revenue: number; uniqueContent: number }>> => {
        if (limit <= 0 || startDate >= endDate) {
          return [];
        }

        return Purchase.aggregate([
          {
            $match: {
              ...purchaseMatchBase,
              contentId: { $ne: null },
              createdAt: { $gte: startDate, $lt: endDate }
            }
          },
          {
            $group: {
              _id: '$userId',
              unlocks: { $sum: 1 },
              revenue: { $sum: '$amountPaid' },
              contentSet: { $addToSet: '$contentId' }
            }
          },
          {
            $project: {
              userId: '$_id',
              unlocks: 1,
              revenue: 1,
              uniqueContent: { $size: '$contentSet' }
            }
          },
          { $sort: { unlocks: -1, revenue: -1 } },
          { $limit: limit }
        ]);
      };

      type ContentPerformanceEntry = {
        contentId: string;
        title: string;
        contentType: string;
        posterImageUrl?: string;
        totalRevenue: number;
        totalUnlocks: number;
        uniqueUsers: number;
        overTime: {
          today: number;
          last14Days: number;
          last30Days: number;
          last90Days: number;
        };
        weekly: {
          current: number;
          previous: number;
          currentRank: number | null;
          previousRank: number | null;
        };
      };

      const performance: ContentPerformanceEntry[] = [];

      for (const item of candidates) {
        if (!item.contentId) {
          continue;
        }

        const contentObjectId =
          typeof item.contentId === 'string'
            ? new mongoose.Types.ObjectId(item.contentId)
            : item.contentId;

        const [
          todayUsers,
          last14Users,
          last30Users,
          last90Users,
          currentWeekUsers,
          previousWeekUsers
        ] = await Promise.all([
          countUniquePurchasersBetween(contentObjectId, frames.today.start, frames.today.end),
          countUniquePurchasersBetween(contentObjectId, frames.last14Days.start, frames.last14Days.end),
          countUniquePurchasersBetween(contentObjectId, frames.last30Days.start, frames.last30Days.end),
          countUniquePurchasersBetween(contentObjectId, frames.last90Days.start, frames.last90Days.end),
          countUniquePurchasersBetween(contentObjectId, frames.thisWeek.start, frames.thisWeek.end),
          countUniquePurchasersBetween(
            contentObjectId,
            frames.thisWeek.previousStart,
            frames.thisWeek.previousEnd
          )
        ]);

        const metadata = contentDocMap.get(contentObjectId.toString());

        performance.push({
          contentId: contentObjectId.toString(),
          title: metadata?.title || 'Unknown content',
          contentType: metadata?.contentType || item.contentType || 'Unknown',
          posterImageUrl: metadata?.posterImageUrl,
          totalRevenue: item.totalRevenue || 0,
          totalUnlocks: item.totalUnlocks || 0,
          uniqueUsers: item.uniqueUsers || 0,
          overTime: {
            today: todayUsers,
            last14Days: last14Users,
            last30Days: last30Users,
            last90Days: last90Users
          },
          weekly: {
            current: currentWeekUsers,
            previous: previousWeekUsers,
            currentRank: null,
            previousRank: null
          }
        });
      }

      const assignRank = (
        entries: ContentPerformanceEntry[],
        selector: (entry: ContentPerformanceEntry) => number,
        assign: (entry: ContentPerformanceEntry, rank: number | null) => void
      ) => {
        const sorted = [...entries].sort((a, b) => {
          const aMetric = selector(a);
          const bMetric = selector(b);
          if (bMetric === aMetric) {
            return (b.totalRevenue || 0) - (a.totalRevenue || 0);
          }
          return bMetric - aMetric;
        });

        sorted.forEach((entry, index) => {
          const metric = selector(entry);
          assign(entry, metric > 0 ? index + 1 : null);
        });
      };

      assignRank(performance, entry => entry.weekly.current, (entry, rank) => {
        entry.weekly.currentRank = rank;
      });

      assignRank(performance, entry => entry.weekly.previous, (entry, rank) => {
        entry.weekly.previousRank = rank;
      });

      const getSortMetric = (entry: ContentPerformanceEntry) => {
        switch (sortByParam) {
          case 'totalRevenue':
            return entry.totalRevenue;
          case 'totalUnlocks':
            return entry.totalUnlocks;
          case 'today':
            return entry.overTime.today;
          case 'last14Days':
            return entry.overTime.last14Days;
          case 'last30Days':
            return entry.overTime.last30Days;
          case 'last90Days':
            return entry.overTime.last90Days;
          default:
            return entry.uniqueUsers;
        }
      };

      performance.sort((a, b) => {
        const aMetric = getSortMetric(a);
        const bMetric = getSortMetric(b);
        if (sortOrder === 'asc') {
          return aMetric - bMetric;
        }
        return bMetric - aMetric;
      });

      const finalPerformance = performance.slice(0, contentLimit).map((entry, index) => ({
        ...entry,
        rank: index + 1
      }));

      const contentWeeklyRankings = finalPerformance.map(entry => ({
        contentId: entry.contentId,
        title: entry.title,
        contentType: entry.contentType,
        currentRank: entry.weekly.currentRank,
        previousRank: entry.weekly.previousRank,
        currentWeekUsers: entry.weekly.current,
        previousWeekUsers: entry.weekly.previous
      }));

      const [currentUserRankingRaw, previousUserRankingRaw] = await Promise.all([
        buildUserRanking(frames.thisWeek.start, frames.thisWeek.end, userRankingLimit),
        buildUserRanking(frames.thisWeek.previousStart, frames.thisWeek.previousEnd, userRankingLimit * 2)
      ]);

      const previousUserRankMap = new Map<string, number>();
      previousUserRankingRaw.forEach((entry, index) => {
        previousUserRankMap.set(entry.userId.toString(), index + 1);
      });

      const userIdsForDetails = Array.from(
        new Set([
          ...currentUserRankingRaw.map(entry => entry.userId.toString()),
          ...previousUserRankingRaw.map(entry => entry.userId.toString())
        ])
      );

      type LeanUserProfile = Pick<IUser, 'username' | 'email' | 'phoneNumber' | 'role'> & {
        _id: mongoose.Types.ObjectId;
      };

      const rawProfiles = await User.find({ _id: { $in: userIdsForDetails } })
        .select('username email phoneNumber role')
        .lean<LeanUserProfile>();

      const userProfiles: LeanUserProfile[] = Array.isArray(rawProfiles) ? rawProfiles : [];

      const userProfileMap = new Map<string, LeanUserProfile>(
        userProfiles.map(profile => [profile._id.toString(), profile])
      );

      const userRankingEntries = currentUserRankingRaw.map((entry, index) => {
        const userIdStr = entry.userId.toString();
        const profile = userProfileMap.get(userIdStr);
        return {
          userId: userIdStr,
          username: profile?.username || 'Unknown user',
          email: profile?.email || null,
          phoneNumber: profile?.phoneNumber || null,
          role: profile?.role || null,
          unlocks: entry.unlocks,
          revenue: entry.revenue,
          uniqueContent: entry.uniqueContent,
          currentRank: index + 1,
          previousRank: previousUserRankMap.get(userIdStr) ?? null
        };
      });

      res.status(200).json({
        status: 'success',
        data: {
          generatedAt: now,
          users: {
            totals: {
              total: totalUsers,
              active: activeUsers,
              inactive: inactiveUsers
            },
            growth: userGrowth,
            rankings: {
              timeframe: {
                label: 'thisWeek',
                start: frames.thisWeek.start,
                end: frames.thisWeek.end,
                previousStart: frames.thisWeek.previousStart,
                previousEnd: frames.thisWeek.previousEnd
              },
              limit: userRankingLimit,
              entries: userRankingEntries
            }
          },
          revenue: {
            currency: 'RWF',
            lifetime: {
              amount: lifetimeRevenue,
              transactions: lifetimeTransactions
            },
            growth: revenueGrowth
          },
          content: {
            totals: {
              totalContent,
              totalClients,
              totalUnlocks,
              trackedContent: aggregatedContent.length
            },
            performance: finalPerformance,
            rankings: {
              timeframe: {
                label: 'thisWeek',
                start: frames.thisWeek.start,
                end: frames.thisWeek.end,
                previousStart: frames.thisWeek.previousStart,
                previousEnd: frames.thisWeek.previousEnd
              },
              entries: contentWeeklyRankings
            },
            appliedFilters: {
              contentType: requestedContentType || null,
              sortBy: sortByParam,
              sortOrder,
              limit: contentLimit
            }
          },
          calendarInsights: calendarInsightPayload
        }
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