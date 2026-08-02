const mongoose = require('mongoose');

/** One active verification record per email. The TTL index cleans expired codes. */
const emailVerificationOtpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    otpHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    isUsed: { type: Boolean, default: false },
    verifiedAt: Date,
    failedAttempts: { type: Number, default: 0, min: 0 },
    requestCount: { type: Number, default: 0, min: 0 },
    requestWindowStartedAt: { type: Date, default: Date.now },
    lastSentAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmailVerificationOtp', emailVerificationOtpSchema);
