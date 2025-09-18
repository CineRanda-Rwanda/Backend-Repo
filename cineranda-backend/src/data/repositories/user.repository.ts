import { User, IUser } from '../models/user.model';
import { BaseRepository } from './base.repository';
import mongoose from 'mongoose';

export class UserRepository extends BaseRepository<IUser> {
  constructor() {
    super(User);
  }

  async findByEmail(email: string): Promise<IUser | null> {
    return this.model.findOne({ email });
  }

  async findByUsername(username: string): Promise<IUser | null> {
    return this.model.findOne({ username });
  }

  async findByPhoneNumber(phoneNumber: string): Promise<IUser | null> {
    return this.model.findOne({ phoneNumber });
  }

  async findWithPassword(email: string): Promise<IUser | null> {
    return this.model.findOne({ email }).select('+password');
  }

  async findOne(filter: any, selectFields?: string): Promise<IUser | null> {
    const query = this.model.findOne(filter);
    if (selectFields) {
      query.select(selectFields);
    }
    return query.exec();
  }

  async findById(id: string, selectFields?: string): Promise<IUser | null> {
    const query = this.model.findById(id);
    if (selectFields) {
      query.select(selectFields);
    }
    return query.exec();
  }

  async findByIdWithPassword(id: string): Promise<IUser | null> {
    return this.model.findById(id).select('+password');
  }

  async updateLastActive(userId: string): Promise<void> {
    await this.model.findByIdAndUpdate(userId, {
      lastActive: new Date(),
      $inc: { loginCount: 1 }
    });
  }

  async hasAccessToContent(userId: string, contentId: string): Promise<boolean> {
    const user = await this.model.findOne({
      _id: userId,
      'purchasedContent.contentId': contentId
    });
    
    return !!user;
  }

  async addToPurchasedContent(userId: string, content: {
    contentId: string;
    contentType: string;
    price: number;
    currency: string;
    paymentMethod: string;
    transactionId: string;
  }): Promise<IUser | null> {
    return this.model.findByIdAndUpdate(
      userId,
      {
        $push: {
          purchasedContent: {
            contentId: content.contentId,
            purchaseDate: new Date(),
            price: content.price,
            currency: content.currency
          }
        }
      },
      { new: true }
    );
  }

  async updateWatchHistory(
    userId: string,
    contentId: string,
    progress: number,
    watchTime: number
  ): Promise<IUser | null> {
    const user = await this.model.findById(userId);
    if (!user) return null;

    // Fix the watchHistory access and item type
    const watchHistoryItem = user.watchHistory?.find(
      (item: { contentId: mongoose.Types.ObjectId }) => 
        item.contentId.toString() === contentId
    );

    if (watchHistoryItem) {
      // Update existing record
      watchHistoryItem.progress = progress;
      watchHistoryItem.watchTime += watchTime;
      watchHistoryItem.lastWatched = new Date();
    } else {
      // Add new record
      if (!user.watchHistory) {
        user.watchHistory = [];
      }
      user.watchHistory.push({
        contentId: new mongoose.Types.ObjectId(contentId),
        progress,
        watchTime,
        lastWatched: new Date()
      });
    }

    await user.save();
    return user;
  }

  async updateResetToken(userId: string, token: string, expiryDate: Date): Promise<any> {
    return this.model.updateOne(
      { _id: userId },
      { 
        $set: { 
          passwordResetToken: token,
          passwordResetExpires: expiryDate
        } 
      }
    );
  }

  async resetUserPin(userId: string, newPin: string): Promise<any> {
    return this.model.updateOne(
      { _id: userId },
      {
        $set: { pin: newPin },
        $unset: { passwordResetToken: 1, passwordResetExpires: 1 }
      }
    );
  }

  // Add these methods to your UserRepository class

  // Method to get user by phone with direct model access
  async findUserByPhoneForPin(phoneNumber: string): Promise<IUser | null> {
    return this.model.findOne({ phoneNumber });
  }

  // Method to save reset token directly
  async saveResetToken(userId: string, token: string, expiryDate: Date): Promise<IUser | null> {
    return this.model.findByIdAndUpdate(
      userId,
      {
        passwordResetToken: token,
        passwordResetExpires: expiryDate
      },
      { new: true } // Return updated document
    );
  }

  // Method to verify a token exists
  async findUserByResetToken(token: string, checkExpiry = true): Promise<IUser | null> {
    const query: any = { passwordResetToken: token };
    
    if (checkExpiry) {
      query.passwordResetExpires = { $gt: new Date() };
    }
    
    return this.model.findOne(query);
  }

  // Method to reset PIN using token
  async resetPinWithToken(userId: string, newPin: string): Promise<IUser | null> {
    return this.model.findByIdAndUpdate(
      userId,
      {
        pin: newPin,
        $unset: { passwordResetToken: 1, passwordResetExpires: 1 }
      },
      { new: true }
    );
  }
}