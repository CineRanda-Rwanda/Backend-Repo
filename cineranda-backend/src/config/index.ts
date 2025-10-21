import dotenv from 'dotenv';
import path from 'path';
import { ConnectOptions } from 'mongoose';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// --- Define interfaces for type safety ---
interface JwtConfig {
  secret: string;
  expiration: string;
  refreshSecret: string;
  refreshExpiration: string;
}

interface AwsConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  s3Bucket: string;
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/cineranda-dev'
  },
  
  // --- THIS IS THE CORRECTED JWT OBJECT ---
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiration: process.env.JWT_EXPIRATION!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION!,
  } as JwtConfig,
  
  // This is the AWS configuration object (already correct)
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    region: process.env.AWS_REGION!,
    s3Bucket: process.env.AWS_S3_BUCKET!,
  } as AwsConfig,
  
  // --- ALL YOUR OTHER CONFIGURATIONS ARE PRESERVED ---
  payment: {
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY
    },
    paypal: {
      clientId: process.env.PAYPAL_CLIENT_ID,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET
    },
    mtnMomo: {
      apiKey: process.env.MTN_MOMO_API_KEY
    },
    airtelMoney: {
      apiKey: process.env.AIRTEL_MONEY_API_KEY
    },
    flutterwave: {
      publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY || '',
      secretKey: process.env.FLUTTERWAVE_SECRET_KEY || '',
      encryptionKey: process.env.FLUTTERWAVE_ENCRYPTION_KEY || '',
      secretHash: process.env.FLUTTERWAVE_SECRET_HASH || ''
    },
    callbackUrl: process.env.PAYMENT_CALLBACK_URL || 'http://localhost:5000/api/v1/payments/callback',
    webhookUrl: process.env.PAYMENT_WEBHOOK_URL || 'http://localhost:5000/api/v1/payments/webhook'
  },
  
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@cineranda.com',
    password: process.env.ADMIN_PASSWORD || 'SecurePassword123!'
  },
  
  regions: {
    rwanda: {
      code: 'rw',
      currency: 'RWF',
      paymentMethods: ['mtn-momo', 'airtel-money', 'bank-card']
    },
    eastAfrica: {
      code: 'ea',
      currency: 'USD',
      paymentMethods: ['mtn-momo', 'airtel-money', 'bank-card', 'paypal']
    },
    otherAfrica: {
      code: 'oa',
      currency: 'USD',
      paymentMethods: ['paypal', 'stripe', 'bank-card']
    },
    international: {
      code: 'int',
      currency: 'USD',
      paymentMethods: ['paypal', 'stripe', 'bank-card']
    }
  },
  
  // Add clientUrl for redirects
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000'
};

export default config;