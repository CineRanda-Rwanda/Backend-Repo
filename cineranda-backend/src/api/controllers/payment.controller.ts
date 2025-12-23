import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../../core/services/payment.service';
import { PaymentRepository } from '../../data/repositories/payment.repository';
import { NotificationService } from '../../core/services/notification.service';
import { AuthRequest } from '../../middleware/auth.middleware';
import { Content, IContent } from '../../data/models/movie.model';
import { User } from '../../data/models/user.model';
import { IPurchase } from '../../data/models/purchase.model';
import AppError from '../../utils/AppError';
import config from '../../config';
import { resolvePriceFromFields } from '../../utils/pricing';

export class PaymentController {
  private paymentService: PaymentService;
  private paymentRepository: PaymentRepository;
  private notificationService: NotificationService;

  constructor() {
    this.paymentService = new PaymentService();
    this.paymentRepository = new PaymentRepository();
    this.notificationService = new NotificationService();
  }

  /**
   * Normalize numeric values read from Mongo (handles undefined/null/strings)
   */
  private normalizePrice(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private getUnifiedPrice(source: any): number {
    const resolved = resolvePriceFromFields({
      price: source?.price,
      priceInRwf: source?.priceInRwf,
      priceInCoins: source?.priceInCoins
    });
    return resolved ?? 0;
  }

  /**
   * Calculate total and discounted price for a series by summing paid episodes
   */
  private calculateSeriesPricing(content: IContent): { total: number; discounted: number } {
    const seasons = Array.isArray(content.seasons) ? content.seasons : [];

    const total = seasons.reduce((seasonAcc, season) => {
      const episodes = Array.isArray(season?.episodes) ? season.episodes : [];
      const episodeSum = episodes.reduce((episodeAcc, episode) => {
        if (!episode || episode.isFree) {
          return episodeAcc;
        }
        const episodePrice = this.getUnifiedPrice(episode);
        return episodeAcc + Math.max(episodePrice, 0);
      }, 0);
      return seasonAcc + episodeSum;
    }, 0);

    const rawDiscount = this.normalizePrice(content.seriesDiscountPercent);
    const discountPercent = Math.min(Math.max(rawDiscount, 0), 100);
    const discounted = discountPercent > 0 ? Math.round(total * (1 - discountPercent / 100)) : total;

    return { total, discounted };
  }

  /**
   * Ensure pricing is available for purchases. Recalculates series totals when missing.
   */
  private async ensureContentPricing(content: IContent): Promise<number> {
    if (content.contentType === 'Movie') {
      const moviePrice = this.getUnifiedPrice(content);
      return moviePrice > 0 ? moviePrice : 0;
    }

    if (content.contentType === 'Series') {
      const storedDiscounted = this.getUnifiedPrice({
        price: content.discountedSeriesPrice,
        priceInRwf: (content as any).discountedSeriesPriceInRwf,
        priceInCoins: (content as any).discountedSeriesPriceInCoins
      });
      const storedTotal = this.getUnifiedPrice({
        price: content.totalSeriesPrice,
        priceInRwf: (content as any).totalSeriesPriceInRwf,
        priceInCoins: (content as any).totalSeriesPriceInCoins
      });

      if (storedDiscounted > 0) {
        // Backfill missing total if needed
        if (storedTotal <= 0) {
          const { total } = this.calculateSeriesPricing(content);
          if (total > 0) {
            content.totalSeriesPrice = total;
            await content.save();
          }
        }
        return storedDiscounted;
      }

      const { total, discounted } = this.calculateSeriesPricing(content);
      if (discounted > 0) {
        content.totalSeriesPrice = total;
        content.discountedSeriesPrice = discounted;
        await content.save();
        return discounted;
      }
    }

    return 0;
  }

  private async fulfillContentUnlock(purchase: IPurchase, txRef: string): Promise<void> {
    const meta = (purchase.meta || {}) as Record<string, any>;
    const unlockType = meta.unlockType || 'content';
    const userId = purchase.userId?.toString();

    if (!userId) {
      throw new AppError('Purchase missing user reference', 500);
    }

    if (!purchase.contentId) {
      throw new AppError('Purchase missing content reference', 500);
    }

    const content = await Content.findById(purchase.contentId).select('title posterImageUrl');
    const contentTitle = meta.contentTitle || content?.title || 'your content';
    const actionBase = `/watch/${purchase.contentId.toString()}`;
    const transactionEntry = {
      type: 'purchase',
      amount: -purchase.amountPaid,
      description: `Purchased ${contentTitle} via Flutterwave`,
      reference: txRef,
      createdAt: new Date()
    };

    if (unlockType === 'season') {
      const seasonId = meta.seasonId;
      const seasonNumber = meta.seasonNumber;
      if (!seasonId || seasonNumber === undefined) {
        throw new AppError('Incomplete season metadata for purchase fulfillment', 500);
      }
      if (!mongoose.Types.ObjectId.isValid(seasonId)) {
        throw new AppError('Invalid season identifier on purchase record', 500);
      }

      await User.findByIdAndUpdate(
        purchase.userId,
        {
          $push: {
            purchasedSeasons: {
              contentId: purchase.contentId,
              seasonId: new mongoose.Types.ObjectId(seasonId),
              seasonNumber,
              purchaseDate: new Date(),
              price: purchase.amountPaid,
              currency: 'RWF',
              episodeIdsAtPurchase: meta.episodeIdsAtPurchase || []
            },
            transactions: transactionEntry
          }
        }
      );

      const notificationMeta: Record<string, any> = { actionType: 'content' };
      notificationMeta.actionUrl = `${actionBase}?season=${seasonNumber}`;
      if (content?.posterImageUrl) {
        notificationMeta.imageUrl = content.posterImageUrl;
      }

      await this.notificationService.sendSystemNotification(
        userId,
        'Season Unlocked',
        `You have unlocked Season ${seasonNumber} of ${contentTitle}.`,
        notificationMeta
      );
      return;
    }

    if (unlockType === 'episode') {
      const episodeId = meta.episodeId;
      const seasonNumber = meta.seasonNumber;
      if (!episodeId || seasonNumber === undefined) {
        throw new AppError('Incomplete episode metadata for purchase fulfillment', 500);
      }
      if (!mongoose.Types.ObjectId.isValid(episodeId)) {
        throw new AppError('Invalid episode identifier on purchase record', 500);
      }

      await User.findByIdAndUpdate(
        purchase.userId,
        {
          $push: {
            purchasedEpisodes: {
              contentId: purchase.contentId,
              episodeId: new mongoose.Types.ObjectId(episodeId),
              purchaseDate: new Date(),
              price: purchase.amountPaid,
              currency: 'RWF'
            },
            transactions: transactionEntry
          }
        }
      );

      const episodeNumber = meta.episodeNumber;
      const notificationMeta: Record<string, any> = { actionType: 'content' };
      notificationMeta.actionUrl = `${actionBase}?season=${seasonNumber}&episode=${episodeId}`;
      if (content?.posterImageUrl) {
        notificationMeta.imageUrl = content.posterImageUrl;
      }

      await this.notificationService.sendSystemNotification(
        userId,
        'Episode Unlocked',
        `You have unlocked ${contentTitle} - Season ${seasonNumber}, Episode ${episodeNumber}.`,
        notificationMeta
      );
      return;
    }

    const purchaseEntry: any = {
      contentId: purchase.contentId,
      purchaseDate: new Date(),
      price: purchase.amountPaid,
      currency: 'RWF'
    };
    if (Array.isArray(meta.episodeIdsAtPurchase) && meta.episodeIdsAtPurchase.length) {
      purchaseEntry.episodeIdsAtPurchase = meta.episodeIdsAtPurchase;
    }

    await User.findByIdAndUpdate(
      purchase.userId,
      {
        $push: {
          purchasedContent: purchaseEntry,
          transactions: transactionEntry
        }
      }
    );

    const notificationMeta: Record<string, any> = { actionType: 'content' };
    notificationMeta.actionUrl = actionBase;
    if (content?.posterImageUrl) {
      notificationMeta.imageUrl = content.posterImageUrl;
    }

    await this.notificationService.sendSystemNotification(
      userId,
      'Purchase Successful',
      `You have successfully purchased "${contentTitle}".`,
      notificationMeta
    );
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

      const user = await User.findById(req.user._id);
      if (!user) {
        return next(new AppError('User not found', 404));
      }

      const alreadyPurchasedContent = user.purchasedContent?.some(
        (pc: any) => pc.contentId?.toString() === contentId
      );
      if (alreadyPurchasedContent) {
        return next(new AppError('You already own this content', 400));
      }

      // Get correct pricing based on content type (RWF only)
      const price = await this.ensureContentPricing(content);

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
            unlockType: 'content',
            contentTitle: content.title,
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
    console.warn('Wallet-based purchases are deprecated. Redirecting to direct payment flow.');
    return this.initiateContentPurchase(req, res, next);
  };

  /**
   * Initiate a pay-per-unlock payment for a single episode
   */
  initiateEpisodePurchase = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }

      const { contentId, seasonNumber, episodeId } = req.body;

      if (!contentId || seasonNumber === undefined || !episodeId) {
        return next(new AppError('Content ID, season number, and episode ID are required', 400));
      }

      const parsedSeasonNumber = Number(seasonNumber);
      if (!Number.isFinite(parsedSeasonNumber)) {
        return next(new AppError('Invalid season number', 400));
      }

      const series = await Content.findOne({ _id: contentId, contentType: 'Series' });
      if (!series) {
        return next(new AppError('Series not found', 404));
      }

      const season = series.seasons?.find((s: any) => s.seasonNumber === parsedSeasonNumber);
      if (!season) {
        return next(new AppError('Season not found', 404));
      }

      const episode = season.episodes?.find((e: any) => e?._id?.toString() === episodeId);
      if (!episode) {
        return next(new AppError('Episode not found', 404));
      }

      if (episode.isFree) {
        return next(new AppError('This episode is free to watch', 400));
      }

      const user = await User.findById(req.user._id);
      if (!user) {
        return next(new AppError('User not found', 404));
      }

      // Prevent duplicate unlocks
      const seriesPurchase = user.purchasedContent?.find(
        (pc: any) => pc.contentId?.toString() === contentId
      );
      if (seriesPurchase) {
        const episodeWasAvailable = seriesPurchase.episodeIdsAtPurchase?.includes(episodeId);
        if (episodeWasAvailable) {
          return next(new AppError('You already own this content', 400));
        }
      }

      const hasSeason = user.purchasedSeasons?.some(
        (ps: any) => ps.seasonId?.toString() === season._id?.toString()
      );
      if (hasSeason) {
        return next(new AppError('You already own this season', 400));
      }

      const alreadyPurchasedEpisode = user.purchasedEpisodes?.some(
        (pe: any) => pe.episodeId?.toString() === episodeId
      );
      if (alreadyPurchasedEpisode) {
        return next(new AppError('You already own this episode', 400));
      }

      const episodePrice = this.getUnifiedPrice(episode);
      if (episodePrice <= 0) {
        return next(new AppError('Invalid episode pricing', 400));
      }

      if (!episode._id) {
        return next(new AppError('Episode reference is invalid', 500));
      }

      const response = await this.paymentService.initializeEpisodePurchase(user, {
        contentId,
        contentTitle: series.title,
        episodeId: episode._id.toString(),
        episodeNumber: episode.episodeNumber,
        seasonNumber: parsedSeasonNumber,
        amountInRwf: episodePrice
      });

      const txRef = response.generatedTxRef || response.data?.tx_ref || '';

      await this.paymentRepository.createPurchaseRecord(
        String(req.user._id),
        contentId,
        'Episode',
        episodePrice,
        'flutterwave',
        response.data?.id?.toString() || 'unknown',
        txRef,
        'pending',
        'content',
        {
          flutterwave: response.data,
          unlockType: 'episode',
          episodeId: episode._id.toString(),
          episodeNumber: episode.episodeNumber,
          episodeTitle: episode.title,
          seasonId: season._id?.toString(),
          seasonNumber: parsedSeasonNumber,
          contentTitle: series.title,
          price: episodePrice,
          currency: 'RWF'
        }
      );

      res.status(200).json({
        status: 'success',
        data: {
          paymentLink: response.data?.link,
          transactionRef: txRef,
          amount: episodePrice,
          currency: 'RWF',
          episode: {
            _id: episode._id,
            title: episode.title,
            episodeNumber: episode.episodeNumber,
            seasonNumber: parsedSeasonNumber
          },
          series: {
            _id: series._id,
            title: series.title
          }
        }
      });
    } catch (error) {
      console.error('Episode payment initiation error:', error);
      next(error);
    }
  };

  /**
   * Initiate a pay-per-unlock payment for an entire season
   */
  initiateSeasonPurchase = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }

      const { contentId, seasonNumber } = req.body;
      if (!contentId || seasonNumber === undefined) {
        return next(new AppError('Content ID and season number are required', 400));
      }

      const parsedSeasonNumber = Number(seasonNumber);
      if (!Number.isFinite(parsedSeasonNumber)) {
        return next(new AppError('Invalid season number', 400));
      }

      const series = await Content.findOne({ _id: contentId, contentType: 'Series' });
      if (!series) {
        return next(new AppError('Series not found', 404));
      }

      const season = series.seasons?.find((s: any) => s.seasonNumber === parsedSeasonNumber);
      if (!season) {
        return next(new AppError('Season not found', 404));
      }

      const user = await User.findById(req.user._id);
      if (!user) {
        return next(new AppError('User not found', 404));
      }

      const hasFullSeries = user.purchasedContent?.some(
        (pc: any) => pc.contentId?.toString() === contentId
      );
      if (hasFullSeries) {
        return next(new AppError('You already own the full series', 400));
      }

      const alreadyPurchasedSeason = user.purchasedSeasons?.some(
        (ps: any) => ps.seasonId?.toString() === season._id?.toString()
      );
      if (alreadyPurchasedSeason) {
        return next(new AppError('You already own this season', 400));
      }

      let seasonTotalPrice = 0;
      const episodeIds: string[] = [];
      (season.episodes || []).forEach((episode: any) => {
        if (episode && episode._id) {
          seasonTotalPrice += this.getUnifiedPrice(episode);
          episodeIds.push(episode._id.toString());
        }
      });

      const discountPercentRaw = this.normalizePrice(series.seriesDiscountPercent);
      const discountPercent = Math.min(Math.max(discountPercentRaw, 0), 100);
      const originalPrice = seasonTotalPrice;
      const discountAmount = Math.round((seasonTotalPrice * discountPercent) / 100);
      const finalPrice = seasonTotalPrice - discountAmount;

      if (finalPrice <= 0) {
        return next(new AppError('Invalid season pricing', 400));
      }

      if (!season._id) {
        return next(new AppError('Season reference is invalid', 500));
      }

      const seasonId = season._id.toString();

      const response = await this.paymentService.initializeSeasonPurchase(req.user, {
        contentId,
        contentTitle: series.title,
        seasonId,
        seasonNumber: parsedSeasonNumber,
        amountInRwf: finalPrice
      });

      const txRef = response.generatedTxRef || response.data?.tx_ref || '';

      await this.paymentRepository.createPurchaseRecord(
        String(req.user._id),
        contentId,
        'Season',
        finalPrice,
        'flutterwave',
        response.data?.id?.toString() || 'unknown',
        txRef,
        'pending',
        'content',
        {
          flutterwave: response.data,
          unlockType: 'season',
          seasonId,
          seasonNumber: parsedSeasonNumber,
          episodeIdsAtPurchase: episodeIds,
          originalPrice,
          discountPercent,
          finalPrice,
          contentTitle: series.title
        }
      );

      res.status(200).json({
        status: 'success',
        data: {
          paymentLink: response.data?.link,
          transactionRef: txRef,
          amount: finalPrice,
          currency: 'RWF',
          season: {
            _id: season._id,
            seasonNumber: parsedSeasonNumber,
            episodeCount: episodeIds.length
          },
          series: {
            _id: series._id,
            title: series.title
          },
          pricing: {
            originalPrice,
            discountPercent,
            finalPrice
          }
        }
      });
    } catch (error) {
      console.error('Season payment initiation error:', error);
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

              // Send notification
              await this.notificationService.sendSystemNotification(
                purchase.userId.toString(),
                'Wallet Top-up Successful',
                `Your wallet has been credited with ${purchase.amountPaid} RWF.`,
                {
                  actionType: 'wallet',
                  priority: 'high'
                }
              );
            } else if (purchase.purchaseType === 'content') {
              await this.fulfillContentUnlock(purchase, tx_ref.toString());
            }
            
            // Redirect to success page (client route configurable via env)
            return res.redirect(`${config.clientUrl}${config.paymentRedirect.successPath}?ref=${tx_ref}`);
          }
        }
      }
      
      // If payment failed or verification failed
      return res.redirect(`${config.clientUrl}${config.paymentRedirect.failedPath}?ref=${tx_ref}`);
    } catch (error) {
      console.error('Payment callback error:', error);
      return res.redirect(`${config.clientUrl}${config.paymentRedirect.failedPath}`);
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

            // Send notification
            await this.notificationService.sendSystemNotification(
              purchase.userId.toString(),
              'Wallet Top-up Successful',
              `Your wallet has been credited with ${purchase.amountPaid} RWF.`,
              {
                actionType: 'wallet',
                priority: 'high'
              }
            );
          } else if (purchase.purchaseType === 'content') {
            await this.fulfillContentUnlock(purchase, txRef);
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