import mongoose, { Schema, Document } from 'mongoose';

export interface IPurchase extends Document {
  user: mongoose.Types.ObjectId;
  content: mongoose.Types.ObjectId;
  contentType: 'movie' | 'episode' | 'series-bundle';
  price: number;
  currency: 'RWF' | 'USD' | 'COINS';
  pricingTier: 'rwanda' | 'east-africa' | 'other-africa' | 'international';
  paymentMethod: 'mtn-momo' | 'airtel-money' | 'bank-card' | 'paypal' | 'stripe' | 'coins' | 'admin-grant';
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  transactionId: string;
  externalTransactionId?: string;
  accessGrantedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
  userLocation?: string;
  userIpAddress?: string;
  deviceInfo?: string;
  conversionSource?: 'trailer' | 'search' | 'featured' | 'recommendation' | 'direct';
  grantedByAdmin?: mongoose.Types.ObjectId;
  adminNotes?: string;
  refundReason?: string;
  refundedAt?: Date;
  refundedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const purchaseSchema: Schema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required']
    },
    content: {
      type: Schema.Types.ObjectId,
      ref: 'Movie',
      required: [true, 'Content reference is required']
    },
    contentType: {
      type: String,
      enum: ['movie', 'episode', 'series-bundle'],
      required: [true, 'Content type is required']
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative']
    },
    currency: {
      type: String,
      enum: ['RWF', 'USD', 'COINS'],
      required: [true, 'Currency is required']
    },
    pricingTier: {
      type: String,
      enum: ['rwanda', 'east-africa', 'other-africa', 'international'],
      required: [true, 'Pricing tier is required']
    },
    paymentMethod: {
      type: String,
      enum: ['mtn-momo', 'airtel-money', 'bank-card', 'paypal', 'stripe', 'coins', 'admin-grant'],
      required: [true, 'Payment method is required']
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    transactionId: {
      type: String,
      required: [true, 'Transaction ID is required'],
      unique: true
    },
    externalTransactionId: String,
    accessGrantedAt: Date,
    expiresAt: Date,
    isActive: {
      type: Boolean,
      default: true
    },
    userLocation: String,
    userIpAddress: String,
    deviceInfo: String,
    conversionSource: {
      type: String,
      enum: ['trailer', 'search', 'featured', 'recommendation', 'direct']
    },
    grantedByAdmin: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    adminNotes: String,
    refundReason: String,
    refundedAt: Date,
    refundedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

// Indexes for efficient queries
purchaseSchema.index({ user: 1 });
purchaseSchema.index({ content: 1 });
purchaseSchema.index({ transactionId: 1 }, { unique: true });
purchaseSchema.index({ paymentStatus: 1 });
purchaseSchema.index({ createdAt: 1 });

const Purchase = mongoose.model<IPurchase>('Purchase', purchaseSchema);

export default Purchase;