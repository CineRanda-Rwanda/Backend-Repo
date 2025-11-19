import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authenticate, restrictToAdmin } from '../../middleware/auth.middleware';

const router = Router();
const notificationController = new NotificationController();

// Admin routes
router.post(
  '/admin/send',
  authenticate,
  restrictToAdmin,
  notificationController.sendNotification.bind(notificationController)
);

router.get(
  '/admin/history',
  authenticate,
  restrictToAdmin,
  notificationController.getNotificationHistory.bind(notificationController)
);

// User routes
router.get(
  '/',
  authenticate,
  notificationController.getUserNotifications.bind(notificationController)
);

router.put(
  '/:notificationId/read',
  authenticate,
  notificationController.markAsRead.bind(notificationController)
);

router.put(
  '/read-all',
  authenticate,
  notificationController.markAllAsRead.bind(notificationController)
);

router.delete(
  '/:notificationId',
  authenticate,
  notificationController.deleteNotification.bind(notificationController)
);

export default router;
