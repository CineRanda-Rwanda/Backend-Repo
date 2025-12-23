import Flutterwave from 'flutterwave-node-v3';
import { v4 } from 'uuid';
import config from '../../config';
import { IUser } from '../../data/models/user.model';
import axios, { AxiosError } from 'axios'; // Add AxiosError for proper typing

// Define types for better TypeScript support
interface FlutterwaveResponse {
  status: string;
  message: string;
  data: any;
}

interface AugmentedResponse extends FlutterwaveResponse {
  generatedTxRef: string;
}

interface PaymentInitOptions {
  user: IUser;
  amount: number;
  txRefPrefix: string;
  title: string;
  description: string;
  meta: Record<string, any>;
}

export class PaymentService {
  private flw: any;
  private baseUrl: string;
  
  constructor() {
    this.flw = new Flutterwave(
      config.payment.flutterwave.publicKey,
      config.payment.flutterwave.secretKey
    );
    this.baseUrl = 'https://api.flutterwave.com/v3';
  }

  private async initiateFlutterwavePayment(options: PaymentInitOptions): Promise<AugmentedResponse> {
    const { user, amount, txRefPrefix, title, description, meta } = options;
    const txRef = `${txRefPrefix}-${v4()}`;
    const userId = String(user._id);

    const customerEmail =
      user.email ||
      config.payment.defaultCustomerEmail ||
      (user.phoneNumber ? `${user.phoneNumber}@randaplus.com` : 'payments@randaplus.com');

    const payload = {
      tx_ref: txRef,
      amount,
      currency: 'RWF',
      redirect_url: `${config.payment.callbackUrl}`,
      customer: {
        email: customerEmail,
        phonenumber: user.phoneNumber,
        name: user.username || user.phoneNumber
      },
      customizations: {
        title,
        description,
        logo: 'https://randaplus.com/logo.png'
      },
      meta: {
        userId,
        ...meta
      }
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/payments`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${config.payment.flutterwave.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        ...response.data,
        generatedTxRef: txRef
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Payment initialization error:', axiosError.response?.data || axiosError.message);
      throw error;
    }
  }

  /**
   * Initialize a payment for content purchase using direct API call
   */
  async initializeContentPurchase(
    user: IUser,
    contentId: string,
    contentTitle: string,
    amountInRwf: number
  ): Promise<AugmentedResponse> {
    return this.initiateFlutterwavePayment({
      user,
      amount: amountInRwf,
      txRefPrefix: 'RPLUS',
      title: 'Randa Plus Content Purchase',
      description: `Purchase of ${contentTitle}`,
      meta: {
        type: 'content',
        unlockType: 'content',
        contentId,
        contentTitle
      }
    });
  }

  /**
   * Initialize payment for wallet top-up using direct API call
   */
  async initializeWalletTopUp(
    user: IUser,
    amount: number
  ): Promise<AugmentedResponse> {
    return this.initiateFlutterwavePayment({
      user,
      amount,
      txRefPrefix: 'WALLET',
      title: 'Randa Plus Wallet Top-Up',
      description: `Add ${amount} RWF to your wallet`,
      meta: {
        type: 'wallet',
        amount
      }
    });
  }

  async initializeSeasonPurchase(
    user: IUser,
    params: {
      contentId: string;
      contentTitle: string;
      seasonId: string;
      seasonNumber: number;
      amountInRwf: number;
    }
  ): Promise<AugmentedResponse> {
    const { contentId, contentTitle, seasonId, seasonNumber, amountInRwf } = params;
    return this.initiateFlutterwavePayment({
      user,
      amount: amountInRwf,
      txRefPrefix: 'SEASON',
      title: 'Randa Plus Season Unlock',
      description: `Unlock Season ${seasonNumber} of ${contentTitle}`,
      meta: {
        type: 'content',
        unlockType: 'season',
        contentId,
        seasonId,
        seasonNumber,
        contentTitle
      }
    });
  }

  async initializeEpisodePurchase(
    user: IUser,
    params: {
      contentId: string;
      contentTitle: string;
      episodeId: string;
      episodeNumber: number;
      seasonNumber: number;
      amountInRwf: number;
    }
  ): Promise<AugmentedResponse> {
    const { contentId, contentTitle, episodeId, episodeNumber, seasonNumber, amountInRwf } = params;
    return this.initiateFlutterwavePayment({
      user,
      amount: amountInRwf,
      txRefPrefix: 'EPISODE',
      title: 'Randa Plus Episode Unlock',
      description: `Unlock Episode ${episodeNumber} (Season ${seasonNumber}) of ${contentTitle}`,
      meta: {
        type: 'content',
        unlockType: 'episode',
        contentId,
        episodeId,
        episodeNumber,
        seasonNumber,
        contentTitle
      }
    });
  }

  /**
   * Verify a payment using the transaction ID
   */
  async verifyPayment(transactionId: string): Promise<FlutterwaveResponse> {
    try {
      // Use direct API call for verification
      const response = await axios.get(
        `${this.baseUrl}/transactions/${transactionId}/verify`,
        {
          headers: {
            'Authorization': `Bearer ${config.payment.flutterwave.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Payment verification error:', 
        axiosError.response?.data || axiosError.message);
      throw error;
    }
  }
}
