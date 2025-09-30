import twilio from 'twilio';
import config from '../../config';
import AppError from '../../utils/AppError';

export class VerificationService {
  private client: twilio.Twilio;
  
  constructor() {
    // Initialize Twilio client with credentials from env
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.warn('Twilio credentials missing. SMS features will not work.');
      // Initialize with dummy values to prevent errors
      this.client = twilio('AC000000000000000000000000000000', '00000000000000000000000000000000');
    } else {
      this.client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    }
  }
  
  /**
   * Sends a verification code via SMS
   */
  async sendVerificationCode(phoneNumber: string): Promise<string> {
    try {
      // Generate a random 6-digit code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      if (process.env.NODE_ENV === 'production') {
        // In production, send actual SMS
        if (!process.env.TWILIO_PHONE_NUMBER) {
          throw new AppError('Twilio phone number not configured', 500);
        }
        
        // Log before sending
        console.log(`Sending verification SMS to ${phoneNumber}`);
        
        // Send the SMS
        await this.client.messages.create({
          body: `Your CinéRanda verification code is: ${verificationCode}`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phoneNumber
        });
        
        console.log(`SMS sent successfully to ${phoneNumber}`);
      } else {
        // In development, log the code
        console.log('=================================================');
        console.log(`📱 VERIFICATION CODE for ${phoneNumber}: ${verificationCode}`);
        console.log('=================================================');
      }
      
      return verificationCode;
    } catch (error) {
      console.error('Error sending verification code:', error);
      
      // Handle Twilio-specific errors
      if ((error as any).code) {
        const twilioError = error as any;
        
        // Common Twilio error codes
        switch(twilioError.code) {
          case 21211:
            throw new AppError('Invalid phone number format', 400);
          case 21608:
            throw new AppError('Unverified phone number. Add this number to verified list in Twilio console', 400);
          case 21610:
            throw new AppError('Message body too long', 400);
          default:
            throw new AppError(`SMS sending failed: ${twilioError.message}`, 500);
        }
      }
      
      throw new AppError('Failed to send verification code', 500);
    }
  }
}