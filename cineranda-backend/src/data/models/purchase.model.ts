import mongoose, { Schema, Document } from 'mongoose';

export interface IPurchase extends Document {
  userId: mongoose.Types.ObjectId;
  contentId: mongoose.Types.ObjectId;
  contentType: string;
  amountPaid: number;
  coinAmount: number;
  paymentMethod: string;
  transactionId: string;
  transactionRef: string;
  status: 'pending' | 'completed' | 'failed';
  purchaseType: 'content' | 'wallet';
  meta: any;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    contentId: {
      type: Schema.Types.ObjectId,
      ref: 'Content'
    },
    contentType: {
      type: String,
      enum: ['Movie', 'Series', 'Episode', 'WalletTopUp']
    },
    amountPaid: {
      type: Number,
      required: true
    },
    coinAmount: {
      type: Number,
      default: 0
    },
    paymentMethod: {
      type: String,
      required: true
    },
    transactionId: {
      type: String,
      required: true
    },
    transactionRef: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending'
    },
    purchaseType: {
      type: String,
      enum: ['content', 'wallet'],
      default: 'content'
    },
    meta: {
      type: Schema.Types.Mixed
    }
  },
  { timestamps: true }
);

export const Purchase = mongoose.model<IPurchase>('Purchase', PurchaseSchema);