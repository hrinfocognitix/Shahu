require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local'
});

const requiredInProduction = ['MONGO_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'OTP_HMAC_SECRET'];

if (process.env.NODE_ENV === 'production') {
  requiredInProduction.forEach(key => {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  });
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5001,
  host: process.env.HOST || '0.0.0.0',
  apiVersion: process.env.API_VERSION || 'v1',
  // The local development database is commonly a standalone MongoDB instance.
  // It cannot use retryable writes, so keep the safe fallback compatible too.
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/shahu?retryWrites=false',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'local-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'local-refresh-secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '25m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || process.env.SMTP_USER
  },
  otp: { hmacSecret: process.env.OTP_HMAC_SECRET || process.env.JWT_ACCESS_SECRET || 'development-only-otp-secret' },
  superadminRecoveryEmail: process.env.SUPERADMIN_RECOVERY_EMAIL || 'hrinfocognitix@gmail.com',
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_FROM
  }
};
