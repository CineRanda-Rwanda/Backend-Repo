import { Purchase, IPurchase } from '../models';
import { BaseRepository } from './base.repository';

export class PurchaseRepository extends BaseRepository<IPurchase> {
  constructor() {
    super(Purchase);
  }

  async findUserPurchases(userId: string): Promise<IPurchase[]> {
    return this.model
      .find({ user: userId })
      .sort({ createdAt: -1 })
      .populate('content', 'title poster type');
  }

  async findContentPurchases(contentId: string): Promise<IPurchase[]> {
    return this.model.find({ content: contentId });
  }

  async findByTransactionId(transactionId: string): Promise<IPurchase | null> {
    return this.model.findOne({ transactionId });
  }

  async updatePaymentStatus(
    transactionId: string,
    status: 'pending' | 'completed' | 'failed' | 'refunded',
    externalTransactionId?: string
  ): Promise<IPurchase | null> {
    const update: any = { 
      paymentStatus: status 
    };
    
    if (status === 'completed') {
      update.accessGrantedAt = new Date();
    }
    
    if (externalTransactionId) {
      update.externalTransactionId = externalTransactionId;
    }
    
    return this.model.findOneAndUpdate(
      { transactionId },
      update,
      { new: true }
    );
  }

  async refundPurchase(
    purchaseId: string,
    adminId: string,
    reason: string
  ): Promise<IPurchase | null> {
    return this.model.findByIdAndUpdate(
      purchaseId,
      {
        paymentStatus: 'refunded',
        refundReason: reason,
        refundedAt: new Date(),
        refundedBy: adminId,
        isActive: false
      },
      { new: true }
    );
  }

  async findRevenueSummary(): Promise<{
    totalRevenue: number;
    revenueByRegion: Record<string, number>;
    revenueByPaymentMethod: Record<string, number>;
  }> {
    const aggregation = await this.model.aggregate([
      { $match: { paymentStatus: 'completed' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$price' },
          
          // Group by pricing tier
          rwandaRevenue: {
            $sum: { $cond: [{ $eq: ['$pricingTier', 'rwanda'] }, '$price', 0] }
          },
          eastAfricaRevenue: {
            $sum: { $cond: [{ $eq: ['$pricingTier', 'east-africa'] }, '$price', 0] }
          },
          otherAfricaRevenue: {
            $sum: { $cond: [{ $eq: ['$pricingTier', 'other-africa'] }, '$price', 0] }
          },
          internationalRevenue: {
            $sum: { $cond: [{ $eq: ['$pricingTier', 'international'] }, '$price', 0] }
          },
          
          // Group by payment method
          mtnMomoRevenue: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'mtn-momo'] }, '$price', 0] }
          },
          airtelMoneyRevenue: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'airtel-money'] }, '$price', 0] }
          },
          bankCardRevenue: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'bank-card'] }, '$price', 0] }
          },
          paypalRevenue: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'paypal'] }, '$price', 0] }
          },
          stripeRevenue: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'stripe'] }, '$price', 0] }
          },
          coinsRevenue: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'coins'] }, '$price', 0] }
          },
          adminGrantRevenue: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'admin-grant'] }, '$price', 0] }
          }
        }
      }
    ]);

    if (aggregation.length === 0) {
      return {
        totalRevenue: 0,
        revenueByRegion: {
          rwanda: 0,
          eastAfrica: 0,
          otherAfrica: 0,
          international: 0
        },
        revenueByPaymentMethod: {
          mtnMomo: 0,
          airtelMoney: 0,
          bankCard: 0,
          paypal: 0,
          stripe: 0,
          coins: 0,
          adminGrant: 0
        }
      };
    }

    const result = aggregation[0];
    
    return {
      totalRevenue: result.totalRevenue || 0,
      revenueByRegion: {
        rwanda: result.rwandaRevenue || 0,
        eastAfrica: result.eastAfricaRevenue || 0,
        otherAfrica: result.otherAfricaRevenue || 0,
        international: result.internationalRevenue || 0
      },
      revenueByPaymentMethod: {
        mtnMomo: result.mtnMomoRevenue || 0,
        airtelMoney: result.airtelMoneyRevenue || 0,
        bankCard: result.bankCardRevenue || 0,
        paypal: result.paypalRevenue || 0,
        stripe: result.stripeRevenue || 0,
        coins: result.coinsRevenue || 0,
        adminGrant: result.adminGrantRevenue || 0
      }
    };
  }
}