import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose'; // Import Types
import { UserRepository } from '../../data/repositories/user.repository';
import { IUser } from '../../data/models/user.model';
import AppError from '../../utils/AppError';
import config from '../../config';
import crypto from 'crypto';
import { User } from '../../data/models/user.model';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { OAuth2Client } from 'google-auth-library';
import bcrypt from 'bcryptjs';
import { EmailService } from './email.service';
import { EmailRegistration } from '../../data/models/emailRegistration.model';
import { VerificationService } from './verification.service';

// --- FIX 1: DEFINE THE UserWithId TYPE ---
// This type represents a Mongoose document based on IUser with a correctly typed _id.
type UserWithId = IUser & { _id: Types.ObjectId };

export class AuthService {
  private userRepository: UserRepository;
  private googleClient?: OAuth2Client;
  private googleAudience?: string;
  private emailService: EmailService;
  private verificationService: VerificationService;

  constructor() {
    this.userRepository = new UserRepository();
    this.emailService = new EmailService();
    this.verificationService = new VerificationService();
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (googleClientId) {
      this.googleAudience = googleClientId;
      this.googleClient = new OAuth2Client(googleClientId);
    }
  }

  private buildAuthResponse(user: UserWithId): { user: Partial<IUser>; token: string; refreshToken: string } {
    const token = this.generateToken(user);
    const refreshToken = this.generateRefreshToken(user);
    const userResponse = { ...user.toObject() } as Partial<IUser>;
    delete (userResponse as any).pin;
    delete (userResponse as any).password;
    return {
      user: userResponse,
      token,
      refreshToken
    };
  }

  private getGoogleClient(): OAuth2Client {
    if (!this.googleClient || !this.googleAudience) {
      throw new AppError('Google authentication is not configured', 500);
    }
    return this.googleClient;
  }

  // New register method with username, phoneNumber, pin
  async register(userData: {
    username: string;
    phoneNumber: string;
    pin: string;
  }): Promise<{ user: Partial<IUser>; token: string; refreshToken: string }> {
    if (!userData.phoneNumber || !userData.pin) {
      throw new AppError('Phone number and PIN are required', 400);
    }

    const existingPhone = await this.userRepository.findOne({ phoneNumber: userData.phoneNumber });
    if (existingPhone) {
      throw new AppError('Phone number already in use', 400);
    }

    const userToCreate: Partial<IUser> = {
      username: userData.username,
      phoneNumber: userData.phoneNumber,
      pin: userData.pin,
      isActive: true,
      role: 'user',
      authProvider: 'phone',
    };

    const user = await this.userRepository.create(userToCreate) as UserWithId;
    return this.buildAuthResponse(user);
  }

  async registerEmailUser(userData: {
    username: string;
    email: string;
    password: string;
  }): Promise<{ verificationExpires: Date }> {
    const email = userData.email?.toLowerCase();
    const username = userData.username?.trim();

    if (!email) {
      throw new AppError('Email is required', 400);
    }

    if (!username) {
      throw new AppError('Username is required', 400);
    }

    if (!userData.password || userData.password.length < 6) {
      throw new AppError('Password must be at least 6 characters long', 400);
    }

    const existingEmail = await this.userRepository.findByEmail(email);
    if (existingEmail) {
      throw new AppError('Email already in use', 400);
    }

    const passwordHash = await bcrypt.hash(userData.password, 12);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationCodeHash = crypto.createHash('sha256').update(verificationCode).digest('hex');
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000);

    await EmailRegistration.findOneAndUpdate(
      { email },
      {
        requestedUsername: username,
        passwordHash,
        verificationCodeHash,
        verificationExpires,
        role: 'user',
        attempts: 0,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    await this.emailService.sendEmailVerificationCode(email, verificationCode, username);

    return { verificationExpires };
  }

  // New login method with identifier (username or phone) and pin
  async login(identifier: string, pin: string): Promise<{ user: Partial<IUser>; token: string; refreshToken: string }> {
    try {
      // Find user with pin field included (keep your existing query)
      const user = await this.userRepository.findOne({
        $or: [
          { username: identifier },
          { phoneNumber: identifier }
        ]
      }, '+pin') as UserWithId;

      if (!user) {
        console.log(`Login failed: No user found with identifier: ${identifier}`);
        throw new AppError('Invalid credentials', 401);
      }

      // Check if user is active
      if (!user.isActive) {
        throw new AppError('Your account has been deactivated. Please contact support.', 401);
      }

      console.log(`Attempting PIN verification for user: ${user.username}`);

      // Debug the PIN comparison process
      console.log(`PIN methods available: comparePin=${typeof user.comparePin === 'function' ? 'yes' : 'no'}`);

      // Try with detailed logging
      let isPinValid = false;

      if (user.comparePin && typeof user.comparePin === 'function') {
        try {
          console.log(`Using user.comparePin method`);
          isPinValid = await user.comparePin(pin);
          console.log(`comparePin result: ${isPinValid}`);
        } catch (err) {
          console.error(`Error in comparePin:`, err);
        }
      }

      // Always try direct comparison as backup
      if (!isPinValid && user.pin) {
        try {
          console.log(`PIN format in DB: ${user.pin.substring(0, 3)}...`);
          isPinValid = await bcrypt.compare(pin, user.pin);
          console.log(`Direct bcrypt comparison result: ${isPinValid}`);
        } catch (err) {
          console.error(`Error in direct bcrypt compare:`, err);
        }
      }

      // Last resort - try plaintext comparison
      if (!isPinValid && user.pin && pin === user.pin) {
        console.log(`Direct string comparison matched - PIN stored as plaintext!`);
        isPinValid = true;
      }

      if (!isPinValid) {
        throw new AppError('Invalid credentials', 401);
      }

      // Update last active
      const userId = user._id.toString();
      await this.userRepository.updateLastActive(userId);

      return this.buildAuthResponse(user);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async loginWithEmail(email: string, password: string): Promise<{ user: Partial<IUser>; token: string; refreshToken: string }> {
    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    const user = await this.userRepository.findWithPassword(email.toLowerCase()) as UserWithId | null;
    if (!user || !user.password) {
      throw new AppError('Invalid credentials', 401);
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      throw new AppError('Invalid credentials', 401);
    }

    if (!user.isEmailVerified) {
      throw new AppError('Please verify your email before logging in', 403);
    }

    await this.userRepository.updateLastActive(user._id.toString());
    return this.buildAuthResponse(user);
  }

  async refreshToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    try {
      let decoded: { userId: string };
      
      // Try to verify as refresh token first
      try {
        decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as { userId: string };
      } catch (refreshError) {
        // If refresh token verification fails, try as access token
        // This allows using access tokens to get new tokens (common pattern)
        decoded = jwt.verify(refreshToken, config.jwt.secret) as { userId: string };
      }
      
      // Get user - explicitly type as UserWithId
      const user = await this.userRepository.findById(decoded.userId) as UserWithId;
      if (!user || !user.isActive)  {
        throw new AppError('Invalid refresh token', 401);
      }

      // Generate new tokens
      const newToken = this.generateToken(user);
      const newRefreshToken = this.generateRefreshToken(user);

      return {
        token: newToken,
        refreshToken: newRefreshToken
      };
    } catch (error) {
      throw new AppError('Invalid refresh token', 401);
    }
  }

  async loginWithGoogle(idToken: string): Promise<{ user: Partial<IUser>; token: string; refreshToken: string }> {
    if (!idToken) {
      throw new AppError('Google token is required', 400);
    }

    const client = this.getGoogleClient();
    const ticket = await client.verifyIdToken({
      idToken,
      audience: this.googleAudience,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      throw new AppError('Unable to verify Google account', 401);
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase();
    const displayName = payload.name || payload.given_name || email.split('@')[0];

    let user = await User.findOne({
      $or: [{ googleId }, { email }]
    }) as UserWithId | null;

    if (user) {
      if (!user.googleId) {
        user.googleId = googleId;
      }
      if (!user.isEmailVerified) {
        user.isEmailVerified = true;
      }
      if (!user.authProvider || user.authProvider === 'phone') {
        user.authProvider = 'google';
      }
      await user.save();
    } else {
      user = await this.userRepository.create({
        username: displayName,
        email,
        googleId,
        authProvider: 'google',
        isEmailVerified: true,
        isActive: true,
        role: 'user',
        pendingVerification: false,
      }) as UserWithId;
    }

    await this.userRepository.updateLastActive(user._id.toString());
    return this.buildAuthResponse(user);
  }

  async verifyEmail(params: {
    email?: string;
    verificationCode?: string;
    username?: string;
    password?: string;
    token?: string;
  }): Promise<{ user: Partial<IUser>; token: string; refreshToken: string }> {
    const { email, verificationCode, username, password, token } = params;
    const now = new Date();

    if (email && verificationCode) {
      const normalizedEmail = email.toLowerCase();
      const pendingRegistration = await EmailRegistration.findOne({ email: normalizedEmail })
        .select('+passwordHash');

      if (!pendingRegistration || pendingRegistration.role !== 'user') {
        throw new AppError('No pending verification found for this email', 400);
      }

      if (pendingRegistration.verificationExpires <= now) {
        await EmailRegistration.deleteOne({ _id: pendingRegistration._id });
        throw new AppError('Verification code has expired. Please request a new code.', 400);
      }

      if (!/^\d{6}$/.test(verificationCode)) {
        throw new AppError('Invalid verification code format', 400);
      }

      const hashedCode = crypto.createHash('sha256').update(verificationCode).digest('hex');
      if (hashedCode !== pendingRegistration.verificationCodeHash) {
        throw new AppError('Invalid verification code', 400);
      }

      const finalUsername = username?.trim() || pendingRegistration.requestedUsername;
      if (!finalUsername) {
        throw new AppError('Username is required to complete registration', 400);
      }

      let passwordHash: string | undefined;
      if (password) {
        if (password.length < 6) {
          throw new AppError('Password must be at least 6 characters long', 400);
        }
        passwordHash = await bcrypt.hash(password, 12);
      } else if (pendingRegistration.passwordHash) {
        passwordHash = pendingRegistration.passwordHash;
      }

      if (!passwordHash) {
        throw new AppError('Password is required to complete registration', 400);
      }

      const existingEmail = await this.userRepository.findByEmail(normalizedEmail);
      if (existingEmail) {
        await EmailRegistration.deleteOne({ _id: pendingRegistration._id });
        throw new AppError('Email already in use', 400);
      }

      const user = await this.userRepository.create({
        username: finalUsername,
        email: normalizedEmail,
        password: passwordHash,
        authProvider: 'email',
        isEmailVerified: true,
        isActive: true,
        role: pendingRegistration.role || 'user',
        pendingVerification: false,
      }) as UserWithId;

      await EmailRegistration.deleteOne({ _id: pendingRegistration._id });
      return this.buildAuthResponse(user);
    }

    if (!token) {
      throw new AppError('Verification details are required', 400);
    }

    const user = await this.userRepository.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: now },
    }) as UserWithId | null;

    if (!user) {
      throw new AppError('Invalid or expired verification token', 400);
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    return this.buildAuthResponse(user);
  }

  /**
   * Generates a password reset token for a user.
   * In a real app, this would also trigger an email.
   * @param email The user's email address.
   * @returns The unhashed reset token (for testing/emailing).
   */
  async forgotPassword(email: string): Promise<string | null> {
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal that the user doesn't exist.
      return null;
    }

    // 1. Generate a random token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // 2. Hash the token and save it to the database for security
    user.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // 3. Set an expiration time (e.g., 10 minutes)
    user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);

    await user.save();

    await this.emailService.sendPasswordResetEmail(email, resetToken);

    // 4. Return the UN-hashed token (this is what the user receives)
    return resetToken;
  }

  /**
   * Resets a user's password using a valid token.
   * @param token The unhashed token from the user.
   * @param newPassword The new password.
   */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    // 1. Hash the incoming token to match the one in the DB
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // 2. Find the user by the hashed token and check if it's expired
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      // Token is invalid or has expired
      return false;
    }

    // 3. Set the new password and clear the reset fields
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save(); // The pre-save hook will hash the new password

    return true;
  }

  async getProfile(userId: string): Promise<Partial<IUser>> {
    // Cast to UserWithId
    const user = await this.userRepository.findById(userId) as UserWithId;
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    const userResponse = { ...user.toObject() };
    delete userResponse.password;
    
    return userResponse;
  }

  async updateProfile(userId: string, userData: {
    preferredLanguage?: 'kinyarwanda' | 'english' | 'french';
    theme?: 'light' | 'dark';
  }): Promise<Partial<IUser>> {
    // Make sure we're only passing valid values
    const validData: Partial<IUser> = {};

    if (userData.preferredLanguage) validData.preferredLanguage = userData.preferredLanguage;
    if (userData.theme) validData.theme = userData.theme;
    
    // Cast to UserWithId
    const user = await this.userRepository.update(userId, validData) as UserWithId;
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    const userResponse = { ...user.toObject() };
    delete userResponse.password;
    
    return userResponse;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
    // Cast to UserWithId and ensure password field is selected
    const user = await this.userRepository.findById(userId, '+password') as UserWithId;
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Add a null check before calling comparePassword
    if (!user.password || typeof user.comparePassword !== 'function') {
      throw new AppError('Password not set for this user', 400);
    }
    
    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      throw new AppError('Current password is incorrect', 401);
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    return true;
  }

  // 1. Change PIN
  async changePin(userId: string, currentPin: string, newPin: string): Promise<boolean> {
    // Get user with PIN included
    const user = await this.userRepository.findById(userId, '+pin') as UserWithId;
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Verify current PIN
    const isPinValid = await user.comparePin(currentPin);
    if (!isPinValid) {
      throw new AppError('Current PIN is incorrect', 401);
    }
    
    // Validate new PIN
    if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      throw new AppError('PIN must be 4 digits', 400);
    }
    
    // Update PIN - hash it properly
    user.pin = await bcrypt.hash(newPin, 12);  // Use salt rounds 12 to match registration
    await user.save();
    
    return true;
  }

  // 2. Forgot PIN
  async forgotPin(phoneNumber: string): Promise<string | void> {
    try {
      // Find user directly with the Mongoose model
      const user = await User.findOne({ phoneNumber });
      
      if (!user) {
        console.log(`No user found with phone number: ${phoneNumber}`);
        return;
      }
      
      // Use a simple token
      const resetToken = "123456";
      
      // Set expiration
      const resetExpires = new Date();
      resetExpires.setHours(resetExpires.getHours() + 24);
      
      // Use direct update to avoid middlewares
      await User.updateOne(
        { _id: user._id },
        { 
          $set: { 
            passwordResetToken: resetToken,
            passwordResetExpires: resetExpires
          } 
        }
      );
      
      // Verify the update worked
      const updatedUser = await User.findOne({ _id: user._id });
      console.log(`Token stored: ${updatedUser?.passwordResetToken}`);
      
      return resetToken;
    } catch (error) {
      console.error('Error in forgotPin:', error);
      throw new AppError('Failed to process request', 500);
    }
  }

  // 3. Reset PIN
  async resetPin(token: string, newPin: string): Promise<boolean> {
    try {
      console.log(`Attempting to reset PIN with token: "${token}"`);
      console.log(`Token length: ${token.length}`);
      
      // Import User model directly
      const { User } = require('../../data/models/user.model');
      
      // First get ALL users with this token (ignoring expiry)
      const anyUsers = await User.find({ passwordResetToken: token });
      console.log(`Found ${anyUsers.length} users with this token (ignoring expiry)`);
      
      // If we found users, log details about them
      if (anyUsers.length > 0) {
        anyUsers.forEach((u: mongoose.Document & IUser, i: number) => {
          console.log(`User ${i+1}:`, {
            id: u._id,
            token: u.passwordResetToken,
            tokenLength: u.passwordResetToken?.length,
            expiry: u.passwordResetExpires,
            isExpired: u.passwordResetExpires ? u.passwordResetExpires < new Date() : false
          });
        });
      }
      
      // Now try the actual query
      const user = await User.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() }
      });
      
      console.log('Valid user found:', user ? 'Yes' : 'No');
      
      if (!user) {
        throw new AppError('Invalid or expired reset token', 400);
      }
      
      // If we get here, we found a valid user, update their PIN
      console.log(`Updating PIN for user: ${user._id}`);
      
      // Update PIN - handle hashing in pre-save hook
      user.pin = await bcrypt.hash(newPin, 12);  // Match registration's 12 salt rounds
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
      
      console.log('PIN updated successfully');
      return true;
    } catch (error) {
      console.error('Error in resetPin:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to reset PIN', 500);
    }
  }

  /**
   * Checks if a phone number is already registered.
   * @param phoneNumber The phone number to verify.
   * @returns True if the phone number exists, false otherwise.
   */
  async verifyPhone(phoneNumber: string): Promise<boolean> {
    const user = await User.findOne({ phoneNumber });
    return !!user; // This converts the user object (or null) to a boolean
  }

  /**
   * Creates a PIN reset request for a user.
   */
  async createPinResetRequest(phoneNumber: string): Promise<string | null> {
    const user = await User.findOne({ phoneNumber });

    if (!user) {
      console.log(`PIN reset request for non-existent user: ${phoneNumber}`);
      return null; // Don't reveal that the user doesn't exist
    }

    // Generate a random 6-digit code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // Code expires in 15 minutes

    // Use a direct update to bypass any potential pre-save hooks that might interfere
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          pinResetCode: resetCode,
          pinResetExpires: expires,
        },
      }
    );

    console.log(`Generated PIN reset code ${resetCode} for user ${user.username}`);
    const userPhone = user.phoneNumber;
    if (!userPhone) {
      console.error('User missing phone number for PIN reset', user._id);
      throw new AppError('Cannot send PIN reset code: phone number not available.', 500);
    }

    try {
      await this.verificationService.sendPinResetCode(userPhone, resetCode);
    } catch (error) {
      console.error('Failed to send PIN reset SMS:', error);
      throw new AppError('Failed to send PIN reset code. Please try again later.', 500);
    }

    return resetCode;
  }

  /**
   * Resets the user's PIN using a valid reset code.
   * @param code The 6-digit reset code.
   * @param newPin The new PIN to set.
   * @returns True if the reset was successful, false otherwise.
   */
  async performPinReset(code: string, newPin: string): Promise<boolean> {
    // Find a user with a matching, non-expired code
    const user = await User.findOne({
      pinResetCode: code,
      pinResetExpires: { $gt: new Date() },
    });

    if (!user) {
      console.log(`Invalid or expired PIN reset code attempted: ${code}`);
      return false;
    }

    // If the user is found, update the PIN and clear the reset fields
    user.pin = await bcrypt.hash(newPin, 12);  // Match registration's 12 salt rounds
    user.pinResetCode = undefined;
    user.pinResetExpires = undefined;

    // The 'save' method will trigger the pre-save hook to hash the new PIN
    await user.save();

    console.log(`Successfully reset PIN for user ${user.username}`);
    return true;
  }

  /**
   * Handles login for an admin using email and password.
   */
  async adminLogin(email: string, password: string): Promise<{ token?: string; user?: Partial<IUser>; twoFactorRequired?: boolean } | null> {
    const user = await User.findOne({ email, role: 'admin' }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return null;
    }

    if (user.isTwoFactorEnabled) {
      return { twoFactorRequired: true };
    }

    const token = this.generateToken(user); // This now works correctly
    const userObject = user.toObject();
    delete (userObject as any).password;
    delete (userObject as any).pin;

    return { token, user: userObject };
  }

  /**
   * Generates a temporary 2FA secret and a QR code for setup.
   */
  async setup2FA(): Promise<{ secret: string; qrCodeUrl: string }> {
    const secret = speakeasy.generateSecret({
      name: 'Randa Plus Admin', // This name will appear in the user's authenticator app
    });

    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url!);
    
    return {
      secret: secret.base32, // The secret key to be stored temporarily
      qrCodeUrl,
    };
  }

  /**
   * Verifies the initial 2FA token and permanently saves the secret to the user.
   */
  async verify2FA(userId: string, token: string, secret: string): Promise<boolean> {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found.', 404);
    }

    const isVerified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
    });

    if (isVerified) {
      user.twoFactorSecret = secret;
      user.isTwoFactorEnabled = true;
      await user.save();
    }

    return isVerified;
  }

  /**
   * Validates a 2FA token during the login process.
   */
  async validate2FAToken(email: string, token: string): Promise<{ token: string; user: Partial<IUser> } | null> {
    const user = await User.findOne({ email, role: 'admin' }).select('+twoFactorSecret');

    if (!user || !user.twoFactorSecret) {
      throw new AppError('2FA is not enabled for this user or user not found.', 400);
    }

    const isVerified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 1,
    });

    if (!isVerified) {
      return null;
    }

    const jwtToken = this.generateToken(user); // This now works correctly
    const userObject = user.toObject();
    delete (userObject as any).password;
    delete (userObject as any).pin;
    delete (userObject as any).twoFactorSecret;

    return { token: jwtToken, user: userObject };
  }

  // --- FIX: UPDATE THE TOKEN GENERATION METHODS ---
  // The parameter type is correct, but we need to help TypeScript inside the function.
  private generateToken(user: UserWithId | IUser): string {
    const options: any = { expiresIn: config.jwt.expiration };
    
    return jwt.sign(
      { 
        // Cast `user._id` to `any` to access .toString() without type errors.
        // This is safe because we know every Mongoose document has an _id.
        userId: (user._id as any).toString(), 
        role: user.role,
        username: user.username
      },
      config.jwt.secret,
      options
    );
  }

  private generateRefreshToken(user: UserWithId | IUser): string {
    const options: any = { expiresIn: config.jwt.refreshExpiration };
    
    return jwt.sign(
      { 
        // Cast `user._id` to `any` here as well.
        userId: (user._id as any).toString()
      },
      config.jwt.refreshSecret,
      options
    );
  }

  // Keep other methods unchanged
}