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

  /**
   * Initialize a payment for content purchase using direct API call
   */
  async initializeContentPurchase(
    user: IUser,
    contentId: string,
    contentTitle: string,
    amountInRwf: number
  ): Promise<AugmentedResponse> {
    const txRef = `CINE-${v4()}`;
    const userId = String(user._id);
    
    const payload = {
      tx_ref: txRef,
      amount: amountInRwf,
      currency: 'RWF',
      redirect_url: `${config.payment.callbackUrl}`,
      customer: {
        email: user.email || `${user.phoneNumber}@cineranda.com`,
        phonenumber: user.phoneNumber,
        name: user.firstName ? `${user.firstName} ${user.lastName || ''}` : user.username || user.phoneNumber
      },
      customizations: {
        title: 'Cineranda Content Purchase',
        description: `Purchase of ${contentTitle}`,
        logo: 'https://cineranda.com/logo.png'
      },
      meta: {
        contentId,
        userId,
        type: 'content'
      }
    };

    try {
      // Use direct API call instead of SDK
      const response = await axios.post(
        `${this.baseUrl}/payments`, 
        payload,
        {
          headers: {
            'Authorization': `Bearer ${config.payment.flutterwave.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Return both the response data and our generated txRef
      return {
        ...response.data,
        generatedTxRef: txRef  // Include our reference
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Payment initialization error:', 
        axiosError.response?.data || axiosError.message);
      throw error;
    }
  }

  /**
   * Initialize payment for wallet top-up using direct API call
   */
  async initializeWalletTopUp(
    user: IUser,
    amount: number
  ): Promise<AugmentedResponse> {
    const txRef = `WALLET-${v4()}`;
    const userId = String(user._id);
    
    const payload = {
      tx_ref: txRef,
      amount: amount,
      currency: 'RWF',
      redirect_url: `${config.payment.callbackUrl}`,
      customer: {
        email: user.email || `${user.phoneNumber}@cineranda.com`,
        phonenumber: user.phoneNumber,
        name: user.firstName ? `${user.firstName} ${user.lastName || ''}` : user.username || user.phoneNumber
      },
      customizations: {
        title: 'Cineranda Wallet Top-Up',
        description: `Add ${amount} RWF to your wallet`,
        logo: 'https://cineranda.com/logo.png'
      },
      meta: {
        userId,
        type: 'wallet',
        amount
      }
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/payments`, 
        payload,
        {
          headers: {
            'Authorization': `Bearer ${config.payment.flutterwave.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Return both the response data and our generated txRef
      return {
        ...response.data,
        generatedTxRef: txRef  // Include our reference
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Payment initialization error:', 
        axiosError.response?.data || axiosError.message);
      throw error;
    }
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
