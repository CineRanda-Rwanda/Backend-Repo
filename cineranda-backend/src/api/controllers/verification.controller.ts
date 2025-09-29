import { Request, Response, NextFunction } from 'express';
import { User } from '../../data/models/user.model';
import AppError from '../../utils/AppError';

export class VerificationController {
  // Send verification code to user's phone
  sendVerificationCode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return next(new AppError('Phone number is required', 400));
      }
      
      // Check if user exists with this phone number
      const user = await User.findOne({ phoneNumber });
      
      if (!user) {
        return next(new AppError('No user found with that phone number', 404));
      }
      
      // Don't allow re-verification if already verified
      if (user.phoneVerified) {
        return next(new AppError('Phone number is already verified', 400));
      }
      
      // Generate a verification code (6 digits)
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store verification code with 10 minute expiration
      user.verificationCode = verificationCode;
      user.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      await user.save({ validateBeforeSave: false });
      
      // For development, log the code (in production you'd send SMS)
      console.log(`📱 VERIFICATION CODE for ${phoneNumber}: ${verificationCode}`);
      
      res.status(200).json({
        status: 'success',
        message: 'Verification code sent to your phone'
      });
    } catch (error) {
      next(error);
    }
  };
  
  // Verify phone number with code
  verifyPhoneNumber = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phoneNumber, verificationCode } = req.body;
      
      if (!phoneNumber || !verificationCode) {
        return next(new AppError('Phone number and verification code are required', 400));
      }
      
      // Find user with phone number and verification code
      const user = await User.findOne({
        phoneNumber,
        verificationCode,
        verificationCodeExpires: { $gt: Date.now() }
      });
      
      if (!user) {
        return next(new AppError('Invalid or expired verification code', 400));
      }
      
      // Mark phone as verified and remove verification code
      user.phoneVerified = true;
      user.verificationCode = undefined;
      user.verificationCodeExpires = undefined;
      await user.save();
      
      res.status(200).json({
        status: 'success',
        message: 'Phone number verified successfully'
      });
    } catch (error) {
      next(error);
    }
  };
}