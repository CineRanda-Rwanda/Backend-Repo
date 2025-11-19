import { BaseRepository } from './base.repository';
import { Purchase, IPurchase } from '../models/purchase.model';
import { User } from '../models/user.model';
import mongoose from 'mongoose';

export class PaymentRepository extends BaseRepository<IPurchase> {
  constructor() {
    super(Purchase);
  }

  async createPurchaseRecord(
    userId: string,
    contentId: string | null,
    contentType: string | null,
    amountPaid: number,
    paymentMethod: string,
    transactionId: string,
    transactionRef: string,
    status: 'pending' | 'completed' | 'failed' = 'pending',
    purchaseType: 'content' | 'wallet' = 'content',
    meta: any = {}
  ) {
    const purchaseData: any = {
      userId: new mongoose.Types.ObjectId(userId),
      amountPaid,
      paymentMethod,
      transactionId,
      transactionRef,
      status,
      purchaseType,
      meta
    };

    // Add contentId and contentType only for content purchases
    if (contentId && contentType && purchaseType === 'content') {
      purchaseData.contentId = new mongoose.Types.ObjectId(contentId);
      purchaseData.contentType = contentType;
    }

    return await this.create(purchaseData);
  }

  async findByTransactionRef(transactionRef: string) {
    return await Purchase.findOne({ transactionRef });
  }

  async updatePurchaseStatus(
    transactionRef: string, 
    status: 'completed' | 'failed', 
    meta: any = {}
  ) {
    return await Purchase.findOneAndUpdate(
      { transactionRef },
      { 
        $set: { 
          status,
          ...(meta ? { meta } : {})
        } 
      },
      { new: true }
    );
  }

  async addBalanceToUser(userId: string, amount: number) {
    // Add to wallet.balance in the unified wallet
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    
    if (!user.wallet) {
      user.wallet = { balance: 0, bonusBalance: 0, transactions: [] };
    }
    
    user.wallet.balance = (user.wallet.balance || 0) + amount;
    user.wallet.transactions.push({
      amount,
      type: 'topup',
      description: 'Wallet top-up',
      createdAt: new Date()
    });
    
    return await user.save();
  }

  async addBonusToUser(userId: string, bonusAmount: number, description: string = 'Bonus') {
    // Add to wallet.bonusBalance
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    
    if (!user.wallet) {
      user.wallet = { balance: 0, bonusBalance: 0, transactions: [] };
    }
    
    user.wallet.bonusBalance = (user.wallet.bonusBalance || 0) + bonusAmount;
    user.wallet.transactions.push({
      amount: bonusAmount,
      type: 'bonus',
      description,
      createdAt: new Date()
    });
    
    return await user.save();
  }

  async getUserPurchases(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    
    return await Purchase.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('contentId', 'title posterImageUrl');
  }

  async checkContentPurchase(userId: string, contentId: string) {
    return await Purchase.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      contentId: new mongoose.Types.ObjectId(contentId),
      status: 'completed',
      purchaseType: 'content'
    });
  }
}