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

      // Initialize payment
      const response = await this.paymentService.initializeContentPurchase(
        req.user,
        contentId,
        content.title,
        content.priceInRwf,
        content.priceInCoins
      );

      // Extract the txRef from the response (moved outside the if block)
      const txRef = response?.generatedTxRef || '';

      // Create pending purchase record
      if (response && response.status === 'success') {
        const userId = String(req.user._id);

        await this.paymentRepository.createPurchaseRecord(
          userId,
          contentId,
          content.contentType,
          content.priceInRwf,
          content.priceInCoins,
          'flutterwave',
          response.data.id?.toString() || 'unknown',
          txRef, // Use our generated txRef
          'pending',
          'content',
          {
            flutterwave: response.data
          }
        );
      }

      res.status(200).json({
        status: 'success',
        data: {
          paymentLink: response.data.link,
          transactionRef: txRef // Now txRef is available here
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
          txRef, // Use our generated txRef instead of response.data.tx_ref
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
          transactionRef: txRef // Use our generated txRef
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

      // Check if user has enough balance
      if (user.balance < content.priceInRwf) {
        return next(new AppError(`Insufficient balance. You need ${content.priceInRwf} RWF but have ${user.balance} RWF.`, 400));
      }

      // Check if already purchased
      const alreadyPurchased = await this.paymentRepository.checkContentPurchase(
        String(user._id),
        contentId
      );

      if (alreadyPurchased) {
        return next(new AppError('You have already purchased this content', 400));
      }

      // 1. Deduct from user balance
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        { $inc: { balance: -content.priceInRwf } },
        { new: true }
      );

      // 2. Create purchase record
      const transactionRef = `WALLET-${Date.now()}`;
      await this.paymentRepository.createPurchaseRecord(
        String(user._id),
        contentId,
        content.contentType,
        content.priceInRwf,
        content.priceInCoins,
        'wallet',
        transactionRef,
        transactionRef,
        'completed',
        'content',
        { purchaseDate: new Date() }
      );

      res.status(200).json({
        status: 'success',
        message: 'Content purchased successfully',
        data: {
          remainingBalance: updatedUser?.balance || 0
        }
      });
    } catch (error) {
      console.error('Wallet purchase error:', error);
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
            } else {
              // Add coins to user for content purchase
              await this.paymentRepository.addCoinsToUser(
                purchase.userId.toString(),
                purchase.coinAmount
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
          } else {
            // Add coins to user for content purchase
            await this.paymentRepository.addCoinsToUser(
              purchase.userId.toString(),
              purchase.coinAmount
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

  /**
   * Add purchased content to user's library after successful payment
   */
  private addContentToUserLibrary = async (userId: string, contentId: string, price: number) => {
    try {
      await User.findByIdAndUpdate(
        userId,
        {
          $push: {
            purchasedContent: {
              contentId: new mongoose.Types.ObjectId(contentId),
              purchaseDate: new Date(),
              price: price,
              currency: 'RWF'
            }
          }
        }
      );
      console.log(`Added content ${contentId} to user ${userId}'s library`);
    } catch (error) {
      console.error('Error adding content to user library:', error);
      throw error;
    }
  };

  /**
   * Add purchased episode to user's library
   */
  private addEpisodeToUserLibrary = async (
    userId: string, 
    contentId: string, 
    episodeId: string, 
    price: number
  ) => {
    try {
      await User.findByIdAndUpdate(
        userId,
        {
          $push: {
            purchasedEpisodes: {
              contentId: new mongoose.Types.ObjectId(contentId),
              episodeId: new mongoose.Types.ObjectId(episodeId),
              purchaseDate: new Date(),
              price: price,
              currency: 'RWF'
            }
          }
        }
      );
      console.log(`Added episode ${episodeId} from content ${contentId} to user ${userId}'s library`);
    } catch (error) {
      console.error('Error adding episode to user library:', error);
      throw error;
    }
  };
}