import twilio from 'twilio';
import axios, { AxiosError } from 'axios';
import AppError from '../../utils/AppError';

export class VerificationService {
  private twilioClient: twilio.Twilio | null = null;
  private atApiKey: string;
  private atUsername: string;
  private atWaNumber: string;
  private atApiUrl = 'https://chat.africastalking.com/whatsapp/message/send';
  
  constructor() {
    // Initialize Twilio if credentials exist
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    }
    
    // Initialize Africa's Talking credentials
    this.atApiKey = process.env.AT_API_KEY || '';
    this.atUsername = process.env.AT_USERNAME || '';
    this.atWaNumber = process.env.AT_WHATSAPP_NUMBER || '';
    
    // Log configuration status
    console.log(`Verification Service initialized:
      - Twilio SMS: ${this.twilioClient ? 'Configured' : 'Not configured'}
      - Africa's Talking WhatsApp: ${this.atApiKey ? 'Configured' : 'Not configured'}`);
  }
  
  /**
   * Send verification code - can choose channel or send to both
   * @param phoneNumber The recipient's phone number
   * @param channel The channel to send via: 'sms', 'whatsapp', or 'both'
   * @param alternatePhoneNumber Optional different phone number to send to
   */
  async sendVerificationCode(
    phoneNumber: string, 
    channel: 'sms' | 'whatsapp' | 'both' = 'both',
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
    if (channel === 'whatsapp' || channel === 'both') {
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
   * Send verification code via SMS using Twilio
   */
  private async sendSmsCode(phoneNumber: string, code: string): Promise<void> {
    // In development mode, just simulate sending
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] 📱 Would send SMS to ${phoneNumber} with code: ${code}`);
      return;
    }
    
    // Ensure Twilio is configured
    if (!this.twilioClient || !process.env.TWILIO_PHONE_NUMBER) {
      throw new AppError('Twilio not properly configured', 500);
    }
    
    try {
      const message = await this.twilioClient.messages.create({
        body: `Your CinéRanda verification code is: ${code}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });
      
      console.log(`SMS sent to ${phoneNumber}, SID: ${message.sid}`);
    } catch (error) {
      console.error('Twilio SMS error:', error);
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
    channel: 'sms' | 'whatsapp' | 'both' = 'both',
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
    
    if (channel === 'whatsapp' || channel === 'both') {
      await this.sendWhatsAppCode(formattedNumber, code);
    }
  }
  
  /**
   * Verify a code sent to a user
   */
  async verifyCode(storedCode: string, submittedCode: string): Promise<boolean> {
    return storedCode === submittedCode;
  }
}