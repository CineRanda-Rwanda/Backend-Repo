import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../../core/services/payment.service';
import { PaymentRepository } from '../../data/repositories/payment.repository';
import { AuthRequest } from '../../middleware/auth.middleware';
import { Content } from '../../data/models/movie.model';
import { User } from '../../data/models/user.model';
import AppError from '../../utils/AppError';
import config from '../../config';

export class PaymentController {
  private paymentService: PaymentService;
  private paymentRepository: PaymentRepository;

  constructor() {
    this.paymentService = new PaymentService();
    this.paymentRepository = new PaymentRepository();
  }

  /**
   * Helper method to get correct pricing for content (RWF only)
   */
  private getContentPricing(content: any): number {
    if (content.contentType === 'Movie') {
      return content.price || 0;
    } else if (content.contentType === 'Series') {
      // Use discounted price for series (already includes discount if set)
      return content.discountedSeriesPrice || content.totalSeriesPrice || 0;
    }
    
    return 0;
  }

  /**
   * Initialize payment for content purchase
   */
  initiateContentPurchase = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }

      const { contentId } = req.body;
      
      if (!contentId) {
        return next(new AppError('Content ID is required', 400));
      }

      // Find content
      const content = await Content.findById(contentId);
      if (!content) {
        return next(new AppError('Content not found', 404));
      }

      // Get correct pricing based on content type (RWF only)
      const price = this.getContentPricing(content);

      if (price <= 0) {
        return next(new AppError('Invalid content pricing', 400));
      }

      // Initialize payment
      const response = await this.paymentService.initializeContentPurchase(
        req.user,
        contentId,
        content.title,
        price
      );

      // Extract the txRef from the response
      const txRef = response?.generatedTxRef || '';

      // Create pending purchase record
      if (response && response.status === 'success') {
        const userId = String(req.user._id);

        await this.paymentRepository.createPurchaseRecord(
          userId,
          contentId,
          content.contentType,
          price,
          'flutterwave',
          response.data.id?.toString() || 'unknown',
          txRef,
          'pending',
          'content',
          {
            flutterwave: response.data,
            discountApplied: content.contentType === 'Series' ? content.seriesDiscountPercent : 0,
            originalPrice: content.contentType === 'Series' ? content.totalSeriesPrice : price
          }
        );
      }

      res.status(200).json({
        status: 'success',
        data: {
          paymentLink: response.data.link,
          transactionRef: txRef,
          amount: price,
          currency: 'RWF',
          discount: content.contentType === 'Series' ? content.seriesDiscountPercent : 0
        }
      });
    } catch (error) {
      console.error('Payment initiation error:', error);
      next(error);
    }
  };

  /**
   * Top up wallet
   */
  topUpWallet = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }

      // Add extra checks for request body
      if (!req.body) {
        return next(new AppError('Request body is missing', 400));
      }

      const amount = req.body.amount;
      
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return next(new AppError('Valid amount is required', 400));
      }

      const amountValue = Number(amount);

      // Initialize payment
      const response = await this.paymentService.initializeWalletTopUp(
        req.user,
        amountValue
      );

      // Debug the response
      console.log('Flutterwave wallet topup response:', JSON.stringify(response, null, 2));

      // Check if response has the expected structure
      if (!response || response.status !== 'success' || !response.data || !response.data.link) {
        console.error('Invalid Flutterwave response:', response);
        return next(new AppError('Payment initialization failed. Invalid response from payment gateway.', 500));
      }

      // Get the transaction reference from our generated value
      const txRef = response.generatedTxRef;

      // Create pending purchase record
      if (response && response.status === 'success') {
        const userId = String(req.user._id);

        await this.paymentRepository.createPurchaseRecord(
          userId,
          null,
          null,
          amountValue,
          'flutterwave',
          response.data.id?.toString() || 'unknown',
          txRef,
          'pending',
          'wallet',
          {
            flutterwave: response.data
          }
        );
      }

      res.status(200).json({
        status: 'success',
        data: {
          paymentLink: response.data.link,
          transactionRef: txRef
        }
      });
    } catch (error) {
      console.error('Wallet top-up error:', error);
      next(error);
    }
  };

  /**
   * Get wallet balance
   */
  getWalletBalance = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }

      const user = await User.findById(req.user._id).select('wallet balance');

      const wallet = user?.wallet || { balance: user?.balance || 0, bonusBalance: 0 };
      const totalBalance = (wallet.balance || 0) + (wallet.bonusBalance || 0) + (user?.balance && !(wallet && wallet.balance) ? user.balance : 0);

      res.status(200).json({
        status: 'success',
        data: {
          wallet: {
            balance: wallet.balance || 0,
            bonusBalance: wallet.bonusBalance || 0,
            totalBalance,
          },
          currency: 'RWF'
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Purchase content using wallet balance
   */
  purchaseContentWithWallet = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }

      const { contentId } = req.body;
      
      if (!contentId) {
        return next(new AppError('Content ID is required', 400));
      }

      // Find content
      const content = await Content.findById(contentId);
      if (!content) {
        return next(new AppError('Content not found', 404));
      }

      // Get fresh user data
      const user = await User.findById(req.user._id);
      if (!user) {
        return next(new AppError('User not found', 404));
      }

      // Get price (RWF only)
      const price = this.getContentPricing(content);

      if (price <= 0) {
        return next(new AppError('Invalid content pricing', 400));
      }

      // Compute user's total available funds (wallet bonus + wallet balance)
      const walletTotal = (user.wallet?.bonusBalance || 0) + (user.wallet?.balance || 0);
      if (walletTotal < price) {
        return next(new AppError(
          `Insufficient balance. You need ${price} RWF but have ${walletTotal} RWF.`,
          400
        ));
      }

      // Check if already purchased
      const alreadyPurchased = await this.paymentRepository.checkContentPurchase(
        String(user._id),
        contentId
      );

      if (alreadyPurchased) {
        return next(new AppError('You have already purchased this content', 400));
      }

      // 1. Deduct from user's wallet (bonus used first) and add purchasedContent
      await (user as any).deductFromWallet(price, 'purchase', `Purchased ${content.title}${content.contentType === 'Series' && content.seriesDiscountPercent ? ` (${content.seriesDiscountPercent}% discount)` : ''}`);

      // Prepare purchasedContent entry. For Series, snapshot included episode IDs at purchase time
      const purchaseEntry: any = {
        contentId: contentId,
        purchaseDate: new Date(),
        price: price,
        currency: 'RWF'
      };

      if (content.contentType === 'Series') {
        // Collect all current episode ids for snapshot
        const episodeIds: string[] = [];
        (content.seasons || []).forEach((s: any) => {
          (s.episodes || []).forEach((e: any) => {
            if (e && e._id) episodeIds.push(e._id.toString());
          });
        });
        purchaseEntry.episodeIdsAtPurchase = episodeIds;
      }

      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        {
          $push: {
            purchasedContent: purchaseEntry,
            transactions: {
              type: 'purchase',
              amount: -price,
              description: `Purchased ${content.title}${content.contentType === 'Series' && content.seriesDiscountPercent ? ` (${content.seriesDiscountPercent}% discount)` : ''}`,
              createdAt: new Date()
            }
          }
        },
        { new: true }
      );

      // 2. Create purchase record
      const transactionRef = `WALLET-${Date.now()}`;
      await this.paymentRepository.createPurchaseRecord(
        String(user._id),
        contentId,
        content.contentType,
        price,
        'wallet',
        transactionRef,
        transactionRef,
        'completed',
        'content',
        { 
          purchaseDate: new Date(),
          discountApplied: content.contentType === 'Series' ? content.seriesDiscountPercent : 0,
          originalPrice: content.contentType === 'Series' ? content.totalSeriesPrice : price
        }
      );

      res.status(200).json({
        status: 'success',
        message: 'Content purchased successfully',
        data: {
          content: {
            _id: content._id,
            title: content.title,
            contentType: content.contentType,
            ...(content.contentType === 'Series' && purchaseEntry.episodeIdsAtPurchase ? {
              episodesIncluded: purchaseEntry.episodeIdsAtPurchase.length
            } : {})
          },
          pricePaid: price,
          currency: 'RWF',
          originalPrice: content.contentType === 'Series' ? content.totalSeriesPrice : price,
          discount: content.contentType === 'Series' ? `${content.seriesDiscountPercent}%` : '0%',
          savings: content.contentType === 'Series' ? (content.totalSeriesPrice || 0) - price : 0,
          remainingBalance: updatedUser?.wallet?.balance || 0,
          remainingBonusBalance: updatedUser?.wallet?.bonusBalance || 0,
          totalBalance: (updatedUser?.wallet?.balance || 0) + (updatedUser?.wallet?.bonusBalance || 0)
        }
      });
    } catch (error) {
      console.error('Wallet purchase error:', error);
      next(error);
    }
  };

  /**
   * Purchase individual episode using wallet balance
   * NEW METHOD for episode purchases
   */
  purchaseEpisodeWithWallet = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }

      const { contentId, seasonNumber, episodeId } = req.body;
      
      if (!contentId || !seasonNumber || !episodeId) {
        return next(new AppError('Content ID, season number, and episode ID are required', 400));
      }

      // Find series
      const series = await Content.findOne({ _id: contentId, contentType: 'Series' });
      if (!series) {
        return next(new AppError('Series not found', 404));
      }

      // Find the specific season and episode
      const season = series.seasons?.find((s: any) => s.seasonNumber === parseInt(seasonNumber));
      if (!season) {
        return next(new AppError('Season not found', 404));
      }

      const episode = season.episodes.find((e: any) => e._id.toString() === episodeId);
      if (!episode) {
        return next(new AppError('Episode not found', 404));
      }

      // Check if episode is free
      if (episode.isFree) {
        return next(new AppError('This episode is free to watch', 400));
      }

      // Get fresh user data
      const user = await User.findById(req.user._id);
      if (!user) {
        return next(new AppError('User not found', 404));
      }

      // Determine episode price (RWF only)
      const episodePrice = episode.price || 0;

      if (episodePrice <= 0) {
        return next(new AppError('Invalid episode pricing', 400));
      }

      // Compute user's total available balance (wallet only)
      const walletTotal = (user.wallet?.bonusBalance || 0) + (user.wallet?.balance || 0);
      if (walletTotal < episodePrice) {
        return next(new AppError(
          `Insufficient balance. You need ${episodePrice} RWF but have ${walletTotal} RWF.`, 
          400
        ));
      }

      // Check if already purchased the full series
      const seriesPurchase = user.purchasedContent?.find(
        (pc: any) => pc.contentId?.toString() === contentId
      );
      
      if (seriesPurchase) {
        // Allow purchasing if episode was added AFTER series purchase (locked episode)
        const episodeWasAvailable = seriesPurchase.episodeIdsAtPurchase?.includes(episodeId);
        
        if (episodeWasAvailable) {
          return next(new AppError('You have already purchased the full series which includes this episode', 400));
        }
        // If episode wasn't available at purchase time, allow buying it separately
      }

      // Check if already purchased this episode
      const alreadyPurchased = user.purchasedEpisodes?.some(
        (pe: any) => pe.episodeId?.toString() === episodeId
      );
      
      if (alreadyPurchased) {
        return next(new AppError('You have already purchased this episode', 400));
      }

      // Deduct from wallet first (bonus then main)
      await (user as any).deductFromWallet(episodePrice, 'purchase', `Purchased ${series.title} - S${seasonNumber}E${episode.episodeNumber}: ${episode.title}`);

      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        { 
          $push: {
            purchasedEpisodes: {
              contentId: contentId,
              episodeId: episodeId,
              purchaseDate: new Date(),
              price: episodePrice,
              currency: 'RWF'
            },
            transactions: {
              type: 'purchase',
              amount: -episodePrice,
              description: `Purchased ${series.title} - S${seasonNumber}E${episode.episodeNumber}: ${episode.title}`,
              createdAt: new Date()
            }
          }
        },
        { new: true }
      );

      // Create purchase record
      const transactionRef = `WALLET-EP-${Date.now()}`;
      await this.paymentRepository.createPurchaseRecord(
        String(user._id),
        contentId,
        'Episode',  // This is the contentType, not purchaseType
        episodePrice,
        'wallet',
        transactionRef,
        transactionRef,
        'completed',
        'content',  // CHANGED from 'episode' to 'content'
        { 
          purchaseDate: new Date(),
          episodeId: episodeId,
          seasonNumber: seasonNumber,
          episodeNumber: episode.episodeNumber,
          episodeTitle: episode.title,
          isEpisodePurchase: true  // ADDED flag to distinguish
        }
      );

      res.status(200).json({
        status: 'success',
        message: 'Episode purchased successfully',
        data: {
          episode: {
            _id: episode._id,
            title: episode.title,
            episodeNumber: episode.episodeNumber,
            seasonNumber: seasonNumber
          },
          series: {
            _id: series._id,
            title: series.title
          },
          pricing: {
            pricePaid: episodePrice,
            currency: 'RWF'
          },
          remainingBalance: updatedUser?.wallet?.balance || 0,
          remainingBonusBalance: updatedUser?.wallet?.bonusBalance || 0,
          totalBalance: (updatedUser?.wallet?.balance || 0) + (updatedUser?.wallet?.bonusBalance || 0)
        }
      });
    } catch (error) {
      console.error('Episode purchase error:', error);
      next(error);
    }
  };

  /**
   * Purchase a season with wallet
   */
  purchaseSeasonWithWallet = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }

      const { contentId, seasonNumber } = req.body;
      
      if (!contentId || !seasonNumber) {
        return next(new AppError('Content ID and season number are required', 400));
      }

      // Find series
      const series = await Content.findOne({ _id: contentId, contentType: 'Series' });
      if (!series) {
        return next(new AppError('Series not found', 404));
      }

      // Find the specific season
      const season = series.seasons?.find((s: any) => s.seasonNumber === parseInt(seasonNumber));
      if (!season) {
        return next(new AppError('Season not found', 404));
      }

      // Get fresh user data
      const user = await User.findById(req.user._id);
      if (!user) {
        return next(new AppError('User not found', 404));
      }

      // Calculate season price (sum of all episode prices with series discount)
      let seasonTotalPrice = 0;
      const episodeIds: string[] = [];
      (season.episodes || []).forEach((e: any) => {
        if (e && e._id) {
          const episodePrice = e.price || 0;
          seasonTotalPrice += episodePrice;
          episodeIds.push(e._id.toString());
        }
      });

      // Apply series discount if available
      const discountPercent = series.seriesDiscountPercent || 0;
      const originalPrice = seasonTotalPrice;
      const discountAmount = (seasonTotalPrice * discountPercent) / 100;
      const finalPrice = seasonTotalPrice - discountAmount;

      if (finalPrice <= 0) {
        return next(new AppError('Invalid season pricing', 400));
      }

      // Check wallet balance
      const walletTotal = (user.wallet?.bonusBalance || 0) + (user.wallet?.balance || 0);
      if (walletTotal < finalPrice) {
        return next(new AppError(
          `Insufficient balance. You need ${finalPrice} RWF but have ${walletTotal} RWF.`, 
          400
        ));
      }

      // Check if already purchased the full series
      const hasFullSeries = user.purchasedContent?.some(
        (pc: any) => pc.contentId?.toString() === contentId
      );
      
      if (hasFullSeries) {
        return next(new AppError('You have already purchased the full series', 400));
      }

      // Check if already purchased this season
      const alreadyPurchasedSeason = user.purchasedSeasons?.some(
        (ps: any) => ps.seasonId?.toString() === season._id?.toString()
      );
      
      if (alreadyPurchasedSeason) {
        return next(new AppError('You have already purchased this season', 400));
      }

      // Deduct from wallet
      await (user as any).deductFromWallet(finalPrice, 'purchase', `Purchased ${series.title} - Season ${seasonNumber}`);

      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        { 
          $push: {
            purchasedSeasons: {
              contentId: contentId,
              seasonId: season._id,
              seasonNumber: parseInt(seasonNumber),
              purchaseDate: new Date(),
              price: finalPrice,
              currency: 'RWF',
              episodeIdsAtPurchase: episodeIds
            },
            transactions: {
              type: 'purchase',
              amount: -finalPrice,
              description: `Purchased ${series.title} - Season ${seasonNumber}`,
              createdAt: new Date()
            }
          }
        },
        { new: true }
      );

      // Create purchase record
      const transactionRef = `WALLET-SEASON-${Date.now()}`;
      await this.paymentRepository.createPurchaseRecord(
        String(user._id),
        contentId,
        'Season',
        finalPrice,
        'wallet',
        transactionRef,
        transactionRef,
        'completed',
        'content',
        { 
          purchaseDate: new Date(),
          seasonId: season._id,
          seasonNumber: parseInt(seasonNumber),
          episodeIdsAtPurchase: episodeIds,
          originalPrice: originalPrice,
          discountPercent: discountPercent,
          isSeasonPurchase: true
        }
      );

      res.status(200).json({
        status: 'success',
        message: 'Season purchased successfully',
        data: {
          season: {
            _id: season._id,
            seasonNumber: parseInt(seasonNumber),
            episodeCount: episodeIds.length,
            episodesIncluded: episodeIds.length
          },
          series: {
            _id: series._id,
            title: series.title
          },
          pricing: {
            originalPrice: originalPrice,
            discount: discountPercent,
            finalPrice: finalPrice
          },
          remainingBalance: updatedUser?.wallet?.balance || 0
        }
      });
    } catch (error) {
      console.error('Season purchase error:', error);
      next(error);
    }
  };

  /**
   * Payment callback handler
   */
  handlePaymentCallback = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, tx_ref, transaction_id } = req.query;
      
      if (status === 'successful' && tx_ref && transaction_id) {
        // Verify payment
        const verification = await this.paymentService.verifyPayment(transaction_id.toString());
        
        if (
          verification.status === 'success' && 
          verification.data.status === 'successful' &&
          verification.data.tx_ref === tx_ref
        ) {
          // Find the purchase record
          const purchase = await this.paymentRepository.findByTransactionRef(tx_ref.toString());
          
          if (purchase) {
            // Update purchase status
            await this.paymentRepository.updatePurchaseStatus(
              tx_ref.toString(),
              'completed',
              { verificationData: verification.data }
            );
            
            // Process based on purchase type
            if (purchase.purchaseType === 'wallet') {
              // Add amount to user balance for wallet top-up
              await this.paymentRepository.addBalanceToUser(
                purchase.userId.toString(),
                purchase.amountPaid
              );
            } else if (purchase.purchaseType === 'content' && purchase.contentId) {
              // FIX: Add content to user's purchasedContent
              await User.findByIdAndUpdate(
                purchase.userId,
                {
                  $push: {
                    purchasedContent: {
                      contentId: purchase.contentId,
                      purchaseDate: new Date(),
                      price: purchase.amountPaid,
                      currency: 'RWF'
                    },
                    transactions: {
                      type: 'purchase',
                      amount: -purchase.amountPaid,
                      description: `Purchased content via Flutterwave`,
                      reference: tx_ref,
                      createdAt: new Date()
                    }
                  }
                }
              );
            }
            
            // Redirect to success page
            return res.redirect(`${config.clientUrl}/payment/success?ref=${tx_ref}`);
          }
        }
      }
      
      // If payment failed or verification failed
      return res.redirect(`${config.clientUrl}/payment/failed?ref=${tx_ref}`);
    } catch (error) {
      console.error('Payment callback error:', error);
      return res.redirect(`${config.clientUrl}/payment/failed`);
    }
  };

  /**
   * Payment webhook handler
   */
  handlePaymentWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Verify webhook signature
      const signature = req.headers['verif-hash'];
      if (!signature || signature !== config.payment.flutterwave.secretHash) {
        return res.status(401).json({ status: 'error', message: 'Invalid webhook signature' });
      }

      const payload = req.body;
      
      // Handle webhook events
      if (payload && payload.event === 'charge.completed' && payload.data) {
        const txRef = payload.data.tx_ref;
        const status = payload.data.status;
        
        // Find the purchase record
        const purchase = await this.paymentRepository.findByTransactionRef(txRef);
        
        if (purchase && status === 'successful') {
          // Update purchase status
          await this.paymentRepository.updatePurchaseStatus(
            txRef,
            'completed',
            { webhookData: payload }
          );
          
          // Process based on purchase type
          if (purchase.purchaseType === 'wallet') {
            // Add amount to user balance for wallet top-up
            await this.paymentRepository.addBalanceToUser(
              purchase.userId.toString(),
              purchase.amountPaid
            );
          } else if (purchase.purchaseType === 'content' && purchase.contentId) {
            // FIX: Add content to user's purchasedContent
            await User.findByIdAndUpdate(
              purchase.userId,
              {
                $push: {
                  purchasedContent: {
                    contentId: purchase.contentId,
                    purchaseDate: new Date(),
                    price: purchase.amountPaid,
                    currency: 'RWF'
                  },
                  transactions: {
                    type: 'purchase',
                    amount: -purchase.amountPaid,
                    description: `Purchased content via Flutterwave webhook`,
                    reference: txRef,
                    createdAt: new Date()
                  }
                }
              }
            );
          }
        }
      }
      
      // Always return 200 for webhooks to prevent retries
      res.status(200).json({ status: 'success' });
    } catch (error) {
      console.error('Webhook error:', error);
      // Still return 200 to prevent Flutterwave from retrying
      res.status(200).json({ status: 'success' });
    }
  };

  /**
   * Get user's purchase history
   */
  getUserPurchases = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }
      
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const userId = String(req.user._id);
      
      const purchases = await this.paymentRepository.getUserPurchases(
        userId,
        page,
        limit
      );
      
      res.status(200).json({
        status: 'success',
        results: purchases.length,
        data: { purchases }
      });
    } catch (error) {
      next(error);
    }
  };
}