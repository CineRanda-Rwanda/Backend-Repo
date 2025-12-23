import { Notification, UserNotification, INotification, IUserNotification } from '../models/notification.model';
import mongoose from 'mongoose';

export class NotificationRepository {
  // Create a notification
  async create(data: Partial<INotification>): Promise<INotification> {
    const notification = new Notification(data);
    return await notification.save();
  }

  // Get notification history for admin
  async getHistory(filters: {
    page: number;
    limit: number;
    type?: 'broadcast' | 'targeted';
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ notifications: INotification[]; total: number }> {
    const query: any = {};
    
    if (filters.type) {
      query.type = filters.type;
    }
    
    if (filters.startDate || filters.endDate) {
      query.sentAt = {};
      if (filters.startDate) query.sentAt.$gte = filters.startDate;
      if (filters.endDate) query.sentAt.$lte = filters.endDate;
    }

    const skip = (filters.page - 1) * filters.limit;

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .populate('sentBy', '_id email')
        .sort({ sentAt: -1 })
        .skip(skip)
        .limit(filters.limit)
        .lean(),
      Notification.countDocuments(query),
    ]);

    return { notifications: notifications as INotification[], total };
  }

  // Find notification by ID
  async findById(id: string): Promise<INotification | null> {
    return await Notification.findById(id);
  }

  // Update notification stats
  async updateStats(notificationId: string, updates: Partial<INotification>): Promise<void> {
    await Notification.findByIdAndUpdate(notificationId, updates);
  }
}

export class UserNotificationRepository {
  // Create user notifications in bulk
  async createBulk(notifications: Partial<IUserNotification>[]): Promise<void> {
    if (notifications.length === 0) return;
    
    // Use insertMany for bulk inserts with ordered: false to continue on duplicates
    await UserNotification.insertMany(notifications, { ordered: false }).catch((error) => {
      // Ignore duplicate key errors (code 11000)
      if (error.code !== 11000) {
        throw error;
      }
    });
  }

  // Get user notifications
  async getUserNotifications(filters: {
    userId: string;
    page: number;
    limit: number;
    unreadOnly?: boolean;
    includeArchived?: boolean;
    archivedOnly?: boolean;
  }): Promise<{ notifications: IUserNotification[]; total: number; unreadCount: number }> {
    const query: any = { userId: filters.userId };
    
    if (filters.unreadOnly) {
      query.isRead = false;
    }

    if (filters.archivedOnly) {
      query.isArchived = true;
    } else if (!filters.includeArchived) {
      query.isArchived = { $ne: true };
    }

    const skip = (filters.page - 1) * filters.limit;

    const [notifications, total, unreadCount] = await Promise.all([
      UserNotification.find(query)
        .sort({ receivedAt: -1 })
        .skip(skip)
        .limit(filters.limit)
        .lean(),
      UserNotification.countDocuments(query),
      UserNotification.countDocuments({ userId: filters.userId, isRead: false, isArchived: { $ne: true } }),
    ]);

    // Backfill notification content for legacy records that may not have title/message stored.
    const missingContentNotificationIds = (notifications as any[])
      .filter((n) => !n?.title || !n?.message)
      .map((n) => String(n.notificationId));

    if (missingContentNotificationIds.length > 0) {
      const baseNotifications = await Notification.find({ _id: { $in: missingContentNotificationIds } })
        .select('title message actionType actionUrl imageUrl priority')
        .lean();

      const baseNotificationById = new Map(baseNotifications.map((n: any) => [String(n._id), n]));

      (notifications as any[]).forEach((n) => {
        const base = baseNotificationById.get(String(n.notificationId));
        if (!base) return;

        if (!n.title) n.title = base.title;
        if (!n.message) n.message = base.message;
        if (!n.actionType) n.actionType = base.actionType;
        if (!n.actionUrl) n.actionUrl = base.actionUrl;
        if (!n.imageUrl) n.imageUrl = base.imageUrl;
        if (!n.priority) n.priority = base.priority;
      });
    }

    return { 
      notifications: notifications as IUserNotification[], 
      total,
      unreadCount,
    };
  }

  // Mark notification as read
  async markAsRead(userId: string, notificationId: string): Promise<IUserNotification | null> {
    return await UserNotification.findOneAndUpdate(
      { userId, _id: notificationId, isRead: false },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
  }

  // Mark notification as unread
  async markAsUnread(userId: string, notificationId: string): Promise<IUserNotification | null> {
    return await UserNotification.findOneAndUpdate(
      { userId, _id: notificationId, isRead: true },
      { $set: { isRead: false }, $unset: { readAt: 1 } },
      { new: true }
    );
  }

  // Mark all notifications as read
  async markAllAsRead(userId: string): Promise<number> {
    const result = await UserNotification.updateMany(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    return result.modifiedCount;
  }

  // Delete notification
  async deleteNotification(userId: string, notificationId: string): Promise<boolean> {
    const result = await UserNotification.deleteOne({ userId, _id: notificationId });
    return result.deletedCount > 0;
  }

  // Archive notification
  async archiveNotification(userId: string, notificationId: string): Promise<IUserNotification | null> {
    return await UserNotification.findOneAndUpdate(
      { userId, _id: notificationId, isArchived: { $ne: true } },
      { $set: { isArchived: true, archivedAt: new Date() } },
      { new: true }
    );
  }

  // Restore archived notification
  async restoreNotification(userId: string, notificationId: string): Promise<IUserNotification | null> {
    return await UserNotification.findOneAndUpdate(
      { userId, _id: notificationId, isArchived: true },
      { $set: { isArchived: false }, $unset: { archivedAt: 1 } },
      { new: true }
    );
  }

  // Get unread count for a user
  async getUnreadCount(userId: string): Promise<number> {
    return await UserNotification.countDocuments({ userId, isRead: false, isArchived: { $ne: true } });
  }
}
