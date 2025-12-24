import dotenv from "dotenv";
import path from "path";

if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: path.join(__dirname, "../../.env") });
}

const port = parseInt(process.env.PORT || "5000", 10);
const apiPrefix = process.env.API_PREFIX || "/api/v1";
const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
const serverBaseUrl = process.env.SERVER_BASE_URL || `http://localhost:${port}`;
const apiBaseUrl = process.env.API_BASE_URL || `${serverBaseUrl}${apiPrefix}`;
const defaultGoogleCallbackUrl = process.env.GOOGLE_OAUTH_CALLBACK_URL || `${serverBaseUrl}${apiPrefix}/auth/google/callback`;
const defaultGoogleFrontendRedirect = process.env.GOOGLE_OAUTH_FRONTEND_REDIRECT || `${clientUrl}/oauth/google/callback`;

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
  env: process.env.NODE_ENV || "development",
  port,
  apiPrefix,
  serverBaseUrl,
  apiBaseUrl,

  mongodb: {
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017/randaplus-dev",
  },

  jwt: {
    secret: process.env.JWT_SECRET || "default-secret-do-not-use-in-prod",
    expiration: process.env.JWT_EXPIRATION || "365d",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "default-refresh-secret",
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || "365d",
  } as JwtConfig,

  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    region: process.env.AWS_REGION || "",
    s3Bucket: process.env.AWS_S3_BUCKET || "",
  } as AwsConfig,

  payment: {
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY,
    },
    paypal: {
      clientId: process.env.PAYPAL_CLIENT_ID,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET,
    },
    mtnMomo: {
      apiKey: process.env.MTN_MOMO_API_KEY,
    },
    airtelMoney: {
      apiKey: process.env.AIRTEL_MONEY_API_KEY,
    },
    flutterwave: {
      publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY || "",
      secretKey: process.env.FLUTTERWAVE_SECRET_KEY || "",
      encryptionKey: process.env.FLUTTERWAVE_ENCRYPTION_KEY || "",
      secretHash: process.env.FLUTTERWAVE_SECRET_HASH || "",
    },
    callbackUrl: process.env.PAYMENT_CALLBACK_URL || `${serverBaseUrl}${apiPrefix}/payments/callback`,
    webhookUrl: process.env.PAYMENT_WEBHOOK_URL || `${serverBaseUrl}${apiPrefix}/payments/webhook`,
    defaultCustomerEmail: process.env.PAYMENT_DEFAULT_CUSTOMER_EMAIL || "payments@randaplus.com",
  },

  admin: {
    email: process.env.ADMIN_EMAIL || "admin@randaplus.com",
    password: process.env.ADMIN_PASSWORD || "SecurePassword123!",
  },

  regions: {
    rwanda: {
      code: "rw",
      currency: "RWF",
      paymentMethods: ["mtn-momo", "airtel-money", "bank-card"],
    },
    eastAfrica: {
      code: "ea",
      currency: "USD",
      paymentMethods: ["mtn-momo", "airtel-money", "bank-card", "paypal"],
    },
    otherAfrica: {
      code: "oa",
      currency: "USD",
      paymentMethods: ["paypal", "stripe", "bank-card"],
    },
    international: {
      code: "int",
      currency: "USD",
      paymentMethods: ["paypal", "stripe", "bank-card"],
    },
  },

  clientUrl,

  paymentRedirect: {
    successPath: process.env.PAYMENT_SUCCESS_PATH || "/payment/success",
    failedPath: process.env.PAYMENT_FAILED_PATH || "/payment/failed",
  },

  oauth: {
    google: {
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "",
      backendRedirectUri: defaultGoogleCallbackUrl,
      defaultRedirectUri: defaultGoogleFrontendRedirect,
      scope: process.env.GOOGLE_OAUTH_SCOPES || "openid email profile",
    },
  },
};

export default config;
