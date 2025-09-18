import mongoose, { Schema, Document, model, Model } from 'mongoose'; // Corrected import
import bcrypt from 'bcryptjs';

// User interface
export interface IUser extends Document {
  username: string;
  email?: string; // Make email optional
  password?: string; // Make password optional
  phoneNumber: string; // Add phone number
  pin: string; // Add PIN
  firstName?: string;
  lastName?: string;
  role: string;
  location?: string; // Make location optional
  isActive: boolean;
  isEmailVerified?: boolean; // Make email verification optional
  emailVerificationToken?: string;
  passwordResetToken?: string; // Add this line
  passwordResetExpires?: Date; // Add this line
  pinResetCode?: string;
  pinResetExpires?: Date;
  lastActive?: Date;
  loginCount?: number;
  // Add watch history field
  watchHistory?: Array<{
    contentId: mongoose.Types.ObjectId;
    progress: number;
    lastWatched: Date;
    watchTime: number;
  }>;
  // Add purchased content field
  purchasedContent?: Array<{
    contentId: mongoose.Types.ObjectId;
    purchaseDate: Date;
    expiryDate?: Date;
    price: number;
    currency: string;
  }>;
  preferredLanguage?: 'kinyarwanda' | 'english' | 'french'; // Add preferred language
  theme?: 'light' | 'dark'; // Add theme
  coinWallet?: {
    balance: number;
    totalEarned: number;
    totalSpent: number;
  }; // Add coin wallet
  comparePassword(candidatePassword: string): Promise<boolean>; // Make non-optional
  comparePin(candidatePin: string): Promise<boolean>; // Make non-optional
  toObject(): any;
  save(): Promise<any>;
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
      sparse: true, // This is the key fix - only index documents with email
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      select: false, // Don't return password by default
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
      select: false, // Don't return PIN by default
    },
    // Keep other fields as they were
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
        totalEarned: { type: Number, default: 0 },
        totalSpent: { type: Number, default: 0 },
      },
      default: {},
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    pinResetCode: {
      type: String,
      select: false,
    },
    pinResetExpires: {
      type: Date,
      select: false,
    },
    // Keep other fields
  },
  {
    timestamps: true,
  }
);

// Password hashing middleware
userSchema.pre('save', async function (next) {
  // Only hash the password if it's modified or new
  if (this.isModified('password') && this.password) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.password = (await bcrypt.hash(this.password, salt)) as unknown as string;
    } catch (error: any) {
      return next(error);
    }
  }

  // Hash PIN if modified
  if (this.isModified('pin') && this.pin) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.pin = (await bcrypt.hash(this.pin, salt)) as unknown as string;
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
  try {
    return await bcrypt.compare(candidatePassword, this.password as string);
  } catch (error) {
    return false;
  }
};

// Compare PIN method
userSchema.methods.comparePin = async function (
  candidatePin: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePin, this.pin as string);
  } catch (error) {
    return false;
  }
};

// Create the model
export const User = model<IUser>('User', userSchema);