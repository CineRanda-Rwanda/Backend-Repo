import { NotificationRepository, UserNotificationRepository } from '../../data/repositories/notification.repository';
import mongoose from 'mongoose';

export class NotificationService {
  private notificationRepository: NotificationRepository;
  private userNotificationRepository: UserNotificationRepository;

  constructor() {
    this.notificationRepository = new NotificationRepository();
    this.userNotificationRepository = new UserNotificationRepository();
  }

  /**
   * Send a system notification to a specific user
   */
  async sendSystemNotification(
    userId: string,
    title: string,
    message: string,
    options: {
      actionType?: 'content' | 'wallet' | 'profile' | 'other';
      actionUrl?: string;
      imageUrl?: string;
      priority?: 'low' | 'medium' | 'high';
    } = {}
  ): Promise<void> {
    try {
      // 1. Create the parent notification record (for history/audit)
      const notification = await this.notificationRepository.create({
        type: 'targeted',
        senderType: 'system',
        title,
        message,
        actionType: options.actionType,
        actionUrl: options.actionUrl,
        imageUrl: options.imageUrl,
        priority: options.priority || 'medium',
        recipients: [new mongoose.Types.ObjectId(userId)],
        recipientCount: 1,
        deliveredCount: 1, // Assuming immediate delivery to DB
        readCount: 0,
        clickedCount: 0,
        sentAt: new Date(),
      });

      // 2. Create the user-specific notification
      await this.userNotificationRepository.createBulk([{
        userId: new mongoose.Types.ObjectId(userId),
        notificationId: notification._id as mongoose.Types.ObjectId,
        title,
        message,
        actionType: options.actionType,
        actionUrl: options.actionUrl,
        imageUrl: options.imageUrl,
        priority: options.priority || 'medium',
        isRead: false,
        receivedAt: new Date(),
      }]);
      
    } catch (error) {
      console.error('Failed to send system notification:', error);
      // We don't throw here to prevent breaking the main flow (e.g. payment)
    }
  }
}
