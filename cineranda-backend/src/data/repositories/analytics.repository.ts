import { User } from '../models/user.model';
import { Movie } from '../models/movie.model';
import { Purchase } from '../models/purchase.model';
import { WatchProgress } from '../models/watchProgress.model';
import mongoose from 'mongoose';

export class AnalyticsRepository {
  // Dashboard overview
  async getDashboardStats(): Promise<any> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      activeUsers,
      totalContent,
      totalMovies,
      totalSeries,
      publishedContent,
      draftContent,
      ratingsEnabledCount,
      ratingsDisabledCount,
      totalRevenue,
      revenueToday,
      revenueThisWeek,
      revenueThisMonth,
      transactionStats,
      topContent,
      walletStats,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: today } }),
      User.countDocuments({ createdAt: { $gte: thisWeek } }),
      User.countDocuments({ createdAt: { $gte: thisMonth } }),
      User.countDocuments({ isActive: true }),
      Movie.countDocuments(),
      Movie.countDocuments({ contentType: 'Movie' }),
      Movie.countDocuments({ contentType: 'Series' }),
      Movie.countDocuments({ isPublished: true }),
      Movie.countDocuments({ isPublished: false }),
      Movie.countDocuments({ ratingsEnabled: true }),
      Movie.countDocuments({ ratingsEnabled: false }),
      Purchase.aggregate([
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Purchase.aggregate([
        { $match: { createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Purchase.aggregate([
        { $match: { createdAt: { $gte: thisWeek } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Purchase.aggregate([
        { $match: { createdAt: { $gte: thisMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Purchase.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            today: {
              $sum: { $cond: [{ $gte: ['$createdAt', today] }, 1, 0] },
            },
            week: {
              $sum: { $cond: [{ $gte: ['$createdAt', thisWeek] }, 1, 0] },
            },
            month: {
              $sum: { $cond: [{ $gte: ['$createdAt', thisMonth] }, 1, 0] },
            },
            avgAmount: { $avg: '$amount' },
          },
        },
      ]),
      Movie.aggregate([
        { $match: { isPublished: true } },
        {
          $lookup: {
            from: 'purchases',
            localField: '_id',
            foreignField: 'contentId',
            as: 'purchases',
          },
        },
        {
          $addFields: {
            purchaseCount: { $size: '$purchases' },
            revenue: { $sum: '$purchases.amount' },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
        {
          $project: {
            contentId: '$_id',
            title: 1,
            type: '$contentType',
            purchases: '$purchaseCount',
            revenue: 1,
            rating: { $ifNull: ['$averageRating', 0] },
          },
        },
      ]),
      User.aggregate([
        {
          $group: {
            _id: null,
            totalWalletBalance: { $sum: '$wallet.balance' },
            totalBonusBalance: { $sum: '$wallet.bonusBalance' },
            avgBalance: { $avg: '$wallet.totalBalance' },
          },
        },
      ]),
    ]);

    const transactionData = transactionStats[0] || {
      total: 0,
      today: 0,
      week: 0,
      month: 0,
      avgAmount: 0,
    };

    const walletData = walletStats[0] || {
      totalWalletBalance: 0,
      totalBonusBalance: 0,
      avgBalance: 0,
    };

    return {
      overview: {
        totalUsers,
        activeUsers,
        newUsersToday,
        newUsersThisWeek,
        newUsersThisMonth,
      },
      content: {
        totalContent,
        totalMovies,
        totalSeries,
        publishedContent,
        draftContent,
        ratingsEnabledCount,
        ratingsDisabledCount,
      },
      revenue: {
        totalRevenue: totalRevenue[0]?.total || 0,
        revenueToday: revenueToday[0]?.total || 0,
        revenueThisWeek: revenueThisWeek[0]?.total || 0,
        revenueThisMonth: revenueThisMonth[0]?.total || 0,
        currency: 'RWF',
      },
      transactions: {
        totalTransactions: transactionData.total,
        transactionsToday: transactionData.today,
        transactionsThisWeek: transactionData.week,
        transactionsThisMonth: transactionData.month,
        averageTransactionValue: Math.round(transactionData.avgAmount || 0),
      },
      topContent,
      walletStats: {
        totalWalletBalance: walletData.totalWalletBalance,
        totalBonusBalance: walletData.totalBonusBalance,
        averageUserBalance: Math.round(walletData.avgBalance || 0),
      },
    };
  }

  // Revenue analytics
  async getRevenueAnalytics(filters: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'day' | 'week' | 'month';
    contentType?: 'Movie' | 'Series' | 'Episode';
  }): Promise<any> {
    const matchStage: any = {};

    if (filters.startDate || filters.endDate) {
      matchStage.createdAt = {};
      if (filters.startDate) matchStage.createdAt.$gte = filters.startDate;
      if (filters.endDate) matchStage.createdAt.$lte = filters.endDate;
    }

    // Summary
    const summary = await Purchase.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          avgAmount: { $avg: '$amount' },
          uniqueCustomers: { $addToSet: '$userId' },
        },
      },
      {
        $project: {
          _id: 0,
          totalRevenue: 1,
          transactionCount: 1,
          averageTransactionValue: { $round: ['$avgAmount', 0] },
          uniqueCustomers: { $size: '$uniqueCustomers' },
        },
      },
    ]);

    // By date grouping
    let dateFormat = '%Y-%m-%d';
    if (filters.groupBy === 'week') dateFormat = '%Y-W%U';
    if (filters.groupBy === 'month') dateFormat = '%Y-%m';

    const byDate = await Purchase.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
          revenue: { $sum: '$amount' },
          transactions: { $sum: 1 },
          uniqueCustomers: { $addToSet: '$userId' },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          revenue: 1,
          transactions: 1,
          uniqueCustomers: { $size: '$uniqueCustomers' },
        },
      },
      { $sort: { date: -1 } },
      { $limit: 30 },
    ]);

    // By content type
    const byContentType = await Purchase.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$purchaseType',
          revenue: { $sum: '$amount' },
          transactions: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: null,
          types: { $push: { type: '$_id', revenue: '$revenue', transactions: '$transactions' } },
          totalRevenue: { $sum: '$revenue' },
        },
      },
      {
        $project: {
          _id: 0,
          types: {
            $arrayToObject: {
              $map: {
                input: '$types',
                as: 'type',
                in: {
                  k: '$$type.type',
                  v: {
                    revenue: '$$type.revenue',
                    transactions: '$$type.transactions',
                    percentage: {
                      $cond: {
                        if: { $gt: ['$totalRevenue', 0] },
                        then: { $round: [{ $multiply: [{ $divide: ['$$type.revenue', '$totalRevenue'] }, 100] }, 1] },
                        else: 0
                      }
                    },
                  },
                },
              },
            },
          },
        },
      },
    ]);

    // Top revenue content
    const topRevenueContent = await Purchase.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$contentId',
          revenue: { $sum: '$amount' },
          purchases: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'movies',
          localField: '_id',
          foreignField: '_id',
          as: 'content',
        },
      },
      { $unwind: '$content' },
      {
        $project: {
          _id: 0,
          contentId: '$_id',
          title: '$content.title',
          type: '$content.contentType',
          revenue: 1,
          purchases: 1,
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]);

    return {
      summary: {
        ...summary[0],
        period: {
          startDate: filters.startDate?.toISOString().split('T')[0],
          endDate: filters.endDate?.toISOString().split('T')[0],
        },
      },
      byDate,
      byContentType: byContentType[0]?.types || {},
      topRevenueContent,
    };
  }

  // User growth analytics
  async getUserGrowthAnalytics(filters: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<any> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const matchStage: any = {};
    if (filters.startDate || filters.endDate) {
      matchStage.createdAt = {};
      if (filters.startDate) matchStage.createdAt.$gte = filters.startDate;
      if (filters.endDate) matchStage.createdAt.$lte = filters.endDate;
    }

    const [summary, growthByDate] = await Promise.all([
      User.aggregate([
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  totalUsers: { $sum: 1 },
                  activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
                  inactiveUsers: { $sum: { $cond: ['$isActive', 0, 1] } },
                },
              },
            ],
            recent: [
              { $match: matchStage },
              { $count: 'newUsers' },
            ],
          },
        },
      ]),
      User.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            newUsers: { $sum: 1 },
            activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
            inactiveUsers: { $sum: { $cond: ['$isActive', 0, 1] } },
          },
        },
        {
          $project: {
            _id: 0,
            date: '$_id',
            newUsers: 1,
            activeUsers: 1,
            inactiveUsers: 1,
          },
        },
        { $sort: { date: -1 } },
        { $limit: 30 },
      ]),
    ]);

    const totals = summary[0]?.totals[0] || { totalUsers: 0, activeUsers: 0, inactiveUsers: 0 };
    const newUsers = summary[0]?.recent[0]?.newUsers || 0;

    return {
      summary: {
        totalUsers: totals.totalUsers,
        activeUsers: totals.activeUsers,
        inactiveUsers: totals.inactiveUsers,
        newUsers,
        churnRate: totals.totalUsers > 0 ? parseFloat(((totals.inactiveUsers / totals.totalUsers) * 100).toFixed(1)) : 0,
        retentionRate: totals.totalUsers > 0 ? parseFloat(((totals.activeUsers / totals.totalUsers) * 100).toFixed(1)) : 0,
      },
      growthByDate,
      userActivity: {
        dailyActiveUsers: 0, // Would need activity tracking
        weeklyActiveUsers: 0,
        monthlyActiveUsers: totals.activeUsers,
      },
    };
  }

  // Content performance analytics
  async getContentPerformanceAnalytics(filters: {
    contentType?: 'Movie' | 'Series';
    limit?: number;
    sortBy?: 'views' | 'revenue' | 'rating' | 'purchases';
    startDate?: Date;
    endDate?: Date;
  }): Promise<any> {
    const limit = Math.min(filters.limit || 10, 100);
    const matchStage: any = { isPublished: true };

    if (filters.contentType) {
      matchStage.contentType = filters.contentType;
    }

    const purchaseMatchStage: any = {};
    if (filters.startDate || filters.endDate) {
      purchaseMatchStage.createdAt = {};
      if (filters.startDate) purchaseMatchStage.createdAt.$gte = filters.startDate;
      if (filters.endDate) purchaseMatchStage.createdAt.$lte = filters.endDate;
    }

    const sortField = filters.sortBy === 'rating' ? 'averageRating' : 'revenue';

    const topPerformers = await Movie.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: 'purchases',
          let: { contentId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$contentId', '$$contentId'] }, ...purchaseMatchStage } },
          ],
          as: 'purchases',
        },
      },
      {
        $lookup: {
          from: 'watchprogresses',
          localField: '_id',
          foreignField: 'contentId',
          as: 'watchData',
        },
      },
      {
        $addFields: {
          purchaseCount: { $size: '$purchases' },
          revenue: { $sum: '$purchases.amount' },
          totalWatchTime: { $sum: '$watchData.duration' },
          completionRate: {
            $multiply: [
              {
                $avg: {
                  $cond: [
                    { $gt: [{ $size: '$watchData' }, 0] },
                    '$watchData.percentageWatched',
                    0,
                  ],
                },
              },
              100,
            ],
          },
        },
      },
      {
        $project: {
          contentId: '$_id',
          title: 1,
          type: '$contentType',
          metrics: {
            views: { $size: '$watchData' },
            uniqueViewers: { $size: '$watchData' },
            purchases: '$purchaseCount',
            revenue: 1,
            averageRating: { $ifNull: ['$averageRating', 0] },
            totalRatings: { $ifNull: ['$totalRatings', 0] },
            watchTimeHours: { $round: [{ $divide: ['$totalWatchTime', 3600] }, 0] },
            completionRate: { $round: ['$completionRate', 1] },
          },
        },
      },
      { $sort: { [`metrics.${sortField}`]: -1 } },
      { $limit: limit },
    ]);

    // Rating statistics
    const ratingStats = await Movie.aggregate([
      { $match: { ...matchStage, totalRatings: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$averageRating' },
          totalRatings: { $sum: '$totalRatings' },
          distribution: {
            $push: {
              rating: { $round: ['$averageRating', 0] },
              count: '$totalRatings',
            },
          },
        },
      },
    ]);

    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (ratingStats[0]?.distribution) {
      ratingStats[0].distribution.forEach((item: any) => {
        const rating = Math.max(1, Math.min(5, Math.round(item.rating)));
        (ratingDistribution as any)[rating] = (ratingDistribution[rating] || 0) + item.count;
      });
    }

    return {
      topPerformers,
      ratingStatistics: {
        averageRating: ratingStats[0]?.avgRating ? parseFloat(ratingStats[0].avgRating.toFixed(1)) : 0,
        totalRatings: ratingStats[0]?.totalRatings || 0,
        ratingsDistribution: ratingDistribution,
      },
    };
  }

  // Wallet statistics
  async getWalletStats(): Promise<any> {
    const [totals, topups, distribution] = await Promise.all([
      User.aggregate([
        {
          $group: {
            _id: null,
            totalWalletBalance: { $sum: '$wallet.balance' },
            totalBonusBalance: { $sum: '$wallet.bonusBalance' },
            avgBalance: { $avg: '$wallet.totalBalance' },
            balances: { $push: '$wallet.totalBalance' },
          },
        },
        {
          $project: {
            _id: 0,
            totalWalletBalance: 1,
            totalBonusBalance: 1,
            averageUserBalance: { $round: ['$avgBalance', 0] },
            medianUserBalance: {
              $arrayElemAt: [
                {
                  $sortArray: { input: '$balances', sortBy: 1 },
                },
                { $floor: { $divide: [{ $size: '$balances' }, 2] } },
              ],
            },
          },
        },
      ]),
      User.aggregate([
        { $unwind: '$wallet.transactions' },
        { $match: { 'wallet.transactions.type': 'credit' } },
        {
          $group: {
            _id: null,
            totalTopups: { $sum: 1 },
            totalTopupAmount: { $sum: '$wallet.transactions.amount' },
            avgTopup: { $avg: '$wallet.transactions.amount' },
          },
        },
        {
          $project: {
            _id: 0,
            totalTopups: 1,
            totalTopupAmount: 1,
            averageTopupAmount: { $round: ['$avgTopup', 0] },
          },
        },
      ]),
      User.aggregate([
        {
          $bucket: {
            groupBy: '$wallet.totalBalance',
            boundaries: [0, 1000, 5000, 10000, Number.MAX_SAFE_INTEGER],
            default: '10000+',
            output: {
              userCount: { $sum: 1 },
            },
          },
        },
      ]),
    ]);

    const ranges = ['0-1000', '1000-5000', '5000-10000', '10000+'];
    const totalUserCount = distribution.reduce((sum: number, bucket: any) => sum + bucket.userCount, 0);
    
    const balanceDistribution = distribution.map((bucket: any, index: number) => ({
      range: ranges[index],
      userCount: bucket.userCount,
      percentage: totalUserCount > 0 ? parseFloat(((bucket.userCount / totalUserCount) * 100).toFixed(1)) : 0,
    }));

    return {
      totals: totals[0] || {
        totalWalletBalance: 0,
        totalBonusBalance: 0,
        averageUserBalance: 0,
        medianUserBalance: 0,
      },
      topups: topups[0] || {
        totalTopups: 0,
        totalTopupAmount: 0,
        averageTopupAmount: 0,
      },
      balanceDistribution,
    };
  }
}
