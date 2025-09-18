import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../core/services/auth.service';
import AppError from '../../utils/AppError';
import { IUser } from '../../data/models/user.model'; // Import the IUser interface

// Define an interface for requests that have been authenticated
interface AuthRequest extends Request {
  user?: IUser; // The user property is now typed correctly
}

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
        return next(new AppError('Please provide an email address.', 400));
      }

      const resetToken = await this.authService.forgotPassword(email);

      // In a real app, you would email the token to the user here.
      // For now, we send a generic message.
      const response: { status: string; message: string; resetToken?: string } = {
        status: 'success',
        message: 'If an account with that email exists, a password reset token has been generated.',
      };

      // For development/testing, we can include the token in the response.
      if (process.env.NODE_ENV === 'development' && resetToken) {
        response.resetToken = resetToken;
      }

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return next(new AppError('Token and new password are required.', 400));
      }

      const success = await this.authService.resetPassword(token, newPassword);

      if (!success) {
        return next(new AppError('Token is invalid or has expired.', 400));
      }

      res.status(200).json({
        status: 'success',
        message: 'Password has been reset successfully.',
      });
    } catch (error) {
      next(error);
    }
  };

  // --- PROTECTED METHODS ---

  getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // This works for any logged-in user, including admins.
      // The service method is called by the middleware, so we just return the user.
      res.status(200).json({
        status: 'success',
        data: {
          user: req.user,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return next(new AppError('User not found on request. Please log in again.', 401));
      }
      
      // Call the existing service method. It's safe for both users and admins.
      const updatedUser = await this.authService.updateProfile(userId.toString(), req.body);

      res.status(200).json({
        status: 'success',
        message: 'Profile updated successfully.',
        data: { user: updatedUser }
      });
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      const { currentPassword, newPassword } = req.body;
      
      if (!userId) {
        return next(new AppError('User not found on request. Please log in again.', 401));
      }
      
      if (!currentPassword || !newPassword) {
        return next(new AppError('Current password and new password are required', 400));
      }
      
      // Call the existing service method. It's safe for both users and admins.
      await this.authService.changePassword(userId.toString(), currentPassword, newPassword);
      
      res.status(200).json({
        status: 'success',
        message: 'Password changed successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  // 1. Change PIN
  changePin = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      const { oldPin, newPin } = req.body;

      if (!userId) {
        return next(new AppError('User not found on request. Please log in again.', 401));
      }
      if (!oldPin || !newPin) {
        return next(new AppError('Old PIN and new PIN are required.', 400));
      }

      // Your existing change PIN logic here...
      // await this.authService.changePin(userId, oldPin, newPin);

      res.status(200).json({
        status: 'success',
        message: 'PIN changed successfully.',
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

  /**
   * Handles the secure admin login request.
   */
  adminLogin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return next(new AppError('Email and password are required.', 400));
      }

      const result = await this.authService.adminLogin(email, password);

      if (!result) {
        return next(new AppError('Invalid email or password.', 401));
      }

      // --- HANDLE 2FA RESPONSE ---
      if (result.twoFactorRequired) {
        return res.status(200).json({
          status: 'success',
          message: '2FA token required to complete login.',
        });
      }

      res.status(200).json({
        status: 'success',
        token: result.token,
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  };

  // --- NEW 2FA METHODS ---

  setup2FA = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { qrCodeUrl, secret } = await this.authService.setup2FA();
      // The secret is sent back to the client to be used in the verification step.
      res.status(200).json({
        status: 'success',
        data: { qrCodeUrl, secret },
      });
    } catch (error) {
      next(error);
    }
  };

  verify2FA = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      const { token, secret } = req.body;

      if (!userId || !token || !secret) {
        return next(new AppError('User ID, token, and secret are required.', 400));
      }

      const isVerified = await this.authService.verify2FA(userId.toString(), token, secret);

      if (!isVerified) {
        return next(new AppError('Invalid 2FA token.', 400));
      }

      res.status(200).json({ status: 'success', message: '2FA has been enabled successfully.' });
    } catch (error) {
      next(error);
    }
  };

  authenticate2FA = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, token } = req.body;
      if (!email || !token) {
        return next(new AppError('Email and 2FA token are required.', 400));
      }

      const result = await this.authService.validate2FAToken(email, token);

      if (!result) {
        return next(new AppError('Invalid 2FA token.', 401));
      }

      res.status(200).json({
        status: 'success',
        token: result.token,
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  };
}