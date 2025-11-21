import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  type: 'broadcast' | 'targeted';
  senderType: 'admin' | 'system';
  title: string;
  message: string;
  actionType?: 'content' | 'wallet' | 'profile' | 'other';
  actionUrl?: string;
  imageUrl?: string;
  priority: 'low' | 'medium' | 'high';
  recipients?: mongoose.Types.ObjectId[]; // For targeted notifications
  sentBy?: mongoose.Types.ObjectId; // Admin who sent it (optional for system notifications)
  recipientCount: number;
  deliveredCount: number;
  readCount: number;
  clickedCount: number;
  sentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserNotification extends Document {
  userId: mongoose.Types.ObjectId;
  notificationId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  actionType?: 'content' | 'wallet' | 'profile' | 'other';
  actionUrl?: string;
  imageUrl?: string;
  priority: 'low' | 'medium' | 'high';
  isRead: boolean;
  readAt?: Date;
  receivedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    type: {
      type: String,
      enum: ['broadcast', 'targeted'],
      required: true,
    },
    senderType: {
      type: String,
      enum: ['admin', 'system'],
      default: 'admin',
    },
    title: {
      type: String,
      required: true,
      minlength: 3,
      maxlength: 100,
    },
    message: {
      type: String,
      required: true,
      minlength: 10,
      maxlength: 500,
    },
    actionType: {
      type: String,
      enum: ['content', 'wallet', 'profile', 'other'],
    },
    actionUrl: {
      type: String,
    },
    imageUrl: {
      type: String,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    recipients: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    sentBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    recipientCount: {
      type: Number,
      default: 0,
    },
    deliveredCount: {
      type: Number,
      default: 0,
    },
    readCount: {
      type: Number,
      default: 0,
    },
    clickedCount: {
      type: Number,
      default: 0,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
NotificationSchema.index({ type: 1, sentAt: -1 });
NotificationSchema.index({ sentBy: 1 });

const UserNotificationSchema = new Schema<IUserNotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    notificationId: {
      type: Schema.Types.ObjectId,
      ref: 'Notification',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    actionType: {
      type: String,
      enum: ['content', 'wallet', 'profile', 'other'],
    },
    actionUrl: {
      type: String,
    },
    imageUrl: {
      type: String,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
UserNotificationSchema.index({ userId: 1, receivedAt: -1 });
UserNotificationSchema.index({ userId: 1, isRead: 1 });
UserNotificationSchema.index({ userId: 1, notificationId: 1 }, { unique: true });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
export const UserNotification = mongoose.model<IUserNotification>('UserNotification', UserNotificationSchema);
