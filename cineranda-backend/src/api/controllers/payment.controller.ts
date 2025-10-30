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
   * Helper method to get correct pricing for content
   */
  private getContentPricing(content: any): { priceInRwf: number; priceInCoins: number } {
    if (content.contentType === 'Movie') {
      return {
        priceInRwf: content.priceInRwf || 0,
        priceInCoins: content.priceInCoins || 0
      };
    } else if (content.contentType === 'Series') {
      // Use discounted price for series (already includes discount if set)
      return {
        priceInRwf: content.discountedSeriesPriceInRwf || content.totalSeriesPriceInRwf || 0,
        priceInCoins: content.discountedSeriesPriceInCoins || content.totalSeriesPriceInCoins || 0
      };
    }
    
    return { priceInRwf: 0, priceInCoins: 0 };
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

      // FIX: Get correct pricing based on content type
      const { priceInRwf, priceInCoins } = this.getContentPricing(content);

      if (priceInRwf <= 0) {
        return next(new AppError('Invalid content pricing', 400));
      }

      // Initialize payment
      const response = await this.paymentService.initializeContentPurchase(
        req.user,
        contentId,
        content.title,
        priceInRwf,
        priceInCoins
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
          priceInRwf,
          priceInCoins,
          'flutterwave',
          response.data.id?.toString() || 'unknown',
          txRef,
          'pending',
          'content',
          {
            flutterwave: response.data,
            discountApplied: content.contentType === 'Series' ? content.seriesDiscountPercent : 0,
            originalPrice: content.contentType === 'Series' ? content.totalSeriesPriceInRwf : priceInRwf
          }
        );
      }

      res.status(200).json({
        status: 'success',
        data: {
          paymentLink: response.data.link,
          transactionRef: txRef,
          amount: priceInRwf,
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
          0,
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

      const user = await User.findById(req.user._id).select('balance');

      res.status(200).json({
        status: 'success',
        data: {
          balance: user?.balance || 0
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

      // FIX: Get correct pricing based on content type
      const { priceInRwf, priceInCoins } = this.getContentPricing(content);

      if (priceInRwf <= 0) {
        return next(new AppError('Invalid content pricing', 400));
      }

      // Check if user has enough balance
      if (user.balance < priceInRwf) {
        return next(new AppError(
          `Insufficient balance. You need ${priceInRwf} RWF but have ${user.balance} RWF.`, 
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

      // 1. Deduct from user balance AND add to purchasedContent
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        { 
          $inc: { balance: -priceInRwf },
          $push: {
            purchasedContent: {
              contentId: contentId,
              purchaseDate: new Date(),
              price: priceInRwf,
              currency: 'RWF'
            },
            transactions: {
              type: 'purchase',
              amount: -priceInRwf,
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
        priceInRwf,
        priceInCoins,
        'wallet',
        transactionRef,
        transactionRef,
        'completed',
        'content',
        { 
          purchaseDate: new Date(),
          discountApplied: content.contentType === 'Series' ? content.seriesDiscountPercent : 0,
          originalPrice: content.contentType === 'Series' ? content.totalSeriesPriceInRwf : priceInRwf
        }
      );

      res.status(200).json({
        status: 'success',
        message: 'Content purchased successfully',
        data: {
          content: {
            _id: content._id,
            title: content.title,
            contentType: content.contentType
          },
          pricePaid: priceInRwf,
          originalPrice: content.contentType === 'Series' ? content.totalSeriesPriceInRwf : priceInRwf,
          discount: content.contentType === 'Series' ? `${content.seriesDiscountPercent}%` : '0%',
          savings: content.contentType === 'Series' ? (content.totalSeriesPriceInRwf || 0) - priceInRwf : 0,
          remainingBalance: updatedUser?.balance || 0
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

      const episodePriceRwf = episode.priceInRwf || 0;
      const episodePriceCoins = episode.priceInCoins || 0;

      if (episodePriceRwf <= 0) {
        return next(new AppError('Invalid episode pricing', 400));
      }

      // Check if user has enough balance
      if (user.balance < episodePriceRwf) {
        return next(new AppError(
          `Insufficient balance. You need ${episodePriceRwf} RWF but have ${user.balance} RWF.`, 
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

      // Check if already purchased this episode
      const alreadyPurchased = user.purchasedEpisodes?.some(
        (pe: any) => pe.episodeId?.toString() === episodeId
      );
      
      if (alreadyPurchased) {
        return next(new AppError('You have already purchased this episode', 400));
      }

      // Update user: deduct balance and add purchased episode
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        { 
          $inc: { balance: -episodePriceRwf },
          $push: {
            purchasedEpisodes: {
              contentId: contentId,
              episodeId: episodeId,
              purchaseDate: new Date(),
              price: episodePriceRwf,
              currency: 'RWF'
            },
            transactions: {
              type: 'purchase',
              amount: -episodePriceRwf,
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
        episodePriceRwf,
        episodePriceCoins,
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
          pricePaid: episodePriceRwf,
          remainingBalance: updatedUser?.balance || 0
        }
      });
    } catch (error) {
      console.error('Episode purchase error:', error);
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
              
              // Also add coins if applicable
              if (purchase.coinAmount > 0) {
                await this.paymentRepository.addCoinsToUser(
                  purchase.userId.toString(),
                  purchase.coinAmount
                );
              }
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
            
            // Also add coins if applicable
            if (purchase.coinAmount > 0) {
              await this.paymentRepository.addCoinsToUser(
                purchase.userId.toString(),
                purchase.coinAmount
              );
            }
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