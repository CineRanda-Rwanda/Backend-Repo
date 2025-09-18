import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../core/services/auth.service';
import AppError from '../../utils/AppError'; // Corrected default import

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, phoneNumber, pin } = req.body;
      
      if (!username || !phoneNumber || !pin) {
        return next(new AppError('Username, phone number and PIN are required', 400));
      }
      
      // We'll update the AuthService later
      const result = await this.authService.register({ 
        username, 
        phoneNumber, 
        pin 
      });
      
      res.status(201).json({ status: 'success', ...result });
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { identifier, pin } = req.body;
      
      if (!identifier || !pin) {
        return next(new AppError('Identifier (username or phone) and PIN are required', 400));
      }
      
      // We'll update the AuthService later
      const result = await this.authService.login(identifier, pin);
      
      res.status(200).json({ status: 'success', ...result });
    } catch (error) {
      next(error);
    }
  };

  refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return next(new AppError('Refresh token is required', 400));
      }
      
      const result = await this.authService.refreshToken(refreshToken);
      
      res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return next(new AppError('Email is required', 400));
      }
      
      await this.authService.forgotPassword(email);
      
      res.status(200).json({
        status: 'success',
        message: 'If an account with that email exists, a password reset link has been sent'
      });
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return next(new AppError('Token and new password are required', 400));
      }
      
      const result = await this.authService.resetPassword(token, newPassword);
      
      if (result) {
        return res.status(200).json({ status: 'success', message: 'Password reset successful' });
      } else {
        return res.status(400).json({ status: 'fail', message: 'Invalid or expired token' });
      }
    } catch (error) {
      next(error);
    }
  };

  getProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id;
      
      const profile = await this.authService.getProfile(userId);
      
      res.status(200).json({
        status: 'success',
        data: profile
      });
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id;
      const { firstName, lastName, preferredLanguage, theme } = req.body;
      
      const profile = await this.authService.updateProfile(userId, {
        firstName,
        lastName,
        preferredLanguage,
        theme
      });
      
      res.status(200).json({
        status: 'success',
        data: profile
      });
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id;
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return next(new AppError('Current password and new password are required', 400));
      }
      
      await this.authService.changePassword(userId, currentPassword, newPassword);
      
      res.status(200).json({
        status: 'success',
        message: 'Password changed successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  // 1. Change PIN
  changePin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      const { currentPin, newPin } = req.body;
      
      if (!currentPin || !newPin) {
        return next(new AppError('Current PIN and new PIN are required', 400));
      }
      
      await this.authService.changePin(userId, currentPin, newPin);
      
      res.status(200).json({
        status: 'success',
        message: 'PIN changed successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Handles the phone number verification request.
   */
  verifyPhone = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Phone number is expected as a query parameter, e.g., /verify-phone?phoneNumber=12345
      const { phoneNumber } = req.query;

      if (!phoneNumber || typeof phoneNumber !== 'string') {
        return next(new AppError('A "phoneNumber" query parameter is required.', 400));
      }

      const exists = await this.authService.verifyPhone(phoneNumber);

      res.status(200).json({
        status: 'success',
        exists,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Handles the "Forgot PIN" request.
   */
  forgotPin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        return next(new AppError('Phone number is required.', 400));
      }

      const resetCode = await this.authService.createPinResetRequest(phoneNumber);

      const response: { status: string; message: string; resetCode?: string } = {
        status: 'success',
        message: 'If an account with that phone number exists, a reset code has been sent.',
      };

      // For development/testing, we can return the code in the response.
      // In production, this should be removed.
      if (process.env.NODE_ENV === 'development' && resetCode) {
        response.resetCode = resetCode;
      }

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Handles the "Reset PIN" action.
   */
  resetPin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code, newPin } = req.body;
      if (!code || !newPin) {
        return next(new AppError('Reset code and new PIN are required.', 400));
      }

      const success = await this.authService.performPinReset(code, newPin);

      if (!success) {
        return next(new AppError('Invalid or expired reset code.', 400));
      }

      res.status(200).json({
        status: 'success',
        message: 'Your PIN has been reset successfully.',
      });
    } catch (error) {
      next(error);
    }
  };
}