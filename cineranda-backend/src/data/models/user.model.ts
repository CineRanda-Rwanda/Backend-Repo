import mongoose, { Schema, Document, model } from 'mongoose';
import bcrypt from 'bcryptjs';

// Define transaction interface
interface Transaction {
  amount: number;
  type: 'welcome-bonus' | 'admin-adjustment' | 'purchase' | 'refund' | 'topup' | 'bonus';
  description?: string;
  createdAt: Date;
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
    episodeIdsAtPurchase?: mongoose.Types.ObjectId[] | string[];
  }>;
  purchasedEpisodes?: Array<{
    contentId: mongoose.Types.ObjectId;
    episodeId: mongoose.Types.ObjectId;
    purchaseDate: Date;
    price: number;
    currency: string;
  }>;
  purchasedSeasons?: Array<{
    contentId: mongoose.Types.ObjectId;
    seasonId: mongoose.Types.ObjectId;
    seasonNumber: number;
    purchaseDate: Date;
    price: number;
    currency: string;
    episodeIdsAtPurchase?: mongoose.Types.ObjectId[] | string[];
  }>;
  preferredLanguage?: 'kinyarwanda' | 'english' | 'french';
  theme?: 'light' | 'dark';
  // Unified wallet structure (RWF)
  wallet: {
    balance: number;
    bonusBalance: number;
    transactions: Transaction[];
  };
  isTwoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  pendingVerification?: boolean;
  verificationCode?: string;
  verificationCodeExpires?: Date;
  phoneVerified?: boolean;
  balance: number;
  transactions: Array<{
    type: 'deposit' | 'purchase' | 'refund' | 'gift';
    amount: number;
    description?: string;
    reference?: string;
    createdAt: Date;
  }>;
  comparePassword(candidatePassword: string): Promise<boolean>;
  comparePin(candidatePin: string): Promise<boolean>;
  addToWallet(amount: number, type: string, description?: string, asBonus?: boolean): Promise<IUser>;
  deductFromWallet(amount: number, type: string, description?: string): Promise<IUser>;
  getTotalBalance(): number;
}

// User schema
const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: function(this: IUser) {
        return !this.pendingVerification;
      },
      unique: true,
      sparse: true,
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
      required: function(this: IUser) {
        return !this.pendingVerification;
      },
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
        contentId: { type: mongoose.Types.ObjectId, ref: 'Content', required: true },
        progress: { type: Number, required: true },
        lastWatched: { type: Date, required: true },
        watchTime: { type: Number, required: true },
      },
    ],
    purchasedContent: [
      {
        contentId: { type: mongoose.Types.ObjectId, ref: 'Content', required: true },
        purchaseDate: { type: Date, required: true, default: Date.now },
        expiryDate: { type: Date },
        price: { type: Number, required: true },
        currency: { type: String, required: true, default: 'RWF' },
        episodeIdsAtPurchase: [{ type: String }],
      },
    ],
    purchasedEpisodes: [
      {
        contentId: { type: mongoose.Types.ObjectId, ref: 'Content', required: true },
        episodeId: { type: mongoose.Types.ObjectId, required: true },
        purchaseDate: { type: Date, required: true, default: Date.now },
        price: { type: Number, required: true },
        currency: { type: String, required: true, default: 'RWF' },
      },
    ],
    purchasedSeasons: [
      {
        contentId: { type: mongoose.Types.ObjectId, ref: 'Content', required: true },
        seasonId: { type: mongoose.Types.ObjectId, required: true },
        seasonNumber: { type: Number, required: true },
        purchaseDate: { type: Date, required: true, default: Date.now },
        price: { type: Number, required: true },
        currency: { type: String, required: true, default: 'RWF' },
        episodeIdsAtPurchase: [{ type: String }],
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
    // Unified wallet (RWF only)
    wallet: {
      type: {
        balance: { type: Number, default: 0, min: 0 },
        bonusBalance: { type: Number, default: 0, min: 0 },
        transactions: [
          {
            amount: { type: Number, required: true },
            type: { 
              type: String, 
              enum: ['welcome-bonus', 'admin-adjustment', 'purchase', 'refund', 'topup', 'bonus'],
              required: true 
            },
            description: { type: String },
            createdAt: { type: Date, default: Date.now }
          }
        ]
      },
      default: () => ({ balance: 0, bonusBalance: 0, transactions: [] })
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
    isTwoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
      select: false,
    },
    pendingVerification: {
      type: Boolean,
      default: true,
    },
    verificationCode: {
      type: String,
      select: false,
    },
    verificationCodeExpires: {
      type: Date,
      select: false,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    transactions: [
      {
        type: {
          type: String,
          enum: ['deposit', 'purchase', 'refund', 'gift'],
          required: true,
        },
        amount: {
          type: Number,
          required: true,
        },
        description: { type: String },
        reference: { type: String },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance (username, email, phoneNumber already indexed via unique: true)
userSchema.index({ 'purchasedContent.contentId': 1 });
userSchema.index({ 'purchasedEpisodes.episodeId': 1 });
userSchema.index({ 'purchasedEpisodes.contentId': 1 });
userSchema.index({ 'purchasedSeasons.seasonId': 1 });

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

  if (this.isModified('pin') && this.pin && !this.pin.startsWith('$2')) {
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
  return await bcrypt.compare(candidatePin, this.pin);
};

// Add to wallet: credit balance (regular) or bonusBalance
userSchema.methods.addToWallet = async function(
  amount: number, 
  type: string, 
  description = '', 
  asBonus = false
) {
  if (!this.wallet) {
    this.wallet = { balance: 0, bonusBalance: 0, transactions: [] };
  }

  if (asBonus) {
    this.wallet.bonusBalance = (this.wallet.bonusBalance || 0) + amount;
  } else {
    this.wallet.balance = (this.wallet.balance || 0) + amount;
  }

  this.wallet.transactions.push({ 
    amount, 
    type, 
    description, 
    createdAt: new Date() 
  });
  
  return this.save();
};

// Deduct from wallet: use bonusBalance first, then balance
userSchema.methods.deductFromWallet = async function(
  amount: number, 
  type: string, 
  description = ''
) {
  if (!this.wallet) {
    throw new Error('Insufficient balance');
  }

  let remaining = amount;
  const bonus = this.wallet.bonusBalance || 0;
  
  // Use bonus balance first
  if (bonus >= remaining) {
    this.wallet.bonusBalance = bonus - remaining;
    remaining = 0;
  } else {
    remaining -= bonus;
    this.wallet.bonusBalance = 0;
  }

  // Then use regular balance
  if (remaining > 0) {
    const bal = this.wallet.balance || 0;
    if (bal < remaining) {
      throw new Error('Insufficient balance');
    }
    this.wallet.balance = bal - remaining;
  }

  this.wallet.transactions.push({ 
    amount: -amount, 
    type, 
    description, 
    createdAt: new Date() 
  });
  
  return await this.save();
};

// Get total balance (regular + bonus)
userSchema.methods.getTotalBalance = function() {
  if (!this.wallet) {
    return 0;
  }
  return (this.wallet.balance || 0) + (this.wallet.bonusBalance || 0);
};

// Create the model
export const User = model<IUser>('User', userSchema);