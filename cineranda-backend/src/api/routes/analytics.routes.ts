import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';
import { authenticate, restrictToAdmin } from '../../middleware/auth.middleware';

const router = Router();
const analyticsController = new AnalyticsController();

// All analytics routes require admin authentication
router.get(
  '/dashboard',
  authenticate,
  restrictToAdmin,
  analyticsController.getDashboard.bind(analyticsController)
);

router.get(
  '/revenue',
  authenticate,
  restrictToAdmin,
  analyticsController.getRevenueAnalytics.bind(analyticsController)
);

router.get(
  '/user-growth',
  authenticate,
  restrictToAdmin,
  analyticsController.getUserGrowthAnalytics.bind(analyticsController)
);

router.get(
  '/content-performance',
  authenticate,
  restrictToAdmin,
  analyticsController.getContentPerformanceAnalytics.bind(analyticsController)
);

router.get(
  '/wallet-stats',
  authenticate,
  restrictToAdmin,
  analyticsController.getWalletStats.bind(analyticsController)
);

router.get(
  '/platform-health',
  authenticate,
  restrictToAdmin,
  analyticsController.getPlatformHealth.bind(analyticsController)
);

export default router;
