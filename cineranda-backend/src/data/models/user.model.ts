import mongoose, { Schema, Document, model } from 'mongoose';
import bcrypt from 'bcryptjs';

// Define transaction interface
interface Transaction {
  amount: number;
  type: 'welcome-bonus' | 'admin-adjustment' | 'purchase' | 'refund';
  description?: string;
  createdAt: Date;
}

// Define coin wallet interface
interface CoinWallet {
  balance: number;
  transactions: Transaction[];
}

// User interface
export interface IUser extends Document {
  username: string;
  email?: string;
  password?: string;
  phoneNumber: string;
  pin: string;
  firstName?: string;
  lastName?: string;
  role: string;
  location?: string;
  isActive?: boolean;
  isEmailVerified?: boolean;
  emailVerificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  pinResetCode?: string;
  pinResetExpires?: Date;
  lastActive?: Date;
  loginCount?: number;
  watchHistory?: Array<{
    contentId: mongoose.Types.ObjectId;
    progress: number;
    lastWatched: Date;
    watchTime: number;
  }>;
  purchasedContent?: Array<{
    contentId: mongoose.Types.ObjectId;
    purchaseDate: Date;
    expiryDate?: Date;
    price: number;
    currency: string;
  }>;
  preferredLanguage?: 'kinyarwanda' | 'english' | 'french';
  theme?: 'light' | 'dark';
  coinWallet?: CoinWallet;
  isTwoFactorEnabled?: boolean; // Added for 2FA
  twoFactorSecret?: string;   // Added for 2FA
  pendingVerification?: boolean; // Added for phone number verification
  verificationCode?: string; // Added for phone number verification
  verificationCodeExpires?: Date; // Added for phone number verification
  phoneVerified?: boolean; // Added for phone number verification
  comparePassword(candidatePassword: string): Promise<boolean>;
  comparePin(candidatePin: string): Promise<boolean>;
}

// User schema
const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      select: false,
    },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    pin: {
      type: String,
      required: true,
      select: false,
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ['admin', 'user', 'creator'],
      default: 'user',
    },
    location: {
      type: String,
      enum: ['rwanda', 'east-africa', 'other-africa', 'international'],
      default: 'international',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    lastActive: {
      type: Date,
    },
    loginCount: {
      type: Number,
      default: 0,
    },
    watchHistory: [
      {
        contentId: { type: mongoose.Types.ObjectId, required: true },
        progress: { type: Number, required: true },
        lastWatched: { type: Date, required: true },
        watchTime: { type: Number, required: true },
      },
    ],
    purchasedContent: [
      {
        contentId: { type: mongoose.Types.ObjectId, required: true },
        purchaseDate: { type: Date, required: true },
        expiryDate: { type: Date },
        price: { type: Number, required: true },
        currency: { type: String, required: true },
      },
    ],
    preferredLanguage: {
      type: String,
      enum: ['kinyarwanda', 'english', 'french'],
    },
    theme: {
      type: String,
      enum: ['light', 'dark'],
    },
    coinWallet: {
      type: {
        balance: { type: Number, default: 0 },
        transactions: [
          {
            amount: { type: Number, required: true },
            type: {
              type: String,
              enum: ['welcome-bonus', 'admin-adjustment', 'purchase', 'refund'],
              required: true,
            },
            description: { type: String },
            createdAt: { type: Date, default: Date.now },
          },
        ],
      },
      default: {},
    },
    pinResetCode: {
      type: String,
      select: false,
    },
    pinResetExpires: {
      type: Date,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    // --- ADDED 2FA FIELDS TO SCHEMA ---
    isTwoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
      select: false,
    },
    // --- ADDED PHONE VERIFICATION FIELDS TO SCHEMA ---
    pendingVerification: {
      type: Boolean,
      default: true,
    },
    verificationCode: {
      type: String,
      select: false, // Hide from query results
    },
    verificationCodeExpires: {
      type: Date,
      select: false,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Password hashing middleware
userSchema.pre<IUser>('save', async function (next) {
  if (this.isModified('password') && this.password) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    } catch (error: any) {
      return next(error);
    }
  }

  if (this.isModified('pin') && this.pin) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.pin = await bcrypt.hash(this.pin, salt);
    } catch (error: any) {
      return next(error);
    }
  }

  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Compare PIN method
userSchema.methods.comparePin = async function (
  candidatePin: string
): Promise<boolean> {
  if (!this.pin) return false;
  return bcrypt.compare(candidatePin, this.pin);
};

// Add a method to add coins to wallet
userSchema.methods.addCoins = async function (
  amount: number,
  type: string,
  description: string = ''
) {
  if (!this.coinWallet) {
    this.coinWallet = { balance: 0, transactions: [] };
  }

  this.coinWallet.balance += amount;
  this.coinWallet.transactions.push({
    amount,
    type,
    description,
    createdAt: new Date(),
  });

  return this.save();
};

// Create the model
export const User = model<IUser>('User', userSchema);