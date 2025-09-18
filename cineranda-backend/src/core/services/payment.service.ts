import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import AppError from '../../utils/AppError';
import config from '../../config';
import { PurchaseRepository } from '../../data/repositories/purchase.repository';
import { MovieService } from './movie.service';

export class PaymentService {
  private stripe: Stripe;
  private purchaseRepository: PurchaseRepository;
  private movieService: MovieService;

  constructor() {
    this.stripe = new Stripe(config.payment.stripe.secretKey || '', {
      apiVersion: '2023-10-16', // Use latest API version
    });
    this.purchaseRepository = new PurchaseRepository();
    this.movieService = new MovieService();
  }

  async createStripePaymentIntent(
    transactionId: string,
    amount: number,
    currency: string,
    customerEmail: string
  ): Promise<{ clientSecret: string }> {
    try {
      // Convert amount to cents for Stripe
      const amountInCents = Math.round(amount * 100);
      
      // Create payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency: currency.toLowerCase(),
        metadata: {
          transactionId,
        },
        receipt_email: customerEmail,
      });
      
      return {
        clientSecret: paymentIntent.client_secret as string,
      };
    } catch (error) {
      console.error('Stripe payment intent error:', error);
      throw new AppError('Payment processing failed', 500);
    }
  }

  async handleStripeWebhook(event: any): Promise<void> {
    const { type, data } = event;
    
    if (type === 'payment_intent.succeeded') {
      const paymentIntent = data.object;
      const transactionId = paymentIntent.metadata.transactionId;
      
      // Confirm the purchase in our system
      await this.movieService.confirmPurchase(
        transactionId,
        paymentIntent.id
      );
    } else if (type === 'payment_intent.payment_failed') {
      const paymentIntent = data.object;
      const transactionId = paymentIntent.metadata.transactionId;
      
      // Mark the purchase as failed
      await this.purchaseRepository.updatePaymentStatus(
        transactionId,
        'failed',
        paymentIntent.id
      );
    }
  }

  // Simplified implementation for Mobile Money (MTN)
  async processMtnMomoPayment(
    transactionId: string,
    amount: number,
    currency: string,
    phoneNumber: string
  ): Promise<{ referenceId: string; status: string }> {
    // In a real implementation, this would call the MTN MOMO API
    // For this project, we'll simulate a successful payment
    
    // Update the purchase status after "payment"
    await this.movieService.confirmPurchase(
      transactionId,
      `mtn-${Date.now()}`
    );
    
    return {
      referenceId: `mtn-${Date.now()}`,
      status: 'SUCCESSFUL'
    };
  }

  // Simplified implementation for Airtel Money
  async processAirtelMoneyPayment(
    transactionId: string,
    amount: number,
    currency: string,
    phoneNumber: string
  ): Promise<{ referenceId: string; status: string }> {
    // In a real implementation, this would call the Airtel Money API
    // For this project, we'll simulate a successful payment
    
    // Update the purchase status after "payment"
    await this.movieService.confirmPurchase(
      transactionId,
      `airtel-${Date.now()}`
    );
    
    return {
      referenceId: `airtel-${Date.now()}`,
      status: 'SUCCESSFUL'
    };
  }

  // Process admin-granted access
  async processAdminGrantAccess(
    userId: string,
    movieId: string,
    adminId: string,
    notes: string
  ): Promise<{ transactionId: string }> {
    const transactionId = `admin-${uuidv4()}`;
    
    // Create a purchase record with admin-grant payment method
    await this.purchaseRepository.create({
      user: userId,
      content: movieId,
      contentType: 'movie', // This should be determined dynamically in a real app
      price: 0, // Free
      currency: 'USD',
      pricingTier: 'international', // Default
      paymentMethod: 'admin-grant',
      paymentStatus: 'completed',
      transactionId,
      isActive: true,
      adminNotes: notes,
      grantedByAdmin: adminId,
      accessGrantedAt: new Date()
    });
    
    return {
      transactionId
    };
  }

  // Get revenue summary
  async getRevenueSummary() {
    return this.purchaseRepository.findRevenueSummary();
  }
}
