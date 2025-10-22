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

// --- FIX 1: DEFINE THE UserWithId TYPE ---
// This type represents a Mongoose document based on IUser with a correctly typed _id.
type UserWithId = IUser & { _id: Types.ObjectId };

export class AuthService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  // New register method with username, phoneNumber, pin
  async register(userData: {
    username: string;
    phoneNumber: string;
    pin: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  }): Promise<{ user: Partial<IUser>; token: string; refreshToken: string }> {
    // Check if user already exists
    const existingUsername = await this.userRepository.findByUsername(userData.username);
    if (existingUsername) {
      throw new AppError('Username already taken', 400);
    }

    // Check if phone number already exists
    const existingPhone = await this.userRepository.findOne({ phoneNumber: userData.phoneNumber });
    if (existingPhone) {
      throw new AppError('Phone number already in use', 400);
    }

    // Check if email already exists (only if email provided)
    if (userData.email) {
      const existingEmail = await this.userRepository.findByEmail(userData.email);
      if (existingEmail) {
        throw new AppError('Email already in use', 400);
      }
    }

    // Create a valid user object without null values
    const userToCreate: any = {
      username: userData.username,
      phoneNumber: userData.phoneNumber,
      pin: userData.pin,
      isActive: true,
      role: 'user',
    };

    // Only add optional fields if they're provided
    if (userData.firstName) userToCreate.firstName =  userData.firstName;
    if (userData.lastName) userToCreate.lastName = userData.lastName;
    if (userData.email) userToCreate.email = userData.email;

    // Create new user (with cleaned data)
    const user = await this.userRepository.create(userToCreate) as UserWithId;

    // Generate tokens
    const token = this.generateToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Return user data (without sensitive fields) and tokens
    const userResponse = { ...user.toObject() };
    delete (userResponse as any).pin;
    delete (userResponse as any).password;

    return {
      user: userResponse,
      token,
      refreshToken
    };
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
      if (!isPinValid) {
        try {
          console.log(`PIN format in DB: ${user.pin.substring(0, 3)}...`);
          // Use bcryptjs instead of bcrypt to match registration
          const bcryptjs = require('bcryptjs');
          isPinValid = await bcryptjs.compare(pin, user.pin);
          console.log(`Direct bcryptjs comparison result: ${isPinValid}`);
        } catch (err) {
          console.error(`Error in direct bcrypt compare:`, err);
        }
      }

      // Last resort - try plaintext comparison
      if (!isPinValid && pin === user.pin) {
        console.log(`Direct string comparison matched - PIN stored as plaintext!`);
        isPinValid = true;
      }

      if (!isPinValid) {
        throw new AppError('Invalid credentials', 401);
      }

      // Update last active
      const userId = user._id.toString();
      await this.userRepository.updateLastActive(userId);

      // Generate tokens
      const token = this.generateToken(user);
      const refreshToken = this.generateRefreshToken(user);

      // Return user data (without sensitive fields) and tokens
      const userResponse = { ...user.toObject() };
      delete userResponse.pin;
      delete userResponse.password;

      return {
        user: userResponse,
        token,
        refreshToken
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async refreshToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as { userId: string };
      
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

  async verifyEmail(token: string): Promise<boolean> {
    // Cast to UserWithId
    const user = await this.userRepository.findOne({ emailVerificationToken: token }) as UserWithId;
    
    if (!user) {
      throw new AppError('Invalid verification token', 400);
    }
    
    // Update user to mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    await user.save();
    
    return true;
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
    firstName?: string;
    lastName?: string;
    preferredLanguage?: 'kinyarwanda' | 'english' | 'french';
    theme?: 'light' | 'dark';
  }): Promise<Partial<IUser>> {
    // Make sure we're only passing valid values
    const validData: Partial<IUser> = {};
    
    if (userData.firstName) validData.firstName = userData.firstName;
    if (userData.lastName) validData.lastName = userData.lastName;
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
    const bcrypt = require('bcrypt');
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
      const bcrypt = require('bcrypt');
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
    // In a real application, you would send this code via SMS here.

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
    const bcrypt = require('bcrypt');
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
      name: 'Cineranda Admin', // This name will appear in the user's authenticator app
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