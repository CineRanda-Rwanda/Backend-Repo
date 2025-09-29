import twilio from 'twilio';

export class VerificationService {
  private client: twilio.Twilio;
  
  constructor() {
    // Initialize Twilio client with your credentials
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  
  // Send verification code via SMS
  async sendVerificationCode(phoneNumber: string): Promise<string> {
    try {
      // Generate a random 6-digit code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Send SMS with Twilio
      await this.client.messages.create({
        body: `Your Cineranda verification code is: ${verificationCode}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });
      
      return verificationCode;
    } catch (error) {
      console.error('Error sending verification code:', error);
      throw new Error('Failed to send verification code');
    }
  }
}