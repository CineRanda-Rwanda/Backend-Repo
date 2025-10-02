import axios from 'axios';
import AppError from '../../utils/AppError';

export class WhatsAppService {
  private apiKey: string;
  private username: string;
  private waNumber: string;
  private apiUrl = 'https://chat.africastalking.com/whatsapp/message/send';
  
  constructor() {
    this.apiKey = process.env.AT_API_KEY || '';
    this.username = process.env.AT_USERNAME || '';
    this.waNumber = process.env.AT_WHATSAPP_NUMBER || '';
    
    if (!this.apiKey || !this.username || !this.waNumber) {
      console.warn('Africa\'s Talking WhatsApp credentials not fully configured');
    }
  }
  
  /**
   * Send OTP verification code via WhatsApp
   */
  async sendOtp(phoneNumber: string): Promise<string> {
    try {
      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Format phone number if needed
      let formattedNumber = phoneNumber;
      if (!formattedNumber.startsWith('+')) {
        formattedNumber = `+${formattedNumber}`;
      }
      
      // Create WhatsApp message with the OTP
      const message = `Your CinéRanda verification code is: ${otp}`;
      
      // In development mode, log the OTP instead of sending
      if (process.env.NODE_ENV !== 'production') {
        console.log('=================================================');
        console.log(`📱 WhatsApp OTP for ${phoneNumber}: ${otp}`);
        console.log('=================================================');
        return otp;
      }
      
      // Make API request to send WhatsApp message
      const response = await axios.post(
        this.apiUrl,
        {
          username: this.username,
          waNumber: this.waNumber,
          phoneNumber: formattedNumber,
          body: {
            message: message
          }
        },
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'apiKey': this.apiKey
          }
        }
      );
      
      // Check if message was sent successfully
      if (response.data && response.data.success) {
        console.log('WhatsApp message sent successfully:', response.data);
        return otp;
      } else {
        console.error('WhatsApp message sending failed:', response.data);
        throw new Error('Failed to send WhatsApp verification message');
      }
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      
      // Check if it's an Axios error with response
      if (error.response) {
        throw new AppError(
          `WhatsApp sending failed: ${error.response.data.message || 'Unknown error'}`, 
          error.response.status || 500
        );
      }
      
      throw new AppError('Failed to send verification code via WhatsApp', 500);
    }
  }
}