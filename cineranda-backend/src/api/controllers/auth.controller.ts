import { Request, Response, NextFunction, CookieOptions } from 'express';
import { AuthService } from '../../core/services/auth.service';
import { VerificationService } from '../../core/services/verification.service';
import { NotificationService } from '../../core/services/notification.service';
import AppError from '../../utils/AppError';
import { User, IUser } from '../../data/models/user.model';
import config from '../../config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { SignOptions, Secret } from 'jsonwebtoken'; // Add Secret type
import type { StringValue } from 'ms';
import mongoose, { Document } from 'mongoose';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { URL, URLSearchParams } from 'url';

// Define an interface for requests that have been authenticated
interface AuthRequest extends Request {
  user?: IUser; 
}

// Define AuthenticatedUser type to handle mongoose document properly
type AuthenticatedUser = Document & IUser & { _id: mongoose.Types.ObjectId };

// Helper function for creating tokens - FIXED VERSION
const signToken = (id: string) => {
  const secret = config.jwt.secret || process.env.JWT_SECRET || 'your-fallback-secret';
  const expiresIn = (process.env.JWT_EXPIRES_IN || config.jwt.expiration || '365d') as StringValue;
  
  const options: SignOptions = {
    expiresIn
  };
  
  return jwt.sign({ id }, secret as Secret, options);
};

export class AuthController {
  private authService: AuthService;
  private verificationService: VerificationService;
  private notificationService: NotificationService;
  private googleOAuthClient?: OAuth2Client;
  
  constructor() {
    this.authService = new AuthService();
    this.verificationService = new VerificationService();
    this.notificationService = new NotificationService();
  }

  private getGoogleOAuthClient(): OAuth2Client {
    const oauthConfig = config.oauth?.google;

    if (!oauthConfig?.clientId || !oauthConfig?.clientSecret || !oauthConfig?.backendRedirectUri) {
      throw new AppError('Google OAuth is not configured', 500);
    }

    if (!this.googleOAuthClient) {
      this.googleOAuthClient = new OAuth2Client(
        oauthConfig.clientId,
        oauthConfig.clientSecret,
        oauthConfig.backendRedirectUri
      );
    }

    return this.googleOAuthClient;
  }

  private buildGoogleOAuthUrl(state: string): string {
    const oauthConfig = config.oauth?.google;

    if (!oauthConfig?.clientId || !oauthConfig?.backendRedirectUri) {
      throw new AppError('Google OAuth is not configured', 500);
    }

    const params = new URLSearchParams({
      client_id: oauthConfig.clientId,
      redirect_uri: oauthConfig.backendRedirectUri,
      response_type: 'code',
      scope: oauthConfig.scope || 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  private getOAuthCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60 * 1000,
    };
  }

  private clearOAuthCookies(res: Response): void {
    const options: CookieOptions = {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'lax',
      path: '/',
    };

    res.clearCookie('oauth_state', options);
    res.clearCookie('oauth_redirect', options);
  }

  private getCookieValue(req: Request, name: string): string | undefined {
    const rawCookieHeader = req.headers.cookie;
    if (!rawCookieHeader) {
      return undefined;
    }

    const cookies = rawCookieHeader.split(';').map((cookie) => cookie.trim());
    const target = cookies.find((cookie) => cookie.startsWith(`${name}=`));
    if (!target) {
      return undefined;
    }

    return decodeURIComponent(target.substring(name.length + 1));
  }

  private resolveFrontendRedirect(target?: string): string {
    const fallback = config.oauth?.google?.defaultRedirectUri || `${config.clientUrl}/oauth/google/callback`;
    if (!target) {
      return fallback;
    }

    try {
      const parsed = target.startsWith('http://') || target.startsWith('https://')
        ? new URL(target)
        : new URL(target, config.clientUrl);

      if (!parsed.href.startsWith(config.clientUrl)) {
        return fallback;
      }

      return parsed.toString();
    } catch (error) {
      return fallback;
    }
  }

  private redirectWithError(res: Response, redirectUri: string, message: string, code = 'oauth_error'): void {
    const redirectUrl = new URL(redirectUri);
    const fragment = new URLSearchParams({ error: code, message });
    redirectUrl.hash = fragment.toString();
    res.redirect(redirectUrl.toString());
  }

  private async exchangeCodeForTokens(code: string) {
    const oauthConfig = config.oauth?.google;
    if (!oauthConfig?.backendRedirectUri) {
      throw new AppError('Google OAuth is not configured', 500);
    }

    const client = this.getGoogleOAuthClient();
    const { tokens } = await client.getToken({
      code,
      redirect_uri: oauthConfig.backendRedirectUri,
    });

    return tokens;
  }
  
  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phoneNumber, preferredChannel, username } = req.body;
      
      if (!phoneNumber) {
        return next(new AppError('Phone number is required', 400));
      }
      
      if (!username || typeof username !== 'string' || !username.trim()) {
        return next(new AppError('Username is required', 400));
      }
      const trimmedUsername = username.trim();
      
      // Validate phone number format (E.164: +[country][number])
      const phoneRegex = /^\+[1-9]\d{7,14}$/;
      if (!phoneRegex.test(phoneNumber)) {
        return next(new AppError('Invalid phone number format', 400));
      }
      
      // Validate channel preference if provided
      const whatsappEnabled = this.verificationService.isWhatsAppEnabled();
      let channel: 'sms' | 'whatsapp' | 'both' = 'sms';
      if (preferredChannel && ['sms', 'whatsapp', 'both'].includes(preferredChannel)) {
        channel = preferredChannel as 'sms' | 'whatsapp' | 'both';
      }

      if (!whatsappEnabled && channel !== 'sms') {
        channel = 'sms';
      }

      // Check if user exists and is already verified
      const existingUser = await User.findOne({ phoneNumber });
      
      if (existingUser && existingUser.phoneVerified) {
        return next(new AppError('User with this phone number already exists', 400));
      }

      // Generate verification code with the enhanced service
      const verificationCode = await this.verificationService.sendVerificationCode(phoneNumber, channel);
      
      // If user exists but is unverified, update the record
      if (existingUser) {
        existingUser.verificationCode = verificationCode;
        existingUser.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
        existingUser.pendingVerification = true;
        await existingUser.save();
      } else {
        // Create new unverified user (minimal data)
        await User.create({
          phoneNumber,
          role: 'user',
          pendingVerification: true,
          verificationCode,
          verificationCodeExpires: new Date(Date.now() + 10 * 60 * 1000),
          phoneVerified: false
        });
      }
      
      // Determine which channels were used
      const channelMessage = channel === 'both'
        ? 'SMS and WhatsApp'
        : (channel === 'sms' ? 'SMS' : 'WhatsApp');
      const finalChannelMessage = (!whatsappEnabled && preferredChannel && preferredChannel !== 'sms')
        ? 'SMS (WhatsApp disabled)'
        : channelMessage;
      
      // Respond with success but no token yet
      res.status(200).json({
        status: 'success',
        message: `verification code sent via ${finalChannelMessage}`,
        data: {
          phoneNumber,
          username: trimmedUsername,
          verificationRequired: true
        }
      });
    } catch (error) {
      next(error);
    }
  };

  registerWithEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, email, password } = req.body;

      if (!username || typeof username !== 'string' || !username.trim()) {
        return next(new AppError('Username is required', 400));
      }

      if (!email || typeof email !== 'string') {
        return next(new AppError('Email is required', 400));
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return next(new AppError('Invalid email address', 400));
      }

      if (!password || typeof password !== 'string' || password.length < 6) {
        return next(new AppError('Password must be at least 6 characters long', 400));
      }

      const result = await this.authService.registerEmailUser({
        username: username.trim(),
        email: email.toLowerCase(),
        password
      });

      res.status(200).json({
        status: 'success',
        message: 'Verification code sent to your email. Enter the code to complete registration.',
        data: {
          email: email.toLowerCase(),
          verificationRequired: true,
          verificationExpires: result.verificationExpires
        }
      });
    } catch (error) {
      next(error);
    }
  };

  verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, email, verificationCode, username, password } = req.body;

      if (!token && (!email || !verificationCode)) {
        return next(new AppError('Verification token or email/code pair is required', 400));
      }

      if (!token && (typeof verificationCode !== 'string' || verificationCode.trim().length === 0)) {
        return next(new AppError('Verification code is required', 400));
      }

      const authResult = await this.authService.verifyEmail({
        token,
        email: typeof email === 'string' ? email.toLowerCase() : undefined,
        verificationCode,
        username,
        password,
      });

      res.status(200).json({
        status: 'success',
        message: 'Email verified successfully',
        token: authResult.token,
        refreshToken: authResult.refreshToken,
        data: {
          user: authResult.user
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Add this new method for completing registration after verification
  verifyAndCompleteRegistration = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phoneNumber, verificationCode, username, pin } = req.body;
      
      if (!phoneNumber || !verificationCode || !username || !pin) {
        return next(new AppError('Phone number, verification code, username, and PIN are required', 400));
      }
      
      // Find user with matching phone and code
      const user = await User.findOne({
        phoneNumber,
        verificationCode,
        verificationCodeExpires: { $gt: Date.now() },
        pendingVerification: true
      });
      
      if (!user) {
        return next(new AppError('Invalid or expired verification code', 400));
      }
      
      // Complete registration with username and PIN
      user.username = username;
      user.pin = pin; // Let model handle hashing
      user.authProvider = 'phone';
      user.phoneVerified = true;
      user.pendingVerification = false;
      user.verificationCode = undefined;
      user.verificationCodeExpires = undefined;
      
      await user.save();
      
      // Automatically log the user in after successful verification
      const authResult = await this.authService.login(phoneNumber, pin);

      // Send welcome notification
      await this.notificationService.sendSystemNotification(
        (user._id as any).toString(),
        'Welcome to Randa Plus!',
        `Welcome ${user.username}! We're excited to have you on board.`,
        {
          actionType: 'profile',
          priority: 'high'
        }
      );
      
      res.status(200).json({
        status: 'success',
        token: authResult.token,
        refreshToken: authResult.refreshToken,
        data: {
          user: authResult.user
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Add a method to resend verification code if needed
  resendVerificationCode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return next(new AppError('Phone number is required', 400));
      }
      
      // Find pending user
      const user = await User.findOne({ 
        phoneNumber,
        pendingVerification: true
      });
      
      if (!user) {
        return next(new AppError('No pending registration found for this phone number', 404));
      }
      
      // Generate new verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Update user with new code
      user.verificationCode = verificationCode;
      user.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();
      
      // Log code in development (send SMS in production)
      console.log(`📱 NEW VERIFICATION CODE for ${phoneNumber}: ${verificationCode}`);
      
      res.status(200).json({
        status: 'success',
        message: 'New verification code sent to your phone'
      });
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const method = (req.body?.method || 'phone').toLowerCase();

      if (method === 'email') {
        return this.loginWithEmail(req, res, next);
      }

      if (method === 'google') {
        return this.loginWithGoogle(req, res, next);
      }

      const { phoneNumber, pin, identifier } = req.body;
      const loginIdentifier = phoneNumber || identifier;

      if (!loginIdentifier || !pin) {
        return next(new AppError('Phone number and PIN are required', 400));
      }

      const result = await this.authService.login(loginIdentifier, pin);

      res.status(200).json({
        status: 'success',
        token: result.token,
        refreshToken: result.refreshToken,
        data: {
          user: result.user
        }
      });
    } catch (error) {
      next(error);
    }
  };

  loginWithEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return next(new AppError('Email and password are required', 400));
      }

      const result = await this.authService.loginWithEmail(email, password);

      res.status(200).json({
        status: 'success',
        token: result.token,
        refreshToken: result.refreshToken,
        data: {
          user: result.user
        }
      });
    } catch (error) {
      next(error);
    }
  };

  loginWithGoogle = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idToken = req.body?.idToken || req.body?.credential;

      if (!idToken) {
        return next(new AppError('Google token is required', 400));
      }

      const result = await this.authService.loginWithGoogle(idToken);

      res.status(200).json({
        status: 'success',
        token: result.token,
        refreshToken: result.refreshToken,
        data: {
          user: result.user
        }
      });
    } catch (error) {
      next(error);
    }
  };

  startGoogleOAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const redirectParam = typeof req.query.redirect_uri === 'string' ? req.query.redirect_uri : undefined;
      const frontendRedirect = this.resolveFrontendRedirect(redirectParam);

      const state = crypto.randomBytes(24).toString('hex');
      const cookieOptions = this.getOAuthCookieOptions();
      res.cookie('oauth_state', state, cookieOptions);
      res.cookie('oauth_redirect', frontendRedirect, cookieOptions);

      const authorizationUrl = this.buildGoogleOAuthUrl(state);
      return res.redirect(authorizationUrl);
    } catch (error) {
      next(error);
    }
  };

  handleGoogleOAuthCallback = async (req: Request, res: Response, next: NextFunction) => {
    const storedRedirect = this.getCookieValue(req, 'oauth_redirect');
    const frontendRedirect = this.resolveFrontendRedirect(storedRedirect);

    try {
      const errorParam = typeof req.query.error === 'string' ? req.query.error : undefined;
      const errorDescription = typeof req.query.error_description === 'string' ? req.query.error_description : undefined;

      if (errorParam) {
        return this.redirectWithError(
          res,
          frontendRedirect,
          errorDescription || 'Google login was cancelled',
          errorParam
        );
      }

      const code = typeof req.query.code === 'string' ? req.query.code : undefined;
      const state = typeof req.query.state === 'string' ? req.query.state : undefined;
      const storedState = this.getCookieValue(req, 'oauth_state');

      if (!code) {
        return this.redirectWithError(res, frontendRedirect, 'Missing authorization code', 'missing_code');
      }

      if (!state || !storedState || state !== storedState) {
        return this.redirectWithError(res, frontendRedirect, 'Invalid or expired OAuth state', 'invalid_state');
      }

      const tokens = await this.exchangeCodeForTokens(code);
      if (!tokens.id_token) {
        return this.redirectWithError(res, frontendRedirect, 'Google response did not include an ID token', 'invalid_token');
      }

      const authResult = await this.authService.loginWithGoogle(tokens.id_token);
      this.clearOAuthCookies(res);

      const redirectUrl = new URL(frontendRedirect);
      const fragment = new URLSearchParams({
        token: authResult.token,
        refreshToken: authResult.refreshToken,
        message: 'Signed in with Google',
      });
      redirectUrl.hash = fragment.toString();

      res.redirect(redirectUrl.toString());
      return;
    } catch (error) {
      this.clearOAuthCookies(res);
      if (error instanceof AppError) {
        this.redirectWithError(res, frontendRedirect, error.message, 'oauth_error');
        return;
      }
      return next(error);
    }
  };

  exchangeGoogleCode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code } = req.body || {};
      if (!code || typeof code !== 'string') {
        return next(new AppError('Authorization code is required', 400));
      }

      const tokens = await this.exchangeCodeForTokens(code);
      if (!tokens.id_token) {
        return next(new AppError('Google response did not include an ID token', 400));
      }

      const authResult = await this.authService.loginWithGoogle(tokens.id_token);

      res.status(200).json({
        status: 'success',
        message: 'Signed in with Google',
        token: authResult.token,
        refreshToken: authResult.refreshToken,
        data: {
          user: authResult.user,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get refresh token from Authorization header or request body
      let refreshToken = req.body?.refreshToken;
      
      // If not in body, try to get from Authorization header
      if (!refreshToken && req.headers.authorization) {
        const bearerToken = req.headers.authorization.split(' ')[1];
        if (bearerToken) {
          refreshToken = bearerToken;
        }
      }
      
      if (!refreshToken) {
        return next(new AppError('Refresh token is required', 401));
      }
      
      const result = await this.authService.refreshToken(refreshToken);
      
      res.status(200).json({
        status: 'success',
        data: {
          token: result.token,
          refreshToken: result.refreshToken,
          expiresIn: 86400, // 24 hours in seconds
          tokenType: 'Bearer'
        }
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
      if (!resetToken) {
        return next(new AppError('Account with this email does not exist.', 404));
      }

      // In a real app, you would email the token to the user here.
      // For now, we send a generic message.
      const response: { status: string; message: string; resetToken?: string } = {
        status: 'success',
        message: 'Password reset token generated successfully.',
      };

      // For development/testing, we can include the token in the response.
      if (process.env.NODE_ENV === 'development') {
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

      const { username } = req.body;
      if (typeof username !== 'string' || !username.trim()) {
        return next(new AppError('Username is required', 400));
      }
      const sanitizedUsername = username.trim();
      
      const updatedUser = await this.authService.updateProfile(userId.toString(), {
        username: sanitizedUsername
      });

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

    
      await this.authService.changePin(userId.toString(), oldPin, newPin);

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
      if (!resetCode) {
        return next(new AppError('Account with this phone number does not exist.', 404));
      }

      const response: { status: string; message: string; resetCode?: string } = {
        status: 'success',
        message: 'PIN reset code generated successfully.',
      };

      // For development/testing, we can return the code in the response.
      // In production, this should be removed.
      if (process.env.NODE_ENV === 'development') {
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

  // Add this temporary method (REMOVE IN PRODUCTION)
  resetUserPin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, newPin } = req.body;
      
      const bcrypt = require('bcryptjs'); // Use bcryptjs instead of bcrypt to match your imports
      const hashedPin = await bcrypt.hash(newPin, 12); // Use 12 salt rounds to match your registration
      
      // Use User model directly instead of repository
      const user = await User.findOneAndUpdate(
        { username },
        { pin: hashedPin },
        { new: true }
      );
      
      if (!user) {
        return res.status(404).json({
          status: 'fail',
          message: 'User not found'
        });
      }
      
      res.status(200).json({
        status: 'success',
        message: `PIN reset successfully for user ${username}`
      });
    } catch (error) {
      next(error);
    }
  };
}