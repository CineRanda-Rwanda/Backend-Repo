import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/cineranda-dev'
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your_jwt_secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your_refresh_secret',
    expiration: process.env.JWT_EXPIRE || '15m',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRE || '7d'
  },
  
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1',
    s3Bucket: process.env.AWS_S3_BUCKET || 'cineranda-dev'
  },
  
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
    }
  },
  
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@cineranda.com',
    password: process.env.ADMIN_PASSWORD || 'SecurePassword123!'
  },
  
  // Regional pricing configuration
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
  }
};

export default config;