import { Response, NextFunction } from 'express';
import { NotificationRepository, UserNotificationRepository } from '../../data/repositories/notification.repository';
import { User } from '../../data/models/user.model';
import { AuthRequest } from '../../middleware/auth.middleware';
import AppError from '../../utils/AppError';
import mongoose from 'mongoose';

const notificationRepository = new NotificationRepository();
const userNotificationRepository = new UserNotificationRepository();

export class NotificationController {
  // Admin: Send notification
  async sendNotification(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        type,
        title,
        message,
        actionType,
        actionUrl,
        priority = 'medium',
        imageUrl,
        recipients,
      } = req.body;

      // Validation
      if (!type || !['broadcast', 'targeted'].includes(type)) {
        throw new AppError('Invalid notification type', 400);
      }

      if (!title || title.length < 3 || title.length > 100) {
        throw new AppError('Title must be between 3 and 100 characters', 400);
      }

      if (!message || message.length < 10 || message.length > 500) {
        throw new AppError('Message must be between 10 and 500 characters', 400);
      }

      if (type === 'targeted' && (!recipients || !Array.isArray(recipients) || recipients.length === 0)) {
        throw new AppError('Recipients are required for targeted notifications', 400);
      }

      if (type === 'targeted' && recipients.length > 1000) {
        throw new AppError('Maximum 1000 recipients allowed per notification', 400);
      }

      // Determine recipients
      let recipientIds: mongoose.Types.ObjectId[] = [];
      let recipientCount = 0;

      if (type === 'broadcast') {
        // Get all active users
        const users = await User.find({ isActive: true }, '_id').lean();
        recipientIds = users.map((u) => u._id as mongoose.Types.ObjectId);
        recipientCount = recipientIds.length;
      } else {
        // Validate recipients exist
        const users = await User.find({ _id: { $in: recipients }, isActive: true }, '_id').lean();
        recipientIds = users.map((u) => u._id as mongoose.Types.ObjectId);
        recipientCount = recipientIds.length;

        if (recipientCount === 0) {
          throw new AppError('No valid recipients found', 400);
        }
      }

      // Create notification record
      const notification = await notificationRepository.create({
        type,
        title,
        message,
        actionType,
        actionUrl,
        priority,
        imageUrl,
        recipients: type === 'targeted' ? recipientIds : undefined,
        sentBy: req.user!._id,
        recipientCount,
        deliveredCount: 0,
        readCount: 0,
        clickedCount: 0,
        sentAt: new Date(),
      } as any);

      // Create user notifications
      const userNotifications = recipientIds.map((userId) => ({
        userId,
        notificationId: notification._id,
        title,
        message,
        actionType,
        actionUrl,
        imageUrl,
        priority,
        isRead: false,
        receivedAt: new Date(),
      }));

      await userNotificationRepository.createBulk(userNotifications as any);

      // Update delivered count
      await notificationRepository.updateStats(notification._id!.toString(), {
        deliveredCount: recipientCount,
      } as any);

      res.status(200).json({
        status: 'success',
        message: 'Notification sent successfully',
        data: {
          notificationId: notification._id,
          type: notification.type,
          recipientCount,
          sentAt: notification.sentAt,
          estimatedDelivery: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin: Get notification history
  async getNotificationHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const type = req.query.type as 'broadcast' | 'targeted' | undefined;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const { notifications, total } = await notificationRepository.getHistory({
        page,
        limit,
        type,
        startDate,
        endDate,
      });

      res.status(200).json({
        status: 'success',
        data: {
          notifications,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalNotifications: total,
            limit,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // User: Get notifications
  async getUserNotifications(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id.toString();
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const unreadOnly = req.query.unreadOnly === 'true';

      const { notifications, total, unreadCount } = await userNotificationRepository.getUserNotifications({
        userId,
        page,
        limit,
        unreadOnly,
      });

      res.status(200).json({
        status: 'success',
        data: {
          notifications,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalNotifications: total,
            unreadCount,
            limit,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // User: Mark notification as read
  async markAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id.toString();
      const { notificationId } = req.params;

      const notification = await userNotificationRepository.markAsRead(userId, notificationId);

      if (!notification) {
        throw new AppError('Notification not found or already read', 404);
      }

      res.status(200).json({
        status: 'success',
        message: 'Notification marked as read',
        data: {
          notificationId: notification._id,
          isRead: notification.isRead,
          readAt: notification.readAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // User: Mark all notifications as read
  async markAllAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id.toString();

      const markedCount = await userNotificationRepository.markAllAsRead(userId);

      res.status(200).json({
        status: 'success',
        message: 'All notifications marked as read',
        data: {
          markedCount,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // User: Delete notification
  async deleteNotification(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id.toString();
      const { notificationId } = req.params;

      const deleted = await userNotificationRepository.deleteNotification(userId, notificationId);

      if (!deleted) {
        throw new AppError('Notification not found', 404);
      }

      res.status(200).json({
        status: 'success',
        message: 'Notification deleted',
      });
    } catch (error) {
      next(error);
    }
  }
}
