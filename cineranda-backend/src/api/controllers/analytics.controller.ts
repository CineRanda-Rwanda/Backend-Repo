import { Response, NextFunction } from 'express';
import { AnalyticsRepository } from '../../data/repositories/analytics.repository';
import { AuthRequest } from '../../middleware/auth.middleware';

const analyticsRepository = new AnalyticsRepository();

export class AnalyticsController {
  // Enhanced dashboard analytics
  async getDashboard(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await analyticsRepository.getDashboardStats();

      res.status(200).json({
        status: 'success',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  // Revenue analytics
  async getRevenueAnalytics(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const groupBy = (req.query.groupBy as 'day' | 'week' | 'month') || 'day';
      const contentType = req.query.contentType as 'Movie' | 'Series' | 'Episode' | undefined;

      const data = await analyticsRepository.getRevenueAnalytics({
        startDate,
        endDate,
        groupBy,
        contentType,
      });

      res.status(200).json({
        status: 'success',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  // User growth analytics
  async getUserGrowthAnalytics(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const groupBy = (req.query.groupBy as 'day' | 'week' | 'month') || 'day';

      const data = await analyticsRepository.getUserGrowthAnalytics({
        startDate,
        endDate,
        groupBy,
      });

      res.status(200).json({
        status: 'success',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  // Content performance analytics
  async getContentPerformanceAnalytics(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const contentType = req.query.contentType as 'Movie' | 'Series' | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const sortBy = (req.query.sortBy as 'views' | 'revenue' | 'rating' | 'purchases') || 'revenue';
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const data = await analyticsRepository.getContentPerformanceAnalytics({
        contentType,
        limit,
        sortBy,
        startDate,
        endDate,
      });

      res.status(200).json({
        status: 'success',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  // Wallet statistics
  async getWalletStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await analyticsRepository.getWalletStats();

      res.status(200).json({
        status: 'success',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  // Platform health metrics (simplified - would need actual monitoring in production)
  async getPlatformHealth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // This would typically integrate with monitoring services
      // For now, returning mock data structure
      const data = {
        system: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 / 1024, // GB
        },
        database: {
          status: 'connected',
          responseTime: 'Good',
        },
        api: {
          status: 'healthy',
          averageResponseTime: 120,
        },
      };

      res.status(200).json({
        status: 'success',
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}
