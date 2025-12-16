import axios, { AxiosError } from 'axios';
import { URLSearchParams } from 'url';
import AppError from '../../utils/AppError';

export class VerificationService {
  private atApiKey: string;
  private atUsername: string;
  private atSenderId: string;
  private atWaNumber: string;
  private atApiUrl = 'https://chat.africastalking.com/whatsapp/message/send';
  private whatsappEnabled: boolean;
  private forceSmsSend: boolean;
  private useSandboxApi: boolean;
  private smsApiUrl: string;
  
  constructor() {
    // Initialize Africa's Talking credentials
    this.atApiKey = process.env.AT_API_KEY || '';
    this.atUsername = process.env.AT_USERNAME || '';
    this.atSenderId = process.env.AT_SENDER_ID || '';
    this.atWaNumber = process.env.AT_WHATSAPP_NUMBER || '';
    this.whatsappEnabled = process.env.ENABLE_WHATSAPP_VERIFICATION === 'true';
    this.forceSmsSend = process.env.FORCE_SMS_SEND === 'true';
    this.useSandboxApi = (process.env.AT_ENV || '').toLowerCase() === 'sandbox' || this.atUsername.toLowerCase() === 'sandbox';
    this.smsApiUrl = this.useSandboxApi
      ? 'https://api.sandbox.africastalking.com/version1/messaging'
      : 'https://api.africastalking.com/version1/messaging';
    
    // Log configuration status
    console.log(`Verification Service initialized:
      - Africa's Talking SMS: ${this.atApiKey && this.atUsername ? 'Configured' : 'Not configured'}
      - Africa's Talking SMS Endpoint: ${this.smsApiUrl}
      - SMS Force Send: ${this.forceSmsSend ? 'Enabled' : 'Disabled'}
      - Africa's Talking WhatsApp: ${this.whatsappEnabled && this.atWaNumber ? 'Enabled' : 'Disabled'}`);
  }
  
  /**
   * Send verification code - can choose channel or send to both
   * @param phoneNumber The recipient's phone number
   * @param channel The channel to send via: 'sms', 'whatsapp', or 'both'
   * @param alternatePhoneNumber Optional different phone number to send to
   */
  async sendVerificationCode(
    phoneNumber: string, 
    channel: 'sms' | 'whatsapp' | 'both' = 'sms',
    alternatePhoneNumber?: string
  ): Promise<string> {
    // Generate a single verification code to use across channels
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Use alternate number if provided, otherwise use the registration number
    const targetNumber = alternatePhoneNumber || phoneNumber;
    
    // Normalize phone number format
    let formattedNumber = targetNumber;
    if (!formattedNumber.startsWith('+')) {
      formattedNumber = `+${formattedNumber}`;
    }
    
    let smsSuccess = false;
    let whatsappSuccess = false;
    const errors: string[] = [];
    const wantsWhatsApp = channel === 'whatsapp' || channel === 'both';
    const shouldSendWhatsApp = this.whatsappEnabled && wantsWhatsApp;

    if (wantsWhatsApp && !this.whatsappEnabled) {
      console.log('WhatsApp verification disabled; defaulting to SMS only.');
    }
    
    // Try SMS if requested
    if (channel === 'sms' || channel === 'both') {
      try {
        await this.sendSmsCode(formattedNumber, verificationCode);
        smsSuccess = true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown SMS error';
        errors.push(`SMS: ${errorMessage}`);
        console.error('SMS sending failed:', error);
      }
    }
    
    // Try WhatsApp if requested
    if (shouldSendWhatsApp) {
      try {
        await this.sendWhatsAppCode(formattedNumber, verificationCode);
        whatsappSuccess = true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown WhatsApp error';
        errors.push(`WhatsApp: ${errorMessage}`);
        console.error('WhatsApp sending failed:', error);
      }
    }
    
    // In development, always return the code regardless of sending success
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔑 VERIFICATION CODE for ${formattedNumber}: ${verificationCode}`);
      return verificationCode;
    }
    
    // In production, check if at least one channel succeeded
    if (smsSuccess || whatsappSuccess) {
      return verificationCode;
    }
    
    // If both channels failed in production, throw error
    throw new AppError(`Failed to send verification code: ${errors.join(', ')}`, 500);
  }
  
  /**
   * Send verification code via SMS using Africa's Talking
   */
  private async sendSmsCode(phoneNumber: string, code: string): Promise<void> {
    // In development mode, just simulate sending
    if (process.env.NODE_ENV !== 'production' && !this.forceSmsSend) {
      console.log(`[DEV] 📱 Would send SMS to ${phoneNumber} with code: ${code}`);
      return;
    }
    
    // Ensure Africa's Talking is configured for SMS
    if (!this.atApiKey || !this.atUsername) {
      throw new AppError('Africa\'s Talking SMS not properly configured', 500);
    }

    try {
      const params = new URLSearchParams();
      params.append('username', this.atUsername);
      params.append('to', phoneNumber);
      params.append('message', `Your CinéRanda verification code is: ${code}`);
      if (this.atSenderId) {
        params.append('from', this.atSenderId);
      }

      const response = await axios.post(
        this.smsApiUrl,
        params.toString(),
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'apiKey': this.atApiKey
          }
        }
      );

      const recipients = response.data?.SMSMessageData?.Recipients;
      const hasSuccess = Array.isArray(recipients) && recipients.some((recipient: any) => recipient?.status === 'Success');

      if (!hasSuccess) {
        const firstStatus = Array.isArray(recipients) && recipients.length > 0 ? recipients[0]?.status : 'Unknown error';
        throw new AppError(`SMS failed: ${firstStatus}`, 500);
      }

      console.log(`SMS sent to ${phoneNumber} via Africa's Talking`);
    } catch (error) {
      console.error('Africa\'s Talking SMS error:', error);

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const responseData = axiosError.response?.data as any;
        const errorMessage = responseData?.SMSMessageData?.Message || responseData?.message || 'Unknown error';
        throw new AppError(`SMS failed: ${errorMessage}`, axiosError.response?.status || 500);
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new AppError(`SMS failed: ${errorMessage}`, 500);
    }
  }
  
  /**
   * Send verification code via WhatsApp using Africa's Talking
   */
  private async sendWhatsAppCode(phoneNumber: string, code: string): Promise<void> {
    // In development mode, just simulate sending
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] 💬 Would send WhatsApp to ${phoneNumber} with code: ${code}`);
      return;
    }
    
    // Ensure Africa's Talking is configured
    if (!this.atApiKey || !this.atUsername || !this.atWaNumber) {
      throw new AppError('Africa\'s Talking WhatsApp not properly configured', 500);
    }
    
    try {
      // Make API request to send WhatsApp message
      const response = await axios.post(
        this.atApiUrl,
        {
          username: this.atUsername,
          waNumber: this.atWaNumber,
          phoneNumber,
          body: {
            message: `Your CinéRanda verification code is: ${code}`
          }
        },
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'apiKey': this.atApiKey
          }
        }
      );
      
      // Check if message was sent successfully
      if (!response.data || !response.data.success) {
        throw new AppError('WhatsApp message sending failed', 500);
      }
      
      console.log(`WhatsApp message sent to ${phoneNumber}`);
    } catch (error) {
      console.error('Africa\'s Talking WhatsApp error:', error);
      
      // Handle Axios-specific errors with proper type checking
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const responseData = axiosError.response?.data as any;
        const errorMessage = responseData?.message || 'Unknown error';
        
        throw new AppError(
          `WhatsApp failed: ${errorMessage}`,
          axiosError.response?.status || 500
        );
      }
      
      // Handle other types of errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new AppError(`WhatsApp failed: ${errorMessage}`, 500);
    }
  }
  
  /**
   * Resend verification code to the same or different number
   */
  async resendVerificationCode(
    originalPhoneNumber: string,
    code: string,
    channel: 'sms' | 'whatsapp' | 'both' = 'sms',
    newPhoneNumber?: string
  ): Promise<void> {
    const targetNumber = newPhoneNumber || originalPhoneNumber;
    
    let formattedNumber = targetNumber;
    if (!formattedNumber.startsWith('+')) {
      formattedNumber = `+${formattedNumber}`;
    }
    
    if (channel === 'sms' || channel === 'both') {
      await this.sendSmsCode(formattedNumber, code);
    }
    
    const shouldSendWhatsApp = this.whatsappEnabled && (channel === 'whatsapp' || channel === 'both');
    if (shouldSendWhatsApp) {
      await this.sendWhatsAppCode(formattedNumber, code);
    }
  }

  isWhatsAppEnabled(): boolean {
    return this.whatsappEnabled;
  }

  isForceSmsEnabled(): boolean {
    return this.forceSmsSend;
  }
  
  /**
   * Verify a code sent to a user
   */
  async verifyCode(storedCode: string, submittedCode: string): Promise<boolean> {
    return storedCode === submittedCode;
  }
}