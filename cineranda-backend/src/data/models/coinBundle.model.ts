import { Schema, Document, model } from 'mongoose';

export interface ICoinBundle extends Document {
  name: string;
  description?: string;
  numberOfCoins: number;
  // Unified price (RWF)
  price?: number;
  // Legacy field kept for transition
  priceInRwf: number;
  isActive: boolean;
}

const coinBundleSchema = new Schema<ICoinBundle>(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    numberOfCoins: { type: Number, required: true, min: 1 },
    price: { type: Number, min: 0 },
    priceInRwf: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const CoinBundle = model<ICoinBundle>('CoinBundle', coinBundleSchema);