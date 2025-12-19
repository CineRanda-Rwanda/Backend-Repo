import mongoose, { Document, Schema } from 'mongoose';

export interface IEmailRegistration extends Document {
  email: string;
  requestedUsername?: string;
  role: 'admin' | 'user' | 'creator';
  verificationCodeHash: string;
  verificationExpires: Date;
  attempts: number;
  passwordHash?: string;
}

const emailRegistrationSchema = new Schema<IEmailRegistration>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },
    requestedUsername: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ['admin', 'user', 'creator'],
      default: 'user',
    },
    verificationCodeHash: {
      type: String,
      required: true,
    },
    verificationExpires: {
      type: Date,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    passwordHash: {
      type: String,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

export const EmailRegistration = mongoose.model<IEmailRegistration>(
  'EmailRegistration',
  emailRegistrationSchema
);
